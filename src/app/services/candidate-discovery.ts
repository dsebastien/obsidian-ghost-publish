import type { App, TFile } from 'obsidian'
import type { PluginSettings } from '../types/plugin-settings.intf'
import type { PublicationCandidate, QueuedNote, TriageRangeId } from '../types/news-candidate.intf'

/**
 * Convert a triage range id into a unix-ms epoch threshold. mtime ≥ threshold
 * makes a file a candidate.
 */
export function triageRangeToSince(rangeId: TriageRangeId, now: Date = new Date()): number {
    const d = new Date(now)
    switch (rangeId) {
        case 'today':
            d.setHours(0, 0, 0, 0)
            return d.getTime()
        case 'week': {
            const dow = d.getDay()
            const offsetToMonday = (dow + 6) % 7
            d.setDate(d.getDate() - offsetToMonday)
            d.setHours(0, 0, 0, 0)
            return d.getTime()
        }
        case 'last14':
            d.setDate(d.getDate() - 14)
            d.setHours(0, 0, 0, 0)
            return d.getTime()
        case 'month':
            d.setDate(1)
            d.setHours(0, 0, 0, 0)
            return d.getTime()
        case 'year':
            d.setMonth(0, 1)
            d.setHours(0, 0, 0, 0)
            return d.getTime()
        case 'all':
            return 0
    }
}

/**
 * Notes eligible for triage:
 *   - satisfy the optional eligibility frontmatter gate;
 *   - not already opted into ANY preset (flag is unset);
 *   - not ignored;
 *   - within the selected time range;
 *   - not excluded by folder, MoC, or filename.
 */
export function findCandidates(
    app: App,
    settings: PluginSettings,
    rangeId: TriageRangeId
): PublicationCandidate[] {
    const since = triageRangeToSince(rangeId)
    const fm = settings.frontmatter
    const out: PublicationCandidate[] = []
    for (const file of app.vault.getMarkdownFiles()) {
        const cache = app.metadataCache.getFileCache(file)
        const front = (cache?.frontmatter ?? {}) as Record<string, unknown>
        if (fm.eligibility && front[fm.eligibility] !== true) continue
        if (front[fm.flag] === true) continue
        if (front[fm.ignoreFlag] === true) continue
        if (file.stat.mtime < since) continue
        if (isExcluded(app, file, settings)) continue
        out.push({ file, mtime: file.stat.mtime })
    }
    out.sort((a, b) => b.mtime - a.mtime)
    return out
}

/** Notes already opted into a specific preset — what `publishAllForPreset` syncs. */
export function findQueuedNotesForPreset(
    app: App,
    settings: PluginSettings,
    presetId: string
): QueuedNote[] {
    const fm = settings.frontmatter
    const out: QueuedNote[] = []
    for (const file of app.vault.getMarkdownFiles()) {
        const cache = app.metadataCache.getFileCache(file)
        const front = (cache?.frontmatter ?? {}) as Record<string, unknown>
        if (front[fm.flag] !== true) continue
        if (front[fm.ignoreFlag] === true) continue
        if (front[fm.preset] !== presetId) continue
        out.push({
            file,
            email: front[fm.emailFlag] === true,
            hasGhostId:
                typeof front[fm.ghostId] === 'string' && (front[fm.ghostId] as string).length > 0
        })
    }
    out.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime)
    return out
}

function isExcluded(app: App, file: TFile, settings: PluginSettings): boolean {
    for (const prefix of settings.excludedFolders) {
        if (!prefix) continue
        if (file.path.startsWith(prefix)) return true
    }
    if (file.basename.endsWith(' (MoC)')) return true
    if (settings.mocTag) {
        const cache = app.metadataCache.getFileCache(file)
        const fmTags = cache?.frontmatter?.['tags']
        const tags = Array.isArray(fmTags)
            ? (fmTags as unknown[])
            : typeof fmTags === 'string'
              ? [fmTags]
              : []
        if (tags.includes(settings.mocTag)) return true
        const inline = cache?.tags ?? []
        if (inline.some((t) => t.tag === `#${settings.mocTag}`)) return true
    }
    return false
}
