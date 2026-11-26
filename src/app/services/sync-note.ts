import type { App, TFile } from 'obsidian'
import type { GhostApiClient } from '../api/ghost-api-client'
import type { GhostPost } from '../types/ghost-api.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { postUrlKeyClash } from '../types/plugin-settings.intf'
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
export interface SyncNoteOptions {
    /** Push even when the content hash matches (the "sync again" command). */
    ignoreContentHash?: boolean
    /** False: never send the newsletter, whatever the note asks. Default true. */
    allowEmail?: boolean
}

export async function syncNote(
    app: App,
    client: GhostApiClient,
    settings: PluginSettings,
    preset: Preset,
    file: TFile,
    options: SyncNoteOptions = {}
): Promise<SyncResult> {
    const allowEmail = options.allowEmail ?? true
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

    // URL of the note on the public mirror. Used by the link back in the
    // body, by canonical_url, and to clear a canonical_url set earlier.
    const noteUrl =
        settings.notesBaseUrl.trim().length > 0
            ? vaultPathToUrl(settings.notesBaseUrl, file.path)
            : ''
    const linkBack = preset.linkBackToNoteEnabled && noteUrl !== ''
    const setCanonical = preset.canonicalUrlEnabled && noteUrl !== ''

    const fmTitle = fm['title']
    const title = typeof fmTitle === 'string' && fmTitle.trim().length > 0 ? fmTitle : file.basename

    const contentHash = await sha256Hex(body)

    const existingGhostId =
        typeof fm[fmKeys.ghostId] === 'string' ? (fm[fmKeys.ghostId] as string) : ''
    const existingHash =
        typeof fm[fmKeys.contentHash] === 'string' ? (fm[fmKeys.contentHash] as string) : ''

    // Unchanged: leave the note untouched. Rewriting syncedAt here would dirty
    // every published note on each run (git noise, sync churn).
    if (existingGhostId && existingHash === contentHash && !options.ignoreContentHash) {
        return {
            path: file.path,
            status: 'unchanged',
            postId: existingGhostId,
            editUrl: ghostEditorUrl(settings.ghostUrl, existingGhostId)
        }
    }

    if ((linkBack || setCanonical) && !settings.skipCanonicalProbe) {
        const ok = await canonicalProbe(noteUrl)
        if (!ok) {
            return {
                path: file.path,
                status: 'skipped',
                reason: `canonical URL not reachable (${noteUrl})`
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

    const html = buildPostHtml(working, title, linkBack ? noteUrl : '', preset.linkBackText)
    const customExcerpt =
        typeof fm[fmKeys.excerpt] === 'string' && (fm[fmKeys.excerpt] as string).trim().length > 0
            ? (fm[fmKeys.excerpt] as string)
            : deriveExcerpt(working)

    let postId = existingGhostId
    let action: SyncResult['status'] = 'created'
    let shouldEmail = false
    let emailed = false
    let lastPost: GhostPost | undefined

    const tagsPayload = preset.tags.map((t) => ({ name: t.name, visibility: t.visibility }))

    if (postId) {
        try {
            const existing = await client.getPost(postId)
            const updatePayload: Record<string, unknown> = {
                title,
                html,
                tags: tagsPayload,
                custom_excerpt: customExcerpt,
                updated_at: existing.updated_at
            }
            // "Sync again" keeps the post's status on Ghost: a draft that waits
            // for its newsletter stays a draft, a post published by hand stays
            // published.
            if (!options.ignoreContentHash) updatePayload['status'] = preset.ghostStatus
            if (setCanonical) {
                updatePayload['canonical_url'] = noteUrl
            } else if (noteUrl && existing.canonical_url === noteUrl) {
                // The field is off but the post still points to the note
                // (set by an earlier sync): Ghost clears the field on null.
                // A canonical_url set by hand to another address is kept.
                updatePayload['canonical_url'] = null
            }
            const updated = await client.updatePost(postId, updatePayload)
            postId = updated.id
            lastPost = updated
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

    const waitsForEmail =
        preset.newsletterSlug.trim().length > 0 &&
        fm[fmKeys.emailFlag] === true &&
        !fm[fmKeys.emailedAt]
    if (!postId && action === 'recreated' && !allowEmail && waitsForEmail) {
        // Recreating here would publish without the email, and the email is
        // only ever sent on the first publish: leave it to a normal sync.
        return {
            path: file.path,
            status: 'skipped',
            reason: 'post missing on Ghost; run a normal sync to recreate and email'
        }
    }

    if (!postId) {
        shouldEmail = allowEmail && waitsForEmail
        const createPayload: Record<string, unknown> = {
            title,
            html,
            status: shouldEmail ? 'draft' : preset.ghostStatus,
            tags: tagsPayload,
            custom_excerpt: customExcerpt
        }
        if (setCanonical) createPayload['canonical_url'] = noteUrl
        const created = await client.createPost(createPayload)
        postId = created.id
        lastPost = created
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
            // Throws only when Ghost refused. A successful answer without a
            // post leaves lastPost undefined (URL unknown); the email is recorded.
            lastPost = await client.publishDraft(postId, current.updated_at, preset.newsletterSlug)
            emailed = true
        } catch (e) {
            log(`Email dispatch failed for ${postId}`, 'error', e)
        }
    }

    const postUrlKey = fmKeys.postUrl.trim()
    const clash = postUrlKeyClash(fmKeys)
    const live = !postUrlKey
        ? undefined
        : clash
          ? { note: `post URL key "${clash}" is already used by another property` }
          : publicPostUrl(lastPost)
    if (live?.note) {
        log(`Post URL not written for ${file.path}: ${live.note}`, clash ? 'warn' : 'debug')
    }

    const nowIso = new Date().toISOString()
    const today = nowIso.slice(0, 10)
    // From the status Ghost returned; a publish answer without a post
    // (lastPost undefined after an email) means the post is published.
    const isPublished =
        lastPost?.status !== undefined
            ? lastPost.status === 'published'
            : emailed || preset.ghostStatus === 'published'
    const contentChanged = contentHash !== existingHash
    const capturedPostId = postId
    const capturedPresetId = preset.id
    await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        frontmatter[fmKeys.ghostId] = capturedPostId
        frontmatter[fmKeys.syncedAt] = nowIso
        frontmatter[fmKeys.contentHash] = contentHash
        frontmatter[fmKeys.preset] = capturedPresetId
        if (emailed) frontmatter[fmKeys.emailedAt] = nowIso
        // Only on change: no needless rewrite of the property.
        if (live?.url && frontmatter[postUrlKey] !== live.url) {
            frontmatter[postUrlKey] = live.url
        }
        frontmatter[COSMETIC_FM.published] = isPublished
        if (!frontmatter[COSMETIC_FM.datePublished]) {
            frontmatter[COSMETIC_FM.datePublished] = today
        }
        // Only when the content changed ("sync again" may push unchanged notes).
        if (contentChanged) frontmatter[COSMETIC_FM.dateUpdated] = today
    })

    return {
        path: file.path,
        status: action,
        postId,
        editUrl: ghostEditorUrl(settings.ghostUrl, postId),
        emailed,
        ...(live?.url ? { postUrl: live.url } : {}),
        ...(live?.note ? { postUrlNote: live.note } : {})
    }
}

/**
 * The public URL of a post, from the post that Ghost returned last. A draft
 * or scheduled post has none yet: the Admin API gives a preview URL
 * (`/p/<uuid>/`) for it, which must not go into the note.
 */
export function publicPostUrl(post: GhostPost | undefined): { url?: string; note?: string } {
    const status = post?.status ?? 'unknown'
    if (status !== 'published') {
        return { note: `post is ${status}: no public URL yet` }
    }
    const url = post?.url?.trim() ?? ''
    if (!url || /\/(p\/[^/]+|404)\/?$/.test(url)) {
        return { note: 'Ghost returned no public URL for the post' }
    }
    return { url }
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
