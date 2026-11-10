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

/**
 * True when cached frontmatter already reflects a triage action. Used to
 * keep an optimistically hidden card hidden until the metadataCache catches up.
 */
export function isTriageActionApplied(
    front: Record<string, unknown>,
    fm: FrontmatterPropertyNames,
    presetId: string,
    action: TriageAction
): boolean {
    if (action === 'ignore') return front[fm.ignoreFlag] === true && front[fm.flag] !== true
    const queued = front[fm.flag] === true && front[fm.preset] === presetId
    return action === 'publish_email' ? queued && front[fm.emailFlag] === true : queued
}

/** True when cached frontmatter shows the note is no longer queued. */
export function isRemovedFromQueue(
    front: Record<string, unknown>,
    fm: FrontmatterPropertyNames
): boolean {
    return front[fm.flag] !== true
}
