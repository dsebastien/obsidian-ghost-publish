import { Notice, PluginSettingTab, Setting, setIcon } from 'obsidian'
import type { App, SettingDefinitionItem } from 'obsidian'
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
import { BUY_ME_A_COFFEE_URL, renderSupportSection } from '../ui/support-links'

/** The frontmatter property-name fields, all edited as plain text controls. */
const FRONTMATTER_FIELDS: {
    key: keyof typeof DEFAULT_FRONTMATTER
    label: string
    desc: string
}[] = [
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

/**
 * Settings tab, declared rather than rendered (Obsidian 1.13+).
 *
 * `getSettingDefinitions()` REPLACES `display()`: when it returns a non-empty
 * array, `display()` is never called. There is no partial adoption — the whole
 * settings UI is declarative, or none of it. In exchange, Obsidian owns
 * navigation, focus and ARIA, and every declared `name`/`desc` is indexed by
 * the settings search.
 *
 * Rules that each cost a shipped bug somewhere in the plugin collection the
 * first time they were broken (see AGENTS.md "Declarative settings"):
 *
 * - A `render:` hook renders the ROW. Write into `setting.settingEl` only;
 *   anything written outside it (e.g. `group.listEl`) is the framework's to
 *   discard, and the control simply does not appear.
 * - `setControlValue` MUST reject on failure, and validate before writing.
 * - Any render-hosted editor hands `updateSettings` a CLONE taken at call
 *   time, never its live draft (reference-queuing persists post-click edits,
 *   and immer's auto-freeze then freezes the live objects).
 * - Side effects (refreshView) run only AFTER the write lands.
 *
 * The preset list keeps its custom row UI (enable toggle, move, edit-in-modal,
 * confirmed delete) inside a single `render:` row: the native list's delete
 * affordance would bypass the confirmation modal, and its rows cannot carry
 * the per-preset actions. Structural preset actions are serialized behind a
 * latch — each one persists a whole-list edit and the pane re-renders only
 * after the write lands, so a second click on the still-visible old rows
 * would otherwise act on stale indexes.
 */
export class GhostPublishSettingTab extends PluginSettingTab {
    plugin: GhostPublishPlugin

    /**
     * One structural preset action at a time; see the class docs. Dropped on
     * failure; a successful write re-renders the pane, which resets it.
     */
    private presetActionPending = false

    constructor(app: App, plugin: GhostPublishPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    override getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                type: 'group',
                heading: 'Ghost',
                items: [
                    {
                        name: 'Ghost URL',
                        desc: 'Base URL of your Ghost site, e.g. https://example.ghost.io.',
                        control: {
                            type: 'text',
                            key: 'ghostUrl',
                            placeholder: 'https://example.ghost.io'
                        }
                    },
                    {
                        name: 'Ghost Admin API key',
                        desc: 'Format: id:secret. Falls back to the GHOST_ADMIN_KEY environment variable when empty. Create one in Ghost Admin → Settings → Integrations.',
                        // A render: row, not a text control: the declarative
                        // text control cannot render a password input, and the
                        // key must never be shown in clear text.
                        render: (setting): void => {
                            setting.addText((text) => {
                                text.inputEl.type = 'password'
                                text.setPlaceholder('id:secret')
                                    .setValue(this.plugin.settings.ghostAdminKey)
                                    .onChange((value) => {
                                        void this.plugin
                                            .updateSettings((d) => {
                                                d.ghostAdminKey = value.trim()
                                            })
                                            .catch(() => {
                                                new Notice('Failed to save settings.')
                                            })
                                    })
                            })
                        }
                    }
                ]
            },
            {
                type: 'group',
                heading: 'Public mirror (optional)',
                items: [
                    {
                        name: 'Notes base URL',
                        desc: 'Public URL of a mirror that exposes your vault notes. Required for any preset that sets canonical_url, and for resolving [[wikilinks]] to public URLs.',
                        control: {
                            type: 'text',
                            key: 'notesBaseUrl',
                            placeholder: 'https://notes.example.com'
                        }
                    }
                ]
            },
            {
                type: 'group',
                heading: 'Triage',
                items: [
                    {
                        name: 'Excluded folders',
                        desc: 'One per line. Notes under these prefixes never appear as triage candidates.',
                        control: { type: 'textarea', key: 'excludedFolders' }
                    },
                    {
                        name: 'MoC tag',
                        desc: 'Frontmatter / inline tag that marks map-of-content notes (excluded from triage). Leave empty to disable.',
                        control: { type: 'text', key: 'mocTag', placeholder: 'type/map/moc' }
                    }
                ]
            },
            {
                type: 'group',
                heading: 'Content processing',
                items: [
                    {
                        name: 'Strip sections',
                        desc: 'H2 section titles to remove before publishing. One per line. Comparison is case- and punctuation-insensitive.',
                        control: { type: 'textarea', key: 'stripSections' }
                    },
                    {
                        name: 'Known URL map',
                        desc: 'Maps wikilink targets to canonical external URLs. Format: NoteName=https://… on each line. Wins over vault lookup.',
                        control: { type: 'textarea', key: 'knownUrls' }
                    }
                ]
            },
            {
                type: 'group',
                heading: 'Frontmatter properties',
                items: FRONTMATTER_FIELDS.map((f) => ({
                    name: f.label,
                    desc: f.desc,
                    control: {
                        type: 'text' as const,
                        key: `frontmatter.${f.key}`,
                        placeholder: DEFAULT_FRONTMATTER[f.key]
                    }
                }))
            },
            {
                type: 'group',
                heading: 'Tags & newsletters cache',
                items: [
                    {
                        name: 'Cache state',
                        desc: this.describeCacheState(),
                        // Not a setting value — the cache is plugin-owned data
                        // that happens to live in the same store.
                        render: (setting): void => {
                            setting.addButton((b) => {
                                b.setButtonText('Refresh tags & newsletters')
                                b.setCta()
                                b.onClick(() => {
                                    b.setDisabled(true)
                                    b.setButtonText('Refreshing…')
                                    void this.refreshCache().finally(() => {
                                        b.setDisabled(false)
                                        b.setButtonText('Refresh tags & newsletters')
                                    })
                                })
                            })
                        }
                    }
                ]
            },
            {
                type: 'group',
                heading: 'Presets',
                items: [
                    {
                        name: 'Presets',
                        desc: 'Each preset becomes a tab in the panel. Configure tags, newsletter and publishing options per preset.',
                        searchable: false,
                        render: (setting): void => {
                            setting.infoEl.remove() // the editor draws its own copy
                            // `.setting-item` is a flex ROW; the preset list is
                            // a stack of full-width rows.
                            setting.settingEl.addClass('gp-settings-embed')
                            this.renderPresetsEditor(setting.settingEl)
                        }
                    }
                ]
            },
            {
                type: 'group',
                heading: 'Advanced',
                items: [
                    {
                        name: 'Skip canonical-URL probe',
                        desc: 'Push to Ghost without verifying the canonical URL is live first. Faster, but a 404 may leak to readers.',
                        control: { type: 'toggle', key: 'skipCanonicalProbe' }
                    },
                    {
                        name: 'Debug mode',
                        desc: 'Verbose logging in the developer console.',
                        control: { type: 'toggle', key: 'debugModeEnabled' }
                    }
                ]
            },
            {
                type: 'group',
                // No heading: renderSupportSection draws its own.
                items: [
                    {
                        name: 'Support',
                        // Not a setting — keep it out of the settings search.
                        searchable: false,
                        render: (setting): void => {
                            setting.infoEl.remove() // the section draws its own headings
                            // `.setting-item` is a flex ROW. The support block
                            // is a stack of full-width rows, so without this it
                            // would lay heading, buttons and badge side by side.
                            setting.settingEl.addClass('gp-settings-embed')
                            renderSupportSection(setting.settingEl, (el) => {
                                const linkEl = el.createEl('a', {
                                    href: BUY_ME_A_COFFEE_URL
                                })
                                const imgEl = linkEl.createEl('img')
                                imgEl.src = BUY_ME_A_COFFEE_BADGE_DATA_URL
                                imgEl.alt = 'Buy me a coffee'
                                imgEl.width = 175
                            })
                        }
                    }
                ]
            }
        ]
    }

    /**
     * Reads the value behind a control `key`. Returning undefined/null makes
     * the framework fall back to the control's declared `defaultValue`.
     *
     * List- and map-shaped settings are edited through textareas, so they
     * serialize here and parse in `setControlValue`.
     */
    override getControlValue(key: string): unknown {
        if (key.startsWith('frontmatter.')) {
            const field = key.slice('frontmatter.'.length) as keyof PluginSettings['frontmatter']
            return this.plugin.settings.frontmatter[field]
        }
        switch (key) {
            case 'ghostUrl':
                return this.plugin.settings.ghostUrl
            case 'notesBaseUrl':
                return this.plugin.settings.notesBaseUrl
            case 'mocTag':
                return this.plugin.settings.mocTag
            case 'excludedFolders':
                return this.plugin.settings.excludedFolders.join('\n')
            case 'stripSections':
                return this.plugin.settings.stripSections.join('\n')
            case 'knownUrls':
                return serializeKnownUrls(this.plugin.settings.knownUrls)
            case 'skipCanonicalProbe':
                return this.plugin.settings.skipCanonicalProbe
            case 'debugModeEnabled':
                return this.plugin.settings.debugModeEnabled
            default:
                return undefined
        }
    }

    /**
     * Persists a control edit. Rejecting (not resolving) on failure is what
     * lets the framework roll the control back to the stored truth.
     */
    override async setControlValue(key: string, value: unknown): Promise<void> {
        if (key.startsWith('frontmatter.')) {
            const field = key.slice('frontmatter.'.length)
            if (!FRONTMATTER_FIELDS.some((f) => f.key === field)) {
                new Notice('Failed to save settings.')
                throw new Error(`Setting "${key}" does not address a known field.`)
            }
            const next = this.expectString(key, value).trim()
            await this.plugin.updateSettings((d) => {
                d.frontmatter[field as keyof PluginSettings['frontmatter']] = next
            })
            return
        }
        switch (key) {
            case 'ghostUrl': {
                const next = this.expectString(key, value).trim().replace(/\/+$/, '')
                await this.plugin.updateSettings((d) => {
                    d.ghostUrl = next
                })
                return
            }
            case 'notesBaseUrl': {
                const next = this.expectString(key, value).trim().replace(/\/+$/, '')
                await this.plugin.updateSettings((d) => {
                    d.notesBaseUrl = next
                })
                return
            }
            case 'mocTag': {
                const next = this.expectString(key, value).trim()
                await this.plugin.updateSettings((d) => {
                    d.mocTag = next
                })
                return
            }
            case 'excludedFolders': {
                const next = splitLines(this.expectString(key, value))
                await this.plugin.updateSettings((d) => {
                    d.excludedFolders = next
                })
                return
            }
            case 'stripSections': {
                const next = splitLines(this.expectString(key, value))
                await this.plugin.updateSettings((d) => {
                    d.stripSections = next
                })
                return
            }
            case 'knownUrls': {
                const next = parseKnownUrls(this.expectString(key, value))
                await this.plugin.updateSettings((d) => {
                    d.knownUrls = next
                })
                return
            }
            case 'skipCanonicalProbe': {
                const next = this.expectBoolean(key, value)
                await this.plugin.updateSettings((d) => {
                    d.skipCanonicalProbe = next
                })
                return
            }
            case 'debugModeEnabled': {
                const next = this.expectBoolean(key, value)
                await this.plugin.updateSettings((d) => {
                    d.debugModeEnabled = next
                })
                return
            }
            default:
                new Notice('Failed to save settings.')
                throw new Error(`Setting "${key}" does not address a known field.`)
        }
    }

    /** Rejects rather than coerces: a bad value must not reach the store. */
    private expectBoolean(key: string, value: unknown): boolean {
        if (typeof value !== 'boolean') {
            throw new Error(`Setting "${key}" expects a boolean.`)
        }
        return value
    }

    /** Rejects rather than coerces: a bad value must not reach the store. */
    private expectString(key: string, value: unknown): string {
        if (typeof value !== 'string') {
            throw new Error(`Setting "${key}" expects a string.`)
        }
        return value
    }

    // ─── Cache refresh ─────────────────────────────────────────────────────

    private describeCacheState(): string {
        const tagsStamp = formatTimestamp(this.plugin.settings.tagsFetchedAt)
        const newsStamp = formatTimestamp(this.plugin.settings.newslettersFetchedAt)
        const counts = `${this.plugin.settings.cachedTags.length} tags, ${this.plugin.settings.cachedNewsletters.length} newsletters cached.`
        return `${counts} Tags fetched ${tagsStamp}. Newsletters fetched ${newsStamp}.`
    }

    /**
     * Fetches tags + newsletters from Ghost and persists them. Extracted from
     * the button so the write path is testable without a DOM. Re-renders only
     * after a successful persist.
     */
    async refreshCache(): Promise<void> {
        try {
            const result = await refreshGhostMetadata(this.plugin.settings)
            await this.plugin.updateSettings((d) => {
                d.cachedTags = result.tags
                d.cachedNewsletters = result.newsletters
                d.tagsFetchedAt = result.fetchedAt
                d.newslettersFetchedAt = result.fetchedAt
            })
            new Notice(
                `Cached ${result.tags.length} tags and ${result.newsletters.length} newsletters.`,
                NOTICE_TIMEOUT_MS
            )
            this.update()
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            log('Cache refresh failed', 'error', e)
            new Notice(`Refresh failed: ${msg}`, NOTICE_TIMEOUT_MS)
        }
    }

    // ─── Presets ───────────────────────────────────────────────────────────

    /**
     * Persist a structural preset edit, then refresh the view and re-render.
     * Serialized behind the latch (see class docs); on failure the pane keeps
     * its current state and the click can be retried.
     */
    private commitPresets(mutator: (presets: Preset[]) => void): void {
        if (this.presetActionPending) {
            return
        }
        this.presetActionPending = true
        void this.plugin
            .updateSettings((d) => {
                mutator(d.presets)
            })
            .then(() => {
                this.plugin.refreshView()
                this.presetActionPending = false
                this.update()
            })
            .catch(() => {
                this.presetActionPending = false
                new Notice('Failed to save settings.')
            })
    }

    private renderPresetsEditor(container: HTMLElement): void {
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
                this.commitPresets((drafts) => {
                    const target = drafts[idx]
                    if (target) target.enabled = !target.enabled
                })
            })

            const upBtn = actions.createEl('button', {
                cls: 'clickable-icon',
                attr: { 'aria-label': 'Move up' }
            })
            setIcon(upBtn, 'arrow-up')
            upBtn.disabled = idx === 0
            upBtn.addEventListener('click', () => {
                this.commitPresets((drafts) => moveItem(drafts, idx, idx - 1))
            })

            const downBtn = actions.createEl('button', {
                cls: 'clickable-icon',
                attr: { 'aria-label': 'Move down' }
            })
            setIcon(downBtn, 'arrow-down')
            downBtn.disabled = idx === presets.length - 1
            downBtn.addEventListener('click', () => {
                this.commitPresets((drafts) => moveItem(drafts, idx, idx + 1))
            })

            const editBtn = actions.createEl('button', { text: 'Edit', cls: 'mod-cta' })
            editBtn.addEventListener('click', () => {
                new PresetEditorModal(
                    this.app,
                    preset,
                    this.plugin.settings.cachedTags,
                    this.plugin.settings.cachedNewsletters,
                    (next) => {
                        // `next` is the modal's own clone, never a live
                        // reference (see PresetEditorModal docs).
                        this.commitPresets((drafts) => {
                            const target = drafts[idx]
                            if (target) Object.assign(target, next)
                        })
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
                        this.commitPresets((drafts) => {
                            drafts.splice(idx, 1)
                        })
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
                        this.commitPresets((drafts) => {
                            drafts.push(next)
                        })
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
