import { Notice } from 'obsidian'
import type { App } from 'obsidian'
import type { GhostPublishPlugin } from '../../plugin'
import type { Preset } from '../../types/preset.intf'
import { findQueuedNotesForPreset } from '../../services/candidate-discovery'
import { removeFromQueue } from '../../services/triage-actions'
import { NOTICE_TIMEOUT_MS } from '../../constants'
import { animateCardRemoval } from './card-animations'
import { openNoteLink } from './open-note-link'
import { log } from '../../../utils/log'

export function renderQueuePage(
    container: HTMLElement,
    app: App,
    plugin: GhostPublishPlugin,
    preset: Preset,
    hideSynced: boolean,
    onHideSyncedChange: (hide: boolean) => void,
    onRefresh: () => void
): void {
    // The full queue drives the Sync button (and the synced count); the
    // visible subset drives what gets rendered as cards.
    const fullQueue = findQueuedNotesForPreset(app, plugin.settings, preset.id)
    const syncedCount = fullQueue.filter((q) => q.hasGhostId).length
    const visibleQueue = hideSynced ? fullQueue.filter((q) => !q.hasGhostId) : fullQueue

    const headerBar = container.createDiv({ cls: 'gp-summary-bar' })
    const summaryEl = headerBar.createSpan({ cls: 'gp-summary' })
    let visibleCount = visibleQueue.length
    const renderSummary = (): void => {
        const visibleLabel = `${visibleCount} note${visibleCount === 1 ? '' : 's'} shown`
        const hiddenSuffix = hideSynced && syncedCount > 0 ? ` · ${syncedCount} synced hidden` : ''
        const totalSuffix =
            !hideSynced && fullQueue.length !== visibleCount ? ` of ${fullQueue.length}` : ''
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
        // All queued notes are synced AND the filter hides them.
        container.createEl('p', {
            text: `Everything's synced. Toggle "Show synced notes" to see ${syncedCount}.`,
            cls: 'gp-empty'
        })
        return
    }

    const list = container.createDiv({ cls: 'gp-card-list' })

    for (const item of visibleQueue) {
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
            void (async () => {
                try {
                    await removeFromQueue(app, item.file, plugin.settings.frontmatter)
                    new Notice(`Removed from queue: ${item.file.basename}`, NOTICE_TIMEOUT_MS)
                    animateCardRemoval(card, () => {
                        visibleCount = Math.max(0, visibleCount - 1)
                        renderSummary()
                        // Note: we deliberately do NOT disable the Sync button
                        // here. Sync acts on the full queue, which may still
                        // have synced items even after every visible card is
                        // removed.
                    })
                } catch (e) {
                    log('Remove from queue failed', 'error', e)
                    new Notice('Failed to remove note from queue.', NOTICE_TIMEOUT_MS)
                }
            })()
        })
    }
}
