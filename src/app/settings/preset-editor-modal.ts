import { Modal, Notice, Setting, setIcon } from 'obsidian'
import type { App } from 'obsidian'
import type { Preset, PresetTagRef } from '../types/preset.intf'
import type { GhostNewsletterSummary, GhostTagSummary } from '../types/ghost-api.intf'
import { TagInputSuggest } from './tag-suggest'
import { NOTICE_TIMEOUT_MS } from '../constants'

/**
 * Modal for creating / editing a single preset. Returns a clone of the
 * preset via `onSubmit`; the caller is responsible for persisting.
 */
export class PresetEditorModal extends Modal {
    private draft: Preset
    private readonly onSubmit: (next: Preset) => void
    private readonly cachedTags: GhostTagSummary[]
    private readonly cachedNewsletters: GhostNewsletterSummary[]

    constructor(
        app: App,
        initial: Preset,
        cachedTags: GhostTagSummary[],
        cachedNewsletters: GhostNewsletterSummary[],
        onSubmit: (next: Preset) => void
    ) {
        super(app)
        this.draft = clonePreset(initial)
        this.cachedTags = cachedTags
        this.cachedNewsletters = cachedNewsletters
        this.onSubmit = onSubmit
    }

    override onOpen(): void {
        this.titleEl.setText(`Edit preset: ${this.draft.name || 'new preset'}`)
        this.render()
    }

    override onClose(): void {
        this.contentEl.empty()
    }

    private render(): void {
        const { contentEl } = this
        contentEl.empty()
        contentEl.addClass('gp-preset-editor')

        new Setting(contentEl)
            .setName('Name')
            .setDesc('Shown as the preset tab label on the panel.')
            .addText((t) => {
                t.setPlaceholder('e.g. Blog post')
                    .setValue(this.draft.name)
                    .onChange((v) => {
                        this.draft.name = v
                        this.titleEl.setText(`Edit preset: ${v || 'new preset'}`)
                    })
            })

        new Setting(contentEl)
            .setName('Enabled')
            .setDesc('Disabled presets do not show as tabs in the panel.')
            .addToggle((t) =>
                t.setValue(this.draft.enabled).onChange((v) => (this.draft.enabled = v))
            )

        new Setting(contentEl)
            .setName('Status')
            .setDesc('Ghost post status after sync.')
            .addDropdown((d) => {
                d.addOption('published', 'Published')
                d.addOption('draft', 'Draft')
                d.setValue(this.draft.ghostStatus)
                d.onChange((v) => (this.draft.ghostStatus = v === 'draft' ? 'draft' : 'published'))
            })

        this.renderTagsSection(contentEl)
        this.renderNewsletterSection(contentEl)

        new Setting(contentEl).setName('Canonical URL').setHeading()

        new Setting(contentEl)
            .setName('Set canonical_url')
            .setDesc(
                'When enabled, the post receives canonical_url and a "Canonical version" callout. Requires the global Notes base URL setting.'
            )
            .addToggle((t) =>
                t
                    .setValue(this.draft.canonicalUrlEnabled)
                    .onChange((v) => (this.draft.canonicalUrlEnabled = v))
            )

        new Setting(contentEl).setName('Listing note').setHeading()

        new Setting(contentEl)
            .setName('Maintain a listing note')
            .setDesc(
                'After each sync, rewrite a vault note that links every post currently published under this preset.'
            )
            .addToggle((t) =>
                t
                    .setValue(this.draft.listingNoteEnabled)
                    .onChange((v) => (this.draft.listingNoteEnabled = v))
            )

        new Setting(contentEl)
            .setName('Listing note path')
            .setDesc(
                'Vault-relative path. Created (with intermediate folders) if missing. Leave empty to disable.'
            )
            .addText((t) =>
                t
                    .setPlaceholder('Public/Listings/Blog posts.md')
                    .setValue(this.draft.listingNotePath)
                    .onChange((v) => (this.draft.listingNotePath = v.trim()))
            )

        const footer = contentEl.createDiv({ cls: 'gp-modal-footer' })
        const saveBtn = footer.createEl('button', { text: 'Save', cls: 'mod-cta' })
        saveBtn.addEventListener('click', () => {
            if (!this.draft.name.trim()) {
                new Notice('Preset name is required.', NOTICE_TIMEOUT_MS)
                return
            }
            this.onSubmit(clonePreset(this.draft))
            this.close()
        })
        const cancelBtn = footer.createEl('button', { text: 'Cancel' })
        cancelBtn.addEventListener('click', () => this.close())
    }

    private renderTagsSection(container: HTMLElement): void {
        new Setting(container)
            .setName('Tags')
            .setHeading()
            .setDesc("Order matters — the first tag is Ghost's primary tag.")

        if (this.cachedTags.length === 0) {
            container.createEl('p', {
                text: 'No Ghost tags cached. Use the "Refresh tags & newsletters" button in the main settings page to populate the autocomplete.',
                cls: 'gp-hint'
            })
        }

        const list = container.createDiv({ cls: 'gp-tag-list' })
        const redraw = (): void => {
            list.empty()
            this.draft.tags.forEach((tag, idx) => {
                const row = list.createDiv({ cls: 'gp-tag-row' })
                row.createSpan({ text: tag.name, cls: 'gp-tag-name' })

                const visibility = row.createEl('select', { cls: 'gp-tag-visibility' })
                for (const v of ['public', 'internal']) {
                    const opt = visibility.createEl('option', { text: v, value: v })
                    if (v === tag.visibility) opt.selected = true
                }
                visibility.addEventListener('change', () => {
                    const target = this.draft.tags[idx]
                    if (target) {
                        target.visibility = visibility.value === 'internal' ? 'internal' : 'public'
                    }
                })

                const upBtn = row.createEl('button', {
                    cls: 'clickable-icon',
                    attr: { 'aria-label': 'Move up' }
                })
                setIcon(upBtn, 'arrow-up')
                upBtn.disabled = idx === 0
                upBtn.addEventListener('click', () => {
                    moveItem(this.draft.tags, idx, idx - 1)
                    redraw()
                })

                const downBtn = row.createEl('button', {
                    cls: 'clickable-icon',
                    attr: { 'aria-label': 'Move down' }
                })
                setIcon(downBtn, 'arrow-down')
                downBtn.disabled = idx === this.draft.tags.length - 1
                downBtn.addEventListener('click', () => {
                    moveItem(this.draft.tags, idx, idx + 1)
                    redraw()
                })

                const removeBtn = row.createEl('button', {
                    cls: 'clickable-icon gp-tag-remove',
                    attr: { 'aria-label': 'Remove' }
                })
                setIcon(removeBtn, 'x')
                removeBtn.addEventListener('click', () => {
                    this.draft.tags.splice(idx, 1)
                    redraw()
                })
            })
        }
        redraw()

        const addRow = container.createDiv({ cls: 'gp-tag-add' })
        const input = addRow.createEl('input', {
            cls: 'gp-tag-input',
            attr: { type: 'text', placeholder: 'Add a tag' }
        })
        if (this.cachedTags.length > 0) {
            new TagInputSuggest(this.app, input, this.cachedTags)
        }
        const addBtn = addRow.createEl('button', { text: 'Add', cls: 'mod-cta' })
        const commit = (): void => {
            const name = input.value.trim()
            if (!name) return
            if (this.draft.tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
                new Notice('That tag is already in the list.', NOTICE_TIMEOUT_MS)
                return
            }
            const known = this.cachedTags.find((t) => t.name.toLowerCase() === name.toLowerCase())
            const visibility: PresetTagRef['visibility'] =
                known?.visibility === 'internal' ? 'internal' : 'public'
            this.draft.tags.push({ name, visibility })
            input.value = ''
            redraw()
        }
        addBtn.addEventListener('click', commit)
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault()
                commit()
            }
        })
    }

    private renderNewsletterSection(container: HTMLElement): void {
        new Setting(container)
            .setName('Newsletter')
            .setHeading()
            .setDesc(
                'When set, notes that opt into the email flag will trigger this newsletter on first publish.'
            )

        const dropdownSetting = new Setting(container).setName('Newsletter')
        dropdownSetting.addDropdown((d) => {
            d.addOption('', '— none —')
            for (const n of this.cachedNewsletters) {
                d.addOption(n.slug, `${n.name} (${n.slug})`)
            }
            // If the saved slug isn't in the cache, still show it
            if (
                this.draft.newsletterSlug &&
                !this.cachedNewsletters.some((n) => n.slug === this.draft.newsletterSlug)
            ) {
                d.addOption(this.draft.newsletterSlug, `${this.draft.newsletterSlug} (uncached)`)
            }
            d.setValue(this.draft.newsletterSlug)
            d.onChange((v) => (this.draft.newsletterSlug = v))
        })

        if (this.cachedNewsletters.length === 0) {
            container.createEl('p', {
                text: 'No newsletters cached. Use the "Refresh tags & newsletters" button in the main settings page to populate this dropdown.',
                cls: 'gp-hint'
            })
        }
    }
}

function clonePreset(p: Preset): Preset {
    return {
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        tags: p.tags.map((t) => ({ name: t.name, visibility: t.visibility })),
        newsletterSlug: p.newsletterSlug,
        ghostStatus: p.ghostStatus,
        canonicalUrlEnabled: p.canonicalUrlEnabled,
        listingNoteEnabled: p.listingNoteEnabled,
        listingNotePath: p.listingNotePath
    }
}

function moveItem<T>(arr: T[], from: number, to: number): void {
    if (to < 0 || to >= arr.length) return
    const item = arr[from]
    if (item === undefined) return
    arr.splice(from, 1)
    arr.splice(to, 0, item)
}
