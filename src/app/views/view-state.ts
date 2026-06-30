import type { TriageRangeId } from '../types/news-candidate.intf'

export type SubTab = 'triage' | 'queue' | 'recent'

/**
 * The panel's selection state: which preset is active, which sub-tab is
 * shown, the triage range, and which optional list filters are applied.
 *
 * Filter state is panel-local (in-memory) rather than persisted to plugin
 * settings — each panel-open starts with the defaults below.
 */
export interface ViewState {
    /** Preset id selected as the active top-level tab. Empty = empty state. */
    activePresetId: string
    activeSubTab: SubTab
    triageRange: TriageRangeId
    /**
     * When true, the Queue tab hides notes that already have a Ghost id (the
     * "Synced" badge) — so the queue defaults to a punch-list of what's
     * actually left to do. Toggle is in the queue's summary bar.
     *
     * The Sync button is unaffected: it always operates on every queued
     * note regardless of this filter.
     */
    queueHideSynced: boolean
    /**
     * Free-text search applied to the active sub-tab's list (triage / queue /
     * recent). Filters by note title + vault path with typo-tolerant fuzzy
     * matching. Persists across sub-tab switches so one query can be carried
     * between views. Never affects the queue's Sync button.
     */
    searchQuery: string
}

export const DEFAULT_VIEW_STATE: ViewState = {
    activePresetId: '',
    activeSubTab: 'triage',
    triageRange: 'last14',
    queueHideSynced: true,
    searchQuery: ''
}
