import type { App } from 'obsidian'
import type { GhostPublishPlugin } from '../../plugin'
import type { Preset } from '../../types/preset.intf'
import { openNoteLink } from './open-note-link'

interface PublishedItem {
    path: string
    title: string
    syncedAt: number
    postId: string
    emailedAt: number | null
}

export function renderRecentlyPublishedPage(
    container: HTMLElement,
    app: App,
    plugin: GhostPublishPlugin,
    preset: Preset
): void {
    const fm = plugin.settings.frontmatter
    const items: PublishedItem[] = []
    for (const file of app.vault.getMarkdownFiles()) {
        const cache = app.metadataCache.getFileCache(file)
        const front = (cache?.frontmatter ?? {}) as Record<string, unknown>
        if (front[fm.flag] !== true) continue
        if (front[fm.preset] !== preset.id) continue
        const synced = parseTimestamp(front[fm.syncedAt])
        const postId = typeof front[fm.ghostId] === 'string' ? (front[fm.ghostId] as string) : ''
        if (!postId || synced === null) continue
        items.push({
            path: file.path,
            title: typeof front['title'] === 'string' ? front['title'] : file.basename,
            syncedAt: synced,
            postId,
            emailedAt: parseTimestamp(front[fm.emailedAt])
        })
    }
    items.sort((a, b) => b.syncedAt - a.syncedAt)
    const top = items.slice(0, 30)

    if (top.length === 0) {
        container.createEl('p', {
            text: `Nothing has been published under "${preset.name}" yet.`,
            cls: 'gp-empty'
        })
        return
    }

    const list = container.createDiv({ cls: 'gp-card-list' })

    for (const item of top) {
        const card = list.createDiv({ cls: 'gp-card' })

        const header = card.createDiv({ cls: 'gp-card-header' })
        const titleEl = header.createEl('a', {
            text: item.title,
            cls: 'gp-card-title',
            attr: { title: item.path }
        })
        const openTitle = (ev: MouseEvent): void => openNoteLink(app, item.path, ev)
        titleEl.addEventListener('click', openTitle)
        titleEl.addEventListener('auxclick', openTitle)

        const meta = card.createDiv({ cls: 'gp-card-meta' })
        meta.createSpan({
            text: new Date(item.syncedAt).toISOString().slice(0, 16).replace('T', ' '),
            cls: 'gp-card-date'
        })

        if (item.emailedAt) {
            card.createDiv({ cls: 'gp-card-badges' }).createSpan({
                text: 'Newsletter sent',
                cls: 'gp-badge gp-badge-email'
            })
        }

        const actions = card.createDiv({ cls: 'gp-card-actions' })
        const editBtn = actions.createEl('button', { text: 'Open in Ghost' })
        editBtn.addEventListener('click', () => {
            const url = `${plugin.settings.ghostUrl.replace(/\/+$/, '')}/ghost/#/editor/post/${item.postId}`
            window.open(url)
        })
    }
}

function parseTimestamp(value: unknown): number | null {
    if (typeof value !== 'string') return null
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : null
}
