import { setIcon } from 'obsidian'
import type { GhostPublishPlugin } from '../../plugin'

/**
 * Empty state shown when no presets are configured (or none are enabled).
 * Surfaces a single CTA — "Open settings" — and a brief explanation.
 */
export function renderEmptyState(
    container: HTMLElement,
    plugin: GhostPublishPlugin,
    headline: string,
    body: string
): void {
    const wrap = container.createDiv({ cls: 'gp-empty-state' })

    const iconEl = wrap.createDiv({ cls: 'gp-empty-icon' })
    setIcon(iconEl, 'inbox')

    wrap.createEl('h2', { text: headline, cls: 'gp-empty-headline' })
    wrap.createEl('p', { text: body, cls: 'gp-empty-body' })

    const cta = wrap.createEl('button', {
        text: 'Open settings',
        cls: 'mod-cta gp-empty-cta'
    })
    cta.addEventListener('click', () => {
        void plugin.openSettingsTab()
    })
}
