import { Notice } from 'obsidian'
import type { App } from 'obsidian'
import type { GhostPublishPlugin } from '../../plugin'
import type { Preset } from '../../types/preset.intf'
import { findQueuedNotesForPreset } from '../../services/candidate-discovery'
import { isRemovedFromQueue, removeFromQueue } from '../../services/triage-actions'
import { NOTICE_TIMEOUT_MS } from '../../constants'
import { animateCardRemoval } from './card-animations'
import { renderIncrementally } from './incremental-list'
import { openNoteLink } from './open-note-link'
import { filterNotesBySearch } from './note-search'
import { log } from '../../../utils/log'

export function renderQueuePage(
    container: HTMLElement,
    app: App,
    plugin: GhostPublishPlugin,
    preset: Preset,
    hideSynced: boolean,
    searchQuery: string,
    onHideSyncedChange: (hide: boolean) => void,
    onRefresh: () => void
): void {
    // The full queue drives the Sync button (and the synced count); the
    // visible subset drives what gets rendered as cards. Sync is always run
    // against the full queue, independent of both the hide-synced filter and
    // the search query.
    // Notes with an in-flight "Remove from queue" write stay hidden.
    const fullQueue = findQueuedNotesForPreset(app, plugin.settings, preset.id).filter(
        (q) => !plugin.pendingMutations.has(q.file.path)
    )
    const syncedCount = fullQueue.filter((q) => q.hasGhostId).length
    const afterHideFilter = hideSynced ? fullQueue.filter((q) => !q.hasGhostId) : fullQueue
    const isSearching = searchQuery.trim().length > 0
    const visibleQueue = filterNotesBySearch(
        afterHideFilter,
        searchQuery,
        (q) => q.file.basename,
        (q) => q.file.path
    )

    const headerBar = container.createDiv({ cls: 'gp-summary-bar' })
    const summaryEl = headerBar.createSpan({ cls: 'gp-summary' })
    let visibleCount = visibleQueue.length
    const renderSummary = (): void => {
        const visibleLabel = `${visibleCount} note${visibleCount === 1 ? '' : 's'} shown`
        const hiddenSuffix = hideSynced && syncedCount > 0 ? ` · ${syncedCount} synced hidden` : ''
        const denominator = isSearching ? afterHideFilter.length : fullQueue.length
        const totalSuffix =
            (isSearching || !hideSynced) && denominator !== visibleCount ? ` of ${denominator}` : ''
        summaryEl.setText(`${visibleLabel}${totalSuffix}${hiddenSuffix}`)
    }
    renderSummary()

    const syncBtn = headerBar.createEl('button', {
        text: 'Sync to Ghost',
        cls: 'mod-cta'
    })
    if (fullQueue.length === 0) syncBtn.disabled = true
    syncBtn.addEventListener('click', () => {
        void (async () => {
            syncBtn.disabled = true
            const original = syncBtn.textContent ?? 'Sync to Ghost'
            syncBtn.textContent = 'Syncing…'
            try {
                // The plugin re-queries the full queue server-side, so this
                // button always syncs every queued note — regardless of the
                // hide-synced filter applied to the visible list.
                await plugin.runPublishAllForPreset(preset.id)
            } catch (e) {
                log('Sync failed', 'error', e)
            } finally {
                syncBtn.disabled = false
                syncBtn.textContent = original
                onRefresh()
            }
        })()
    })

    // Inline filter: show / hide already-synced notes in the visible list.
    // Default is hide (most useful punch-list view: "what's left to push?").
    const filters = container.createDiv({ cls: 'gp-filter-bar' })
    const toggleLabel = filters.createEl('label', { cls: 'gp-toggle-label' })
    const toggleInput = toggleLabel.createEl('input', { attr: { type: 'checkbox' } })
    toggleInput.checked = !hideSynced
    toggleLabel.appendText(' Show synced notes')
    toggleInput.addEventListener('change', () => {
        onHideSyncedChange(!toggleInput.checked)
    })

    if (fullQueue.length === 0) {
        container.createEl('p', {
            text: `No notes are currently queued under "${preset.name}".`,
            cls: 'gp-empty'
        })
        return
    }

    if (visibleCount === 0) {
        if (isSearching) {
            container.createEl('p', {
                text: 'No queued notes match your search.',
                cls: 'gp-empty'
            })
        } else {
            // All queued notes are synced AND the filter hides them.
            container.createEl('p', {
                text: `Everything's synced. Toggle "Show synced notes" to see ${syncedCount}.`,
                cls: 'gp-empty'
            })
        }
        return
    }

    const list = container.createDiv({ cls: 'gp-card-list' })

    renderIncrementally(list, visibleQueue, (item) => {
        const card = list.createDiv({ cls: 'gp-card' })
        const header = card.createDiv({ cls: 'gp-card-header' })
        const titleEl = header.createEl('a', {
            text: item.file.basename,
            cls: 'gp-card-title',
            attr: { title: item.file.path }
        })
        const openTitle = (ev: MouseEvent): void => openNoteLink(app, item.file.path, ev)
        titleEl.addEventListener('click', openTitle)
        titleEl.addEventListener('auxclick', openTitle)

        const meta = card.createDiv({ cls: 'gp-card-meta' })
        meta.createSpan({
            text: new Date(item.file.stat.mtime).toISOString().slice(0, 10),
            cls: 'gp-card-date'
        })

        const badges = card.createDiv({ cls: 'gp-card-badges' })
        if (item.hasGhostId) {
            badges.createSpan({ text: 'Synced', cls: 'gp-badge gp-badge-synced' })
        } else {
            badges.createSpan({ text: 'New', cls: 'gp-badge gp-badge-new' })
        }
        if (item.email) {
            badges.createSpan({ text: 'Newsletter', cls: 'gp-badge gp-badge-email' })
        }

        const actions = card.createDiv({ cls: 'gp-card-actions' })
        const removeBtn = actions.createEl('button', {
            text: 'Remove from queue',
            cls: 'mod-muted'
        })
        removeBtn.addEventListener('click', () => {
            // Optimistic: hide the card now, write after. We deliberately
            // do NOT disable the Sync button: Sync acts on the full queue.
            if (card.hasClass('gp-card-removing')) return
            visibleCount = Math.max(0, visibleCount - 1)
            renderSummary()
            animateCardRemoval(card)
            new Notice(`Removed from queue: ${item.file.basename}`, NOTICE_TIMEOUT_MS)
            void plugin
                .applyOptimistically(
                    item.file,
                    () => removeFromQueue(app, item.file, plugin.settings.frontmatter),
                    (front) => isRemovedFromQueue(front, plugin.settings.frontmatter)
                )
                .then((ok) => {
                    if (!ok) {
                        new Notice(
                            `Failed to remove note from queue: ${item.file.basename}`,
                            NOTICE_TIMEOUT_MS
                        )
                    }
                })
        })
    })
}
