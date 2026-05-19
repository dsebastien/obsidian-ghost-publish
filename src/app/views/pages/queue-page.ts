import { Notice } from 'obsidian'
import type { App } from 'obsidian'
import type { GhostPublishPlugin } from '../../plugin'
import type { Preset } from '../../types/preset.intf'
import { findQueuedNotesForPreset } from '../../services/candidate-discovery'
import { removeFromQueue } from '../../services/triage-actions'
import { NOTICE_TIMEOUT_MS } from '../../constants'
import { log } from '../../../utils/log'

export function renderQueuePage(
    container: HTMLElement,
    app: App,
    plugin: GhostPublishPlugin,
    preset: Preset,
    onRefresh: () => void
): void {
    const queue = findQueuedNotesForPreset(app, plugin.settings, preset.id)

    const headerBar = container.createDiv({ cls: 'gp-summary-bar' })
    headerBar.createSpan({
        text: `${queue.length} note${queue.length === 1 ? '' : 's'} queued`,
        cls: 'gp-summary'
    })

    const syncBtn = headerBar.createEl('button', {
        text: 'Sync to Ghost',
        cls: 'mod-cta'
    })
    if (queue.length === 0) syncBtn.disabled = true
    syncBtn.addEventListener('click', () => {
        void (async () => {
            syncBtn.disabled = true
            const original = syncBtn.textContent ?? 'Sync to Ghost'
            syncBtn.textContent = 'Syncing…'
            try {
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

    if (queue.length === 0) {
        container.createEl('p', {
            text: `No notes are currently queued under "${preset.name}".`,
            cls: 'gp-empty'
        })
        return
    }

    const list = container.createDiv({ cls: 'gp-card-list' })

    for (const item of queue) {
        const card = list.createDiv({ cls: 'gp-card' })
        const header = card.createDiv({ cls: 'gp-card-header' })
        const titleEl = header.createEl('a', {
            text: item.file.basename,
            cls: 'gp-card-title'
        })
        titleEl.addEventListener('click', (ev) => {
            ev.preventDefault()
            void app.workspace.openLinkText(item.file.path, item.file.path, true)
        })

        const meta = card.createDiv({ cls: 'gp-card-meta' })
        meta.createSpan({
            text: new Date(item.file.stat.mtime).toISOString().slice(0, 10),
            cls: 'gp-card-date'
        })
        meta.createSpan({ text: item.file.path, cls: 'gp-card-path' })

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
                    onRefresh()
                } catch (e) {
                    log('Remove from queue failed', 'error', e)
                    new Notice('Failed to remove note from queue.', NOTICE_TIMEOUT_MS)
                }
            })()
        })
    }
}
