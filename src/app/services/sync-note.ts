import type { App, TFile } from 'obsidian'
import type { GhostApiClient } from '../api/ghost-api-client'
import type { PluginSettings } from '../types/plugin-settings.intf'
import type { Preset } from '../types/preset.intf'
import type { SyncResult } from '../types/sync-result.intf'
import { COSMETIC_FM } from '../constants'
import { canonicalProbe } from './canonical-probe'
import { buildLinkMap, substituteWikilinks } from './wikilink-resolver'
import { uploadVaultImages } from './upload-vault-images'
import { buildPostHtml } from './build-html'
import { embedYoutubeUrls } from './embed-youtube'
import { embedLinkUrls } from './embed-links'
import {
    stripDataviewQueries,
    stripLeadingH1,
    stripVaultOnlySections
} from '../utils/strip-sections.fn'
import { processYoutubeEmbeds } from '../utils/process-youtube.fn'
import { processLinkBlocks } from '../utils/process-link-blocks.fn'
import { vaultPathToUrl } from '../utils/vault-path-to-url.fn'
import { deriveExcerpt } from '../utils/derive-excerpt.fn'
import { sha256Hex } from '../utils/content-hash.fn'
import { log } from '../../utils/log'

/**
 * Sync a single note to Ghost under the supplied preset: hash-check →
 * canonical probe (when applicable) → strip/transform body → upload images
 * → markdown → HTML → create / update Ghost post → upgrade YouTube /
 * link-block embeds → optional newsletter dispatch → write metadata back
 * to frontmatter.
 */
export async function syncNote(
    app: App,
    client: GhostApiClient,
    settings: PluginSettings,
    preset: Preset,
    file: TFile
): Promise<SyncResult> {
    const fm = readFrontmatter(app, file)
    const fmKeys = settings.frontmatter

    if (!fm[fmKeys.flag]) {
        return {
            path: file.path,
            status: 'skipped',
            reason: `missing ${fmKeys.flag}`
        }
    }
    if (fm[fmKeys.ignoreFlag]) {
        return { path: file.path, status: 'skipped', reason: `${fmKeys.ignoreFlag} is true` }
    }
    if (typeof fm[fmKeys.preset] === 'string' && fm[fmKeys.preset] !== preset.id) {
        return {
            path: file.path,
            status: 'skipped',
            reason: `note is assigned to a different preset (${String(fm[fmKeys.preset])})`
        }
    }

    const raw = await app.vault.read(file)
    const { body } = splitFrontmatter(raw)

    const useCanonical = preset.canonicalUrlEnabled && settings.notesBaseUrl.trim().length > 0
    const canonicalUrl = useCanonical ? vaultPathToUrl(settings.notesBaseUrl, file.path) : ''

    const fmTitle = fm['title']
    const title = typeof fmTitle === 'string' && fmTitle.trim().length > 0 ? fmTitle : file.basename

    const contentHash = await sha256Hex(body)

    const existingGhostId =
        typeof fm[fmKeys.ghostId] === 'string' ? (fm[fmKeys.ghostId] as string) : ''
    const existingHash =
        typeof fm[fmKeys.contentHash] === 'string' ? (fm[fmKeys.contentHash] as string) : ''

    if (existingGhostId && existingHash === contentHash) {
        await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
            frontmatter[fmKeys.syncedAt] = new Date().toISOString()
        })
        return {
            path: file.path,
            status: 'unchanged',
            postId: existingGhostId,
            editUrl: ghostEditorUrl(settings.ghostUrl, existingGhostId)
        }
    }

    if (useCanonical && !settings.skipCanonicalProbe) {
        const ok = await canonicalProbe(canonicalUrl)
        if (!ok) {
            return {
                path: file.path,
                status: 'skipped',
                reason: `canonical URL not reachable (${canonicalUrl})`
            }
        }
    }

    const linkMap = buildLinkMap(app, file.path, body, {
        notesBaseUrl: settings.notesBaseUrl,
        knownUrls: settings.knownUrls,
        eligibilityKey: fmKeys.eligibility
    })

    let working = body
    working = stripDataviewQueries(working)
    working = stripVaultOnlySections(working, settings.stripSections)
    working = stripLeadingH1(working)

    const yt = processYoutubeEmbeds(working)
    working = yt.markdown
    const youtubeUrls = yt.urls

    const lb = processLinkBlocks(working, linkMap)
    working = lb.markdown
    const linkBlockUrls = lb.urls

    working = await uploadVaultImages(app, client, file.path, working)
    working = substituteWikilinks(working, linkMap)
    working = working.replace(/\n{3,}/g, '\n\n').trim()

    if (!working) {
        return {
            path: file.path,
            status: 'skipped',
            reason: 'note body is empty after stripping'
        }
    }

    const html = buildPostHtml(working, title, canonicalUrl)
    const customExcerpt =
        typeof fm[fmKeys.excerpt] === 'string' && (fm[fmKeys.excerpt] as string).trim().length > 0
            ? (fm[fmKeys.excerpt] as string)
            : deriveExcerpt(working)

    let postId = existingGhostId
    let action: SyncResult['status'] = 'created'
    let shouldEmail = false
    let emailed = false

    const tagsPayload = preset.tags.map((t) => ({ name: t.name, visibility: t.visibility }))

    if (postId) {
        try {
            const existing = await client.getPost(postId)
            const updatePayload: Record<string, unknown> = {
                title,
                html,
                status: preset.ghostStatus,
                tags: tagsPayload,
                custom_excerpt: customExcerpt,
                updated_at: existing.updated_at
            }
            if (useCanonical) updatePayload['canonical_url'] = canonicalUrl
            const updated = await client.updatePost(postId, updatePayload)
            postId = updated.id
            action = 'updated'
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
                log(`Ghost post ${postId} not found, will recreate`, 'warn')
                postId = ''
                action = 'recreated'
            } else {
                throw e
            }
        }
    }

    if (!postId) {
        shouldEmail =
            preset.newsletterSlug.trim().length > 0 &&
            fm[fmKeys.emailFlag] === true &&
            !fm[fmKeys.emailedAt]
        const createPayload: Record<string, unknown> = {
            title,
            html,
            status: shouldEmail ? 'draft' : preset.ghostStatus,
            tags: tagsPayload,
            custom_excerpt: customExcerpt
        }
        if (useCanonical) createPayload['canonical_url'] = canonicalUrl
        const created = await client.createPost(createPayload)
        postId = created.id
        if (action !== 'recreated') action = 'created'
    }

    if (youtubeUrls.length > 0) {
        try {
            await embedYoutubeUrls(client, postId, youtubeUrls)
        } catch (e) {
            log(`YouTube embed upgrade failed for ${postId}`, 'warn', e)
        }
    }
    if (linkBlockUrls.length > 0) {
        try {
            await embedLinkUrls(client, postId, linkBlockUrls)
        } catch (e) {
            log(`Bookmark embed upgrade failed for ${postId}`, 'warn', e)
        }
    }

    if (shouldEmail) {
        try {
            const current = await client.getPost(postId)
            await client.publishDraft(postId, current.updated_at, preset.newsletterSlug)
            emailed = true
        } catch (e) {
            log(`Email dispatch failed for ${postId}`, 'error', e)
        }
    }

    const nowIso = new Date().toISOString()
    const today = nowIso.slice(0, 10)
    const capturedPostId = postId
    const capturedPresetId = preset.id
    await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        frontmatter[fmKeys.ghostId] = capturedPostId
        frontmatter[fmKeys.syncedAt] = nowIso
        frontmatter[fmKeys.contentHash] = contentHash
        frontmatter[fmKeys.preset] = capturedPresetId
        if (emailed) frontmatter[fmKeys.emailedAt] = nowIso
        frontmatter[COSMETIC_FM.published] = preset.ghostStatus === 'published'
        if (!frontmatter[COSMETIC_FM.datePublished]) {
            frontmatter[COSMETIC_FM.datePublished] = today
        }
        frontmatter[COSMETIC_FM.dateUpdated] = today
    })

    return {
        path: file.path,
        status: action,
        postId,
        editUrl: ghostEditorUrl(settings.ghostUrl, postId),
        emailed
    }
}

function ghostEditorUrl(ghostUrl: string, postId: string): string {
    return `${ghostUrl.replace(/\/+$/, '')}/ghost/#/editor/post/${postId}`
}

function readFrontmatter(app: App, file: TFile): Record<string, unknown> {
    const cache = app.metadataCache.getFileCache(file)
    return (cache?.frontmatter ?? {}) as Record<string, unknown>
}

/** Strip a YAML frontmatter block at the top of the note (if present). */
function splitFrontmatter(raw: string): { body: string; frontmatterBlock: string } {
    if (!raw.startsWith('---')) return { body: raw, frontmatterBlock: '' }
    const end = raw.indexOf('\n---', 3)
    if (end === -1) return { body: raw, frontmatterBlock: '' }
    const frontmatterBlock = raw.slice(0, end + 4)
    const body = raw.slice(end + 4).replace(/^\n+/, '')
    return { body, frontmatterBlock }
}
