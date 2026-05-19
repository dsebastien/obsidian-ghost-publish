import type { App, TFile } from 'obsidian'
import type { FrontmatterPropertyNames } from '../types/plugin-settings.intf'
import { COSMETIC_FM } from '../constants'

export type TriageAction = 'publish' | 'publish_email' | 'ignore'

/**
 * Apply a triage decision to a note's frontmatter, recording the chosen
 * preset id alongside the flag. Property names come from PluginSettings.
 */
export async function applyTriageAction(
    app: App,
    file: TFile,
    fm: FrontmatterPropertyNames,
    presetId: string,
    action: TriageAction
): Promise<void> {
    await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        if (action === 'publish' || action === 'publish_email') {
            frontmatter[fm.flag] = true
            frontmatter[fm.preset] = presetId
            delete frontmatter[fm.ignoreFlag]
        }
        if (action === 'publish_email') {
            frontmatter[fm.emailFlag] = true
        }
        if (action === 'ignore') {
            frontmatter[fm.ignoreFlag] = true
            delete frontmatter[fm.flag]
            delete frontmatter[fm.preset]
        }
        if (!frontmatter[COSMETIC_FM.created]) {
            frontmatter[COSMETIC_FM.created] = new Date(file.stat.ctime).toISOString()
        }
        frontmatter[COSMETIC_FM.updated] = new Date().toISOString()
    })
}

/** Remove a note from the queue — keeps the Ghost post intact in Ghost. */
export async function removeFromQueue(
    app: App,
    file: TFile,
    fm: FrontmatterPropertyNames
): Promise<void> {
    await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        delete frontmatter[fm.flag]
        delete frontmatter[fm.emailFlag]
        delete frontmatter[fm.preset]
        frontmatter[COSMETIC_FM.updated] = new Date().toISOString()
    })
}
