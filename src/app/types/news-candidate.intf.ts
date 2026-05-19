import type { TFile } from 'obsidian'

/** A note that is eligible for triage into a preset's publication queue. */
export interface PublicationCandidate {
    file: TFile
    /** Most recently modified timestamp (ms). */
    mtime: number
}

/** A note already opted into a preset and queued for syncing. */
export interface QueuedNote {
    file: TFile
    /** Whether the note opts into the newsletter email on first publish. */
    email: boolean
    /** Whether a Ghost post id is already recorded on the note. */
    hasGhostId: boolean
}

export type TriageRangeId = 'today' | 'week' | 'last14' | 'month' | 'year' | 'all'

export interface TriageRange {
    id: TriageRangeId
    label: string
}

export const TRIAGE_RANGES: TriageRange[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This week' },
    { id: 'last14', label: 'Last 14 days' },
    { id: 'month', label: 'This month' },
    { id: 'year', label: 'This year' },
    { id: 'all', label: 'All time' }
]
