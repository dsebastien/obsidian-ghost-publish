import { ItemView, setIcon } from 'obsidian'
import type { WorkspaceLeaf } from 'obsidian'
import type { GhostPublishPlugin } from '../plugin'
import { VIEW_TYPE_GHOST_PUBLISH, VIEW_ICON } from '../constants'
import { DEFAULT_VIEW_STATE } from './view-state'
import type { SubTab, ViewState } from './view-state'
import { renderTriagePage } from './pages/triage-page'
import { renderQueuePage } from './pages/queue-page'
import { renderRecentlyPublishedPage } from './pages/recently-published-page'
import { renderEmptyState } from './pages/empty-state-page'
import { resolveAdminKey } from '../services/publish-service'
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

    refresh(): void {
        this.render()
    }

    override async onOpen(): Promise<void> {
        this.render()
    }

    override async onClose(): Promise<void> {
        this.contentEl.empty()
    }

    private render(): void {
        const { contentEl } = this
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

        // Ensure active preset is still valid
        if (!enabledPresets.some((p) => p.id === this.state.activePresetId)) {
            this.state.activePresetId = enabledPresets[0]!.id
        }
        const activePreset = enabledPresets.find((p) => p.id === this.state.activePresetId)!

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

        const content = contentEl.createDiv({ cls: 'gp-view-content' })

        switch (this.state.activeSubTab) {
            case 'triage':
                renderTriagePage(
                    content,
                    this.app,
                    this.plugin,
                    activePreset,
                    this.state.triageRange,
                    (range) => this.setTriageRange(range),
                    () => this.refresh()
                )
                break
            case 'queue':
                renderQueuePage(content, this.app, this.plugin, activePreset, () => this.refresh())
                break
            case 'recent':
                renderRecentlyPublishedPage(content, this.app, this.plugin, activePreset)
                break
        }
    }

    private missingGlobalConfig(): string[] {
        const s = this.plugin.settings
        const missing: string[] = []
        if (!s.ghostUrl.trim()) missing.push('Ghost URL')
        if (!resolveAdminKey(s)) missing.push('Admin API key')
        return missing
    }
}
