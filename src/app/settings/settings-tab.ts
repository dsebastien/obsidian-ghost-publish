import { Notice, PluginSettingTab, Setting, setIcon } from 'obsidian'
import type { App } from 'obsidian'
import { produce } from 'immer'
import type { Draft } from 'immer'
import type { GhostPublishPlugin } from '../plugin'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { DEFAULT_FRONTMATTER } from '../types/plugin-settings.intf'
import { newPreset } from '../types/preset.intf'
import type { Preset } from '../types/preset.intf'
import { refreshGhostMetadata } from '../services/ghost-metadata-cache'
import { PresetEditorModal } from './preset-editor-modal'
import { ConfirmModal } from './confirm-modal'
import { BUY_ME_A_COFFEE_BADGE_DATA_URL } from '../assets/buy-me-a-coffee'
import { log } from '../../utils/log'
import { NOTICE_TIMEOUT_MS } from '../constants'

export class GhostPublishSettingTab extends PluginSettingTab {
    plugin: GhostPublishPlugin

    constructor(app: App, plugin: GhostPublishPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    // `display()` is deprecated since Obsidian 1.13.0 in favour of the
    // declarative `getSettingDefinitions()` API, but the docs explicitly keep
    // it as the supported fallback for plugins targeting older versions. We
    // keep overriding it as our render entry point, but route every internal
    // re-render through `renderSettings()` so we never *access* the deprecated
    // member ourselves.
    override display(): void {
        this.renderSettings()
    }

    private renderSettings(): void {
        const { containerEl } = this
        containerEl.empty()

        this.renderGhost(containerEl)
        this.renderCanonicalSection(containerEl)
        this.renderTriageSection(containerEl)
        this.renderContentSection(containerEl)
        this.renderFrontmatterSection(containerEl)
        this.renderCacheSection(containerEl)
        this.renderPresetsSection(containerEl)
        this.renderAdvancedSection(containerEl)
        this.renderSupportSection(containerEl)
    }

    // NOTE: This helper must NOT be named `update`. Obsidian's settings
    // framework (new settings window, 1.9+) calls `update()` on every
    // registered SettingTab during `addSettingTab`, with no arguments. A
    // method named `update` here shadows that internal call, so Immer's
    // `produce` receives an `undefined` recipe and throws
    // "[Immer] The first or second argument to `produce` must be a function".
    private mutateSettings(mutator: (draft: Draft<PluginSettings>) => void): void {
        this.plugin.settings = produce(this.plugin.settings, mutator)
        void this.plugin.saveSettings()
    }

    // ─── Ghost connection ──────────────────────────────────────────────────

    private renderGhost(container: HTMLElement): void {
        new Setting(container).setName('Ghost').setHeading()

        new Setting(container)
            .setName('Ghost URL')
            .setDesc('Base URL of your Ghost site, e.g. https://example.ghost.io.')
            .addText((text) => {
                text.setPlaceholder('https://example.ghost.io')
                    .setValue(this.plugin.settings.ghostUrl)
                    .onChange((value) =>
                        this.mutateSettings((d) => {
                            d.ghostUrl = value.trim().replace(/\/+$/, '')
                        })
                    )
            })

        new Setting(container)
            .setName('Ghost Admin API key')
            .setDesc(
                'Format: id:secret. Falls back to the GHOST_ADMIN_KEY environment variable when empty. Create one in Ghost Admin → Settings → Integrations.'
            )
            .addText((text) => {
                text.inputEl.type = 'password'
                text.setPlaceholder('id:secret')
                    .setValue(this.plugin.settings.ghostAdminKey)
                    .onChange((value) =>
                        this.mutateSettings((d) => {
                            d.ghostAdminKey = value.trim()
                        })
                    )
            })
    }

    // ─── Canonical URL ─────────────────────────────────────────────────────

    private renderCanonicalSection(container: HTMLElement): void {
        new Setting(container).setName('Public mirror (optional)').setHeading()

        new Setting(container)
            .setName('Notes base URL')
            .setDesc(
                'Public URL of a mirror that exposes your vault notes. Required for any preset that sets canonical_url, and for resolving [[wikilinks]] to public URLs.'
            )
            .addText((text) => {
                text.setPlaceholder('https://notes.example.com')
                    .setValue(this.plugin.settings.notesBaseUrl)
                    .onChange((value) =>
                        this.mutateSettings((d) => {
                            d.notesBaseUrl = value.trim().replace(/\/+$/, '')
                        })
                    )
            })
    }

    // ─── Triage ────────────────────────────────────────────────────────────

    private renderTriageSection(container: HTMLElement): void {
        new Setting(container).setName('Triage').setHeading()

        new Setting(container)
            .setName('Excluded folders')
            .setDesc('One per line. Notes under these prefixes never appear as triage candidates.')
            .addTextArea((area) => {
                area.inputEl.rows = 4
                area.inputEl.addClass('gp-textarea')
                area.setValue(this.plugin.settings.excludedFolders.join('\n')).onChange((v) =>
                    this.mutateSettings((d) => {
                        d.excludedFolders = splitLines(v)
                    })
                )
            })

        new Setting(container)
            .setName('MoC tag')
            .setDesc(
                'Frontmatter / inline tag that marks Map-of-Content notes (excluded from triage). Leave empty to disable.'
            )
            .addText((text) =>
                text
                    .setPlaceholder('type/map/moc')
                    .setValue(this.plugin.settings.mocTag)
                    .onChange((v) =>
                        this.mutateSettings((d) => {
                            d.mocTag = v.trim()
                        })
                    )
            )
    }

    // ─── Content processing ────────────────────────────────────────────────

    private renderContentSection(container: HTMLElement): void {
        new Setting(container).setName('Content processing').setHeading()

        new Setting(container)
            .setName('Strip sections')
            .setDesc(
                'H2 section titles to remove before publishing. One per line. Comparison is case- and punctuation-insensitive.'
            )
            .addTextArea((area) => {
                area.inputEl.rows = 4
                area.inputEl.addClass('gp-textarea')
                area.setValue(this.plugin.settings.stripSections.join('\n')).onChange((v) =>
                    this.mutateSettings((d) => {
                        d.stripSections = splitLines(v)
                    })
                )
            })

        new Setting(container)
            .setName('Known URL map')
            .setDesc(
                'Maps wikilink targets to canonical external URLs. Format: NoteName=https://… on each line. Wins over vault lookup.'
            )
            .addTextArea((area) => {
                area.inputEl.rows = 5
                area.inputEl.addClass('gp-textarea')
                area.setValue(serializeKnownUrls(this.plugin.settings.knownUrls)).onChange((v) =>
                    this.mutateSettings((d) => {
                        d.knownUrls = parseKnownUrls(v)
                    })
                )
            })
    }

    // ─── Frontmatter property names ────────────────────────────────────────

    private renderFrontmatterSection(container: HTMLElement): void {
        new Setting(container)
            .setName('Frontmatter properties')
            .setHeading()
            .setDesc(
                'Customise the property names the plugin reads and writes on each note. All presets share these names.'
            )

        const fieldDefs: { key: keyof typeof DEFAULT_FRONTMATTER; label: string; desc: string }[] =
            [
                {
                    key: 'eligibility',
                    label: 'Eligibility',
                    desc: 'Optional. Notes need this property set to true to appear as triage candidates. Leave empty to make every markdown note eligible.'
                },
                {
                    key: 'preset',
                    label: 'Preset id',
                    desc: 'Stores which preset published the note.'
                },
                { key: 'flag', label: 'Flag', desc: "true once a note is in a preset's queue." },
                {
                    key: 'ignoreFlag',
                    label: 'Ignore flag',
                    desc: 'true to permanently hide a note from triage.'
                },
                {
                    key: 'emailFlag',
                    label: 'Email flag',
                    desc: "true to opt into the preset's newsletter on first publish."
                },
                {
                    key: 'syncedAt',
                    label: 'Synced at',
                    desc: 'Timestamp of the last successful sync.'
                },
                {
                    key: 'ghostId',
                    label: 'Ghost id',
                    desc: 'Ghost post id; enables idempotent updates.'
                },
                {
                    key: 'contentHash',
                    label: 'Content hash',
                    desc: 'SHA-256 of the body; unchanged notes skip the Ghost round-trip.'
                },
                {
                    key: 'emailedAt',
                    label: 'Emailed at',
                    desc: 'Timestamp of newsletter dispatch.'
                },
                {
                    key: 'excerpt',
                    label: 'Excerpt',
                    desc: 'Optional. Overrides the auto-derived Ghost custom_excerpt.'
                }
            ]
        for (const f of fieldDefs) {
            new Setting(container)
                .setName(f.label)
                .setDesc(f.desc)
                .addText((text) =>
                    text
                        .setPlaceholder(DEFAULT_FRONTMATTER[f.key])
                        .setValue(this.plugin.settings.frontmatter[f.key])
                        .onChange((v) =>
                            this.mutateSettings((d) => {
                                d.frontmatter[f.key] = v.trim()
                            })
                        )
                )
        }
    }

    // ─── Cache refresh ─────────────────────────────────────────────────────

    private renderCacheSection(container: HTMLElement): void {
        new Setting(container).setName('Tags & newsletters cache').setHeading()

        const tagsStamp = formatTimestamp(this.plugin.settings.tagsFetchedAt)
        const newsStamp = formatTimestamp(this.plugin.settings.newslettersFetchedAt)
        const counts = `${this.plugin.settings.cachedTags.length} tags, ${this.plugin.settings.cachedNewsletters.length} newsletters cached.`

        new Setting(container)
            .setName('Cache state')
            .setDesc(`${counts} Tags fetched ${tagsStamp}. Newsletters fetched ${newsStamp}.`)
            .addButton((b) => {
                b.setButtonText('Refresh tags & newsletters')
                b.setCta()
                b.onClick(async () => {
                    b.setDisabled(true)
                    b.setButtonText('Refreshing…')
                    try {
                        const result = await refreshGhostMetadata(this.plugin.settings)
                        this.mutateSettings((d) => {
                            d.cachedTags = result.tags
                            d.cachedNewsletters = result.newsletters
                            d.tagsFetchedAt = result.fetchedAt
                            d.newslettersFetchedAt = result.fetchedAt
                        })
                        new Notice(
                            `Cached ${result.tags.length} tags and ${result.newsletters.length} newsletters.`,
                            NOTICE_TIMEOUT_MS
                        )
                        this.renderSettings()
                    } catch (e) {
                        const msg = e instanceof Error ? e.message : String(e)
                        log('Cache refresh failed', 'error', e)
                        new Notice(`Refresh failed: ${msg}`, NOTICE_TIMEOUT_MS)
                        b.setDisabled(false)
                        b.setButtonText('Refresh tags & newsletters')
                    }
                })
            })
    }

    // ─── Presets ───────────────────────────────────────────────────────────

    private renderPresetsSection(container: HTMLElement): void {
        new Setting(container)
            .setName('Presets')
            .setHeading()
            .setDesc(
                'Each preset becomes a tab in the panel. Configure tags, newsletter and publishing options per preset.'
            )

        const presets = this.plugin.settings.presets
        if (presets.length === 0) {
            container.createEl('p', {
                text: 'No presets configured yet.',
                cls: 'gp-empty'
            })
        }

        const list = container.createDiv({ cls: 'gp-preset-list' })
        presets.forEach((preset, idx) => {
            const row = list.createDiv({ cls: 'gp-preset-row' })

            const main = row.createDiv({ cls: 'gp-preset-main' })
            main.createDiv({ text: preset.name, cls: 'gp-preset-name' })
            main.createDiv({
                text: this.summarisePreset(preset),
                cls: 'gp-preset-summary'
            })

            const actions = row.createDiv({ cls: 'gp-preset-actions' })

            const enabledToggle = actions.createEl('button', {
                cls: 'clickable-icon',
                attr: { 'aria-label': preset.enabled ? 'Disable preset' : 'Enable preset' }
            })
            setIcon(enabledToggle, preset.enabled ? 'eye' : 'eye-off')
            enabledToggle.addEventListener('click', () => {
                this.mutateSettings((d) => {
                    const target = d.presets[idx]
                    if (target) target.enabled = !target.enabled
                })
                this.renderSettings()
            })

            const upBtn = actions.createEl('button', {
                cls: 'clickable-icon',
                attr: { 'aria-label': 'Move up' }
            })
            setIcon(upBtn, 'arrow-up')
            upBtn.disabled = idx === 0
            upBtn.addEventListener('click', () => {
                this.mutateSettings((d) => moveItem(d.presets, idx, idx - 1))
                this.renderSettings()
            })

            const downBtn = actions.createEl('button', {
                cls: 'clickable-icon',
                attr: { 'aria-label': 'Move down' }
            })
            setIcon(downBtn, 'arrow-down')
            downBtn.disabled = idx === presets.length - 1
            downBtn.addEventListener('click', () => {
                this.mutateSettings((d) => moveItem(d.presets, idx, idx + 1))
                this.renderSettings()
            })

            const editBtn = actions.createEl('button', { text: 'Edit', cls: 'mod-cta' })
            editBtn.addEventListener('click', () => {
                new PresetEditorModal(
                    this.app,
                    preset,
                    this.plugin.settings.cachedTags,
                    this.plugin.settings.cachedNewsletters,
                    (next) => {
                        this.mutateSettings((d) => {
                            const target = d.presets[idx]
                            if (target) Object.assign(target, next)
                        })
                        this.plugin.refreshView()
                        this.renderSettings()
                    }
                ).open()
            })

            const deleteBtn = actions.createEl('button', {
                text: 'Delete',
                cls: 'mod-warning'
            })
            deleteBtn.addEventListener('click', () => {
                new ConfirmModal(
                    this.app,
                    'Delete preset',
                    `Delete "${preset.name}"? Notes already published under this preset are NOT touched in Ghost.`,
                    () => {
                        this.mutateSettings((d) => {
                            d.presets.splice(idx, 1)
                        })
                        this.plugin.refreshView()
                        this.renderSettings()
                    }
                ).open()
            })
        })

        new Setting(container).addButton((b) => {
            b.setButtonText('Add preset')
            b.setCta()
            b.onClick(() => {
                const fresh = newPreset(generatePresetId(), '')
                new PresetEditorModal(
                    this.app,
                    fresh,
                    this.plugin.settings.cachedTags,
                    this.plugin.settings.cachedNewsletters,
                    (next) => {
                        this.mutateSettings((d) => {
                            d.presets.push(next)
                        })
                        this.plugin.refreshView()
                        this.renderSettings()
                    }
                ).open()
            })
        })
    }

    private summarisePreset(p: Preset): string {
        const parts: string[] = []
        parts.push(p.enabled ? 'enabled' : 'disabled')
        parts.push(`${p.tags.length} tag${p.tags.length === 1 ? '' : 's'}`)
        if (p.newsletterSlug) parts.push(`newsletter: ${p.newsletterSlug}`)
        if (p.canonicalUrlEnabled) parts.push('canonical')
        if (p.listingNoteEnabled) parts.push('listing')
        parts.push(`status: ${p.ghostStatus}`)
        return parts.join(' · ')
    }

    // ─── Advanced ─────────────────────────────────────────────────────────

    private renderAdvancedSection(container: HTMLElement): void {
        new Setting(container).setName('Advanced').setHeading()

        new Setting(container)
            .setName('Skip canonical-URL probe')
            .setDesc(
                'Push to Ghost without verifying the canonical URL is live first. Faster, but a 404 may leak to readers.'
            )
            .addToggle((t) =>
                t.setValue(this.plugin.settings.skipCanonicalProbe).onChange((v) =>
                    this.mutateSettings((d) => {
                        d.skipCanonicalProbe = v
                    })
                )
            )

        new Setting(container)
            .setName('Debug mode')
            .setDesc('Verbose logging in the developer console.')
            .addToggle((t) =>
                t.setValue(this.plugin.settings.debugModeEnabled).onChange((v) =>
                    this.mutateSettings((d) => {
                        d.debugModeEnabled = v
                    })
                )
            )
    }

    // ─── Support ──────────────────────────────────────────────────────────

    private renderSupportSection(container: HTMLElement): void {
        new Setting(container).setName('Support').setHeading()

        const supportDesc = new DocumentFragment()
        supportDesc.createDiv({
            text: 'Buy me a coffee to support the development of this plugin ❤️'
        })
        new Setting(container).setDesc(supportDesc)

        const linkEl = container.createEl('a', {
            href: 'https://www.buymeacoffee.com/dsebastien'
        })
        const imgEl = linkEl.createEl('img')
        imgEl.src = BUY_ME_A_COFFEE_BADGE_DATA_URL
        imgEl.alt = 'Buy me a coffee'
        imgEl.width = 175

        const spacing = container.createDiv()
        spacing.classList.add('support-header-margin')
    }
}

function splitLines(value: string): string[] {
    return value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
}

function serializeKnownUrls(map: Record<string, string>): string {
    return Object.entries(map)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n')
}

function parseKnownUrls(value: string): Record<string, string> {
    const out: Record<string, string> = {}
    for (const line of splitLines(value)) {
        const eq = line.indexOf('=')
        if (eq <= 0) continue
        const key = line.slice(0, eq).trim()
        const val = line.slice(eq + 1).trim()
        if (key && val) out[key] = val
    }
    return out
}

function moveItem<T>(arr: T[], from: number, to: number): void {
    if (to < 0 || to >= arr.length) return
    const item = arr[from]
    if (item === undefined) return
    arr.splice(from, 1)
    arr.splice(to, 0, item)
}

function formatTimestamp(ms: number): string {
    if (!ms) return 'never'
    return new Date(ms).toLocaleString()
}

function generatePresetId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID()
    }
    return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
