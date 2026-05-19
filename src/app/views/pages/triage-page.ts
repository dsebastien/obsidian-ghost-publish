import { Notice } from 'obsidian'
import type { App } from 'obsidian'
import type { GhostPublishPlugin } from '../../plugin'
import type { Preset } from '../../types/preset.intf'
import { TRIAGE_RANGES } from '../../types/news-candidate.intf'
import type { TriageRangeId } from '../../types/news-candidate.intf'
import { findCandidates } from '../../services/candidate-discovery'
import { applyTriageAction } from '../../services/triage-actions'
import { NOTICE_TIMEOUT_MS } from '../../constants'
import { log } from '../../../utils/log'

export function renderTriagePage(
    container: HTMLElement,
    app: App,
    plugin: GhostPublishPlugin,
    preset: Preset,
    range: TriageRangeId,
    onRangeChange: (range: TriageRangeId) => void,
    onRefresh: () => void
): void {
    const filters = container.createDiv({ cls: 'gp-filter-bar' })
    filters.createSpan({ text: 'Range:', cls: 'gp-filter-label' })
    const select = filters.createEl('select', { cls: 'dropdown gp-range-select' })
    for (const r of TRIAGE_RANGES) {
        const option = select.createEl('option', { text: r.label, value: r.id })
        if (r.id === range) option.selected = true
    }
    select.addEventListener('change', () => {
        onRangeChange(select.value as TriageRangeId)
    })

    const candidates = findCandidates(app, plugin.settings, range)

    const summary = container.createDiv({ cls: 'gp-summary' })
    summary.setText(
        candidates.length === 0
            ? 'No candidates in this range.'
            : `${candidates.length} candidate${candidates.length === 1 ? '' : 's'} in this range.`
    )

    if (candidates.length === 0) return

    const list = container.createDiv({ cls: 'gp-card-list' })
    const showEmailButton = preset.newsletterSlug.trim().length > 0

    for (const candidate of candidates) {
        const card = list.createDiv({ cls: 'gp-card' })

        const header = card.createDiv({ cls: 'gp-card-header' })
        const titleEl = header.createEl('a', {
            text: candidate.file.basename,
            cls: 'gp-card-title'
        })
        titleEl.addEventListener('click', (ev) => {
            ev.preventDefault()
            void app.workspace.openLinkText(candidate.file.path, candidate.file.path, true)
        })

        const meta = card.createDiv({ cls: 'gp-card-meta' })
        meta.createSpan({
            text: new Date(candidate.mtime).toISOString().slice(0, 10),
            cls: 'gp-card-date'
        })
        meta.createSpan({ text: candidate.file.path, cls: 'gp-card-path' })

        const actions = card.createDiv({ cls: 'gp-card-actions' })

        const publishBtn = actions.createEl('button', {
            text: 'Publish',
            cls: 'mod-cta'
        })
        publishBtn.addEventListener('click', () => {
            void (async () => {
                try {
                    await applyTriageAction(
                        app,
                        candidate.file,
                        plugin.settings.frontmatter,
                        preset.id,
                        'publish'
                    )
                    new Notice(
                        `Queued for ${preset.name}: ${candidate.file.basename}`,
                        NOTICE_TIMEOUT_MS
                    )
                    onRefresh()
                } catch (e) {
                    log('Triage publish failed', 'error', e)
                    new Notice('Failed to apply triage action.', NOTICE_TIMEOUT_MS)
                }
            })()
        })

        if (showEmailButton) {
            const emailBtn = actions.createEl('button', {
                text: 'Publish + email',
                cls: 'mod-cta'
            })
            emailBtn.addEventListener('click', () => {
                void (async () => {
                    try {
                        await applyTriageAction(
                            app,
                            candidate.file,
                            plugin.settings.frontmatter,
                            preset.id,
                            'publish_email'
                        )
                        new Notice(
                            `Queued + email opt-in: ${candidate.file.basename}`,
                            NOTICE_TIMEOUT_MS
                        )
                        onRefresh()
                    } catch (e) {
                        log('Triage publish+email failed', 'error', e)
                        new Notice('Failed to apply triage action.', NOTICE_TIMEOUT_MS)
                    }
                })()
            })
        }

        const ignoreBtn = actions.createEl('button', { text: 'Ignore', cls: 'mod-muted' })
        ignoreBtn.addEventListener('click', () => {
            void (async () => {
                try {
                    await applyTriageAction(
                        app,
                        candidate.file,
                        plugin.settings.frontmatter,
                        preset.id,
                        'ignore'
                    )
                    new Notice(`Ignored: ${candidate.file.basename}`, NOTICE_TIMEOUT_MS)
                    onRefresh()
                } catch (e) {
                    log('Triage ignore failed', 'error', e)
                    new Notice('Failed to apply triage action.', NOTICE_TIMEOUT_MS)
                }
            })()
        })
    }
}
