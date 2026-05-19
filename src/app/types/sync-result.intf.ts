export type SyncStatus = 'created' | 'updated' | 'recreated' | 'unchanged' | 'skipped' | 'failed'

export interface SyncResult {
    /** Vault-relative path of the synced note. */
    path: string
    status: SyncStatus
    /** Ghost post id, when the sync produced or updated a post. */
    postId?: string
    /** Editor URL in Ghost Admin, when available. */
    editUrl?: string
    /** Reason for `skipped` or `failed`. */
    reason?: string
    /** Whether the newsletter email was dispatched on this sync. */
    emailed?: boolean
}

export interface SyncSummary {
    created: number
    updated: number
    recreated: number
    unchanged: number
    skipped: number
    failed: number
}

export function emptySummary(): SyncSummary {
    return {
        created: 0,
        updated: 0,
        recreated: 0,
        unchanged: 0,
        skipped: 0,
        failed: 0
    }
}
