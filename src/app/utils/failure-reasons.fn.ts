import type { SyncResult } from '../types/sync-result.intf'

/**
 * Distinct failure reasons of a sync run, most frequent first, each suffixed
 * with the number of notes it hit. Account-level errors (plan limits, bad key)
 * fail every note with the same reason, so grouping keeps the Notice short.
 */
export function summarizeFailureReasons(results: SyncResult[], max = 3): string[] {
    const counts = new Map<string, number>()
    for (const r of results) {
        if (r.status !== 'failed') continue
        const reason = r.reason?.trim() || 'Unknown error'
        counts.set(reason, (counts.get(reason) ?? 0) + 1)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const lines = sorted
        .slice(0, max)
        .map(([reason, n]) => `${reason} (${n} note${n === 1 ? '' : 's'})`)
    const rest = sorted.length - max
    if (rest > 0) {
        lines.push(`…and ${rest} other error${rest === 1 ? '' : 's'}`)
    }
    return lines
}
