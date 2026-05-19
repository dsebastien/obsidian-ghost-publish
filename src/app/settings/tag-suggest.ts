import { AbstractInputSuggest } from 'obsidian'
import type { App } from 'obsidian'
import type { GhostTagSummary } from '../types/ghost-api.intf'

/**
 * Autocomplete suggester backed by the cached Ghost tags. Used in the
 * preset editor to add a tag by name.
 */
export class TagInputSuggest extends AbstractInputSuggest<GhostTagSummary> {
    private readonly tags: GhostTagSummary[]
    private readonly inputEl: HTMLInputElement

    constructor(app: App, inputEl: HTMLInputElement, tags: GhostTagSummary[]) {
        super(app, inputEl)
        this.inputEl = inputEl
        this.tags = tags
    }

    override getSuggestions(query: string): GhostTagSummary[] {
        const q = query.trim().toLowerCase()
        if (!q) return this.tags.slice(0, 20)
        return this.tags
            .filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q))
            .slice(0, 20)
    }

    override renderSuggestion(tag: GhostTagSummary, el: HTMLElement): void {
        el.createDiv({ text: tag.name, cls: 'gp-suggest-primary' })
        el.createDiv({
            text: `${tag.slug} · ${tag.visibility}`,
            cls: 'gp-suggest-secondary'
        })
    }

    override selectSuggestion(tag: GhostTagSummary): void {
        this.inputEl.value = tag.name
        this.inputEl.trigger('input')
        this.close()
    }
}
