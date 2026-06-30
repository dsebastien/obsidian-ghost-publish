import { ItemView, setIcon } from 'obsidian'
import type { WorkspaceLeaf } from 'obsidian'
import type { GhostPublishPlugin } from '../plugin'
import { VIEW_TYPE_GHOST_PUBLISH, VIEW_ICON, SEARCH_RENDER_DEBOUNCE_MS } from '../constants'
import { DEFAULT_VIEW_STATE } from './view-state'
import type { SubTab, ViewState } from './view-state'
import { renderTriagePage } from './pages/triage-page'
import { renderQueuePage } from './pages/queue-page'
import { renderRecentlyPublishedPage } from './pages/recently-published-page'
import { renderEmptyState } from './pages/empty-state-page'
import { resolveAdminKey } from '../services/publish-service'
import type { Preset } from '../types/preset.intf'
import type { TriageRangeId } from '../types/news-candidate.intf'

interface SubTabDef {
    id: SubTab
    label: string
}

const SUB_TABS: SubTabDef[] = [
    { id: 'triage', label: 'Triage' },
    { id: 'queue', label: 'Queue' },
    { id: 'recent', label: 'Recently published' }
]

export class GhostPublishView extends ItemView {
    private readonly plugin: GhostPublishPlugin
    private state: ViewState = { ...DEFAULT_VIEW_STATE }
    /** Pending debounced content re-render scheduled by the search box. */
    private searchRenderTimer: number | null = null

    constructor(leaf: WorkspaceLeaf, plugin: GhostPublishPlugin) {
        super(leaf)
        this.plugin = plugin
    }

    override getViewType(): string {
        return VIEW_TYPE_GHOST_PUBLISH
    }

    override getDisplayText(): string {
        return 'Ghost Publish'
    }

    override getIcon(): string {
        return VIEW_ICON
    }

    setActivePreset(presetId: string): void {
        this.state = { ...this.state, activePresetId: presetId }
        this.render()
    }

    setSubTab(tab: SubTab): void {
        this.state = { ...this.state, activeSubTab: tab }
        this.render()
    }

    setTriageRange(range: TriageRangeId): void {
        this.state = { ...this.state, triageRange: range }
        this.render()
    }

    setQueueHideSynced(hide: boolean): void {
        this.state = { ...this.state, queueHideSynced: hide }
        this.render()
    }

    refresh(): void {
        this.render()
    }

    override async onOpen(): Promise<void> {
        this.render()
    }

    override async onClose(): Promise<void> {
        if (this.searchRenderTimer !== null) {
            window.clearTimeout(this.searchRenderTimer)
            this.searchRenderTimer = null
        }
        this.contentEl.empty()
    }

    private render(): void {
        const { contentEl } = this
        // Preserve scroll position across full re-renders so the manual
        // refresh + sync buttons don't snap the user back to the top.
        const prevScroll = this.snapshotScroll()
        contentEl.empty()
        contentEl.addClass('ghost-publish-view')

        const header = contentEl.createDiv({ cls: 'gp-view-header' })

        const titleRow = header.createDiv({ cls: 'gp-title-row' })
        titleRow.createSpan({ text: 'Ghost Publish', cls: 'gp-title' })

        const refreshBtn = titleRow.createEl('button', {
            cls: 'gp-refresh-btn clickable-icon',
            attr: { 'aria-label': 'Refresh' }
        })
        setIcon(refreshBtn, 'refresh-cw')
        refreshBtn.addEventListener('click', () => this.refresh())

        // Configuration gate
        const missing = this.missingGlobalConfig()
        if (missing.length > 0) {
            const body = contentEl.createDiv({ cls: 'gp-view-content' })
            renderEmptyState(
                body,
                this.plugin,
                'Connect to Ghost to get started',
                `Configure Ghost URL and Admin API key in settings. Missing: ${missing.join(', ')}.`
            )
            return
        }

        const enabledPresets = this.plugin.settings.presets.filter((p) => p.enabled)
        if (enabledPresets.length === 0) {
            const body = contentEl.createDiv({ cls: 'gp-view-content' })
            renderEmptyState(
                body,
                this.plugin,
                'No presets configured',
                'Presets define which tags, newsletter and publishing options to use. Create one to start publishing notes to Ghost.'
            )
            return
        }

        const activePreset = this.resolveActivePreset(enabledPresets)

        // Preset tabs
        const presetTabs = header.createDiv({ cls: 'gp-tabs gp-preset-tabs' })
        for (const preset of enabledPresets) {
            const isActive = preset.id === activePreset.id
            const btn = presetTabs.createEl('button', {
                text: preset.name,
                cls: `gp-tab${isActive ? ' gp-tab-active' : ''}`
            })
            btn.addEventListener('click', () => this.setActivePreset(preset.id))
        }

        // Sub-tabs
        const subTabs = header.createDiv({ cls: 'gp-tabs gp-sub-tabs' })
        for (const tab of SUB_TABS) {
            const isActive = tab.id === this.state.activeSubTab
            const btn = subTabs.createEl('button', {
                text: tab.label,
                cls: `gp-sub-tab${isActive ? ' gp-sub-tab-active' : ''}`
            })
            btn.addEventListener('click', () => this.setSubTab(tab.id))
        }

        // Search box — filters whichever sub-tab list is active. Lives in the
        // header (outside the re-rendered content) so typing never loses focus.
        this.renderSearchBar(header)

        const content = contentEl.createDiv({ cls: 'gp-view-content' })
        this.renderActivePage(content, activePreset)
        this.restoreScroll(prevScroll)
    }

    private renderSearchBar(header: HTMLElement): void {
        const bar = header.createDiv({ cls: 'gp-search-bar' })
        const wrap = bar.createDiv({ cls: 'gp-search-wrap' })

        const icon = wrap.createSpan({ cls: 'gp-search-icon' })
        setIcon(icon, 'search')

        const input = wrap.createEl('input', {
            cls: 'gp-search-input',
            attr: {
                'type': 'search',
                'placeholder': 'Search notes…',
                'aria-label': 'Search notes',
                'spellcheck': 'false'
            }
        })
        input.value = this.state.searchQuery

        const clearBtn = wrap.createEl('button', {
            cls: 'gp-search-clear clickable-icon',
            attr: { 'aria-label': 'Clear search' }
        })
        setIcon(clearBtn, 'x')
        clearBtn.toggleClass('gp-hidden', this.state.searchQuery.length === 0)

        input.addEventListener('input', () => {
            this.state.searchQuery = input.value
            clearBtn.toggleClass('gp-hidden', input.value.length === 0)
            this.scheduleSearchRender()
        })
        clearBtn.addEventListener('click', () => {
            input.value = ''
            this.state.searchQuery = ''
            clearBtn.toggleClass('gp-hidden', true)
            this.rerenderContent()
            input.focus()
        })
    }

    /** Re-render only the content area after a debounce, preserving search focus. */
    private scheduleSearchRender(): void {
        if (this.searchRenderTimer !== null) {
            window.clearTimeout(this.searchRenderTimer)
        }
        this.searchRenderTimer = window.setTimeout(() => {
            this.searchRenderTimer = null
            this.rerenderContent()
        }, SEARCH_RENDER_DEBOUNCE_MS)
    }

    /**
     * Rebuild just `.gp-view-content` (not the header), so the search input
     * keeps focus and caret position while filtering. Falls back to a full
     * render if the content element or active preset can't be resolved.
     */
    private rerenderContent(): void {
        const content = this.contentEl.querySelector('.gp-view-content')
        if (!(content instanceof HTMLElement)) {
            this.render()
            return
        }
        const enabledPresets = this.plugin.settings.presets.filter((p) => p.enabled)
        if (enabledPresets.length === 0 || this.missingGlobalConfig().length > 0) {
            this.render()
            return
        }
        const prevScroll = content.scrollTop
        content.empty()
        this.renderActivePage(content, this.resolveActivePreset(enabledPresets))
        content.scrollTop = prevScroll
    }

    private renderActivePage(content: HTMLElement, activePreset: Preset): void {
        switch (this.state.activeSubTab) {
            case 'triage':
                renderTriagePage(
                    content,
                    this.app,
                    this.plugin,
                    activePreset,
                    this.state.triageRange,
                    this.state.searchQuery,
                    (range) => this.setTriageRange(range)
                )
                break
            case 'queue':
                renderQueuePage(
                    content,
                    this.app,
                    this.plugin,
                    activePreset,
                    this.state.queueHideSynced,
                    this.state.searchQuery,
                    (hide) => this.setQueueHideSynced(hide),
                    () => this.refresh()
                )
                break
            case 'recent':
                renderRecentlyPublishedPage(
                    content,
                    this.app,
                    this.plugin,
                    activePreset,
                    this.state.searchQuery
                )
                break
        }
    }

    /** Resolve (and self-heal) the active preset against the enabled list. */
    private resolveActivePreset(enabledPresets: Preset[]): Preset {
        if (!enabledPresets.some((p) => p.id === this.state.activePresetId)) {
            this.state.activePresetId = enabledPresets[0]!.id
        }
        return enabledPresets.find((p) => p.id === this.state.activePresetId)!
    }

    private missingGlobalConfig(): string[] {
        const s = this.plugin.settings
        const missing: string[] = []
        if (!s.ghostUrl.trim()) missing.push('Ghost URL')
        if (!resolveAdminKey(s)) missing.push('Admin API key')
        return missing
    }

    private snapshotScroll(): number | null {
        const content = this.contentEl.querySelector('.gp-view-content')
        if (!(content instanceof HTMLElement)) return null
        return content.scrollTop
    }

    private restoreScroll(scrollTop: number | null): void {
        if (scrollTop === null) return
        const content = this.contentEl.querySelector('.gp-view-content')
        if (!(content instanceof HTMLElement)) return
        content.scrollTop = scrollTop
    }
}
