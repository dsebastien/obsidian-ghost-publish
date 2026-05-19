import type { TriageRangeId } from '../types/news-candidate.intf'

export type SubTab = 'triage' | 'queue' | 'recent'

/**
 * The panel's selection state: which preset is active, which sub-tab is
 * shown, and the current triage range.
 */
export interface ViewState {
    /** Preset id selected as the active top-level tab. Empty = empty state. */
    activePresetId: string
    activeSubTab: SubTab
    triageRange: TriageRangeId
}

export const DEFAULT_VIEW_STATE: ViewState = {
    activePresetId: '',
    activeSubTab: 'triage',
    triageRange: 'last14'
}
