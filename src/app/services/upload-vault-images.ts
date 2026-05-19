import { TFile } from 'obsidian'
import type { App } from 'obsidian'
import type { GhostApiClient } from '../api/ghost-api-client'
import { log } from '../../utils/log'

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg)$/i

const MIME_BY_EXT: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml'
}

/**
 * Replace every `![[image]]` embed in `markdown` with `![alt](ghostUrl)`,
 * uploading each unique image to Ghost. Non-image transclusions
 * (e.g. note embeds) are dropped — Ghost has no equivalent.
 *
 * Uses `metadataCache.getFirstLinkpathDest` to resolve image references
 * against the vault.
 */
export async function uploadVaultImages(
    app: App,
    client: GhostApiClient,
    sourcePath: string,
    markdown: string
): Promise<string> {
    const refs = [...markdown.matchAll(/!\[\[([^\]]+?)\]\]/g)]
    if (refs.length === 0) return markdown

    const uploadMap = new Map<string, string | null>()
    for (const match of refs) {
        const inner = match[1]!
        const [target] = inner.includes('|') ? inner.split('|') : [inner]
        const trimmed = target!.trim()
        if (uploadMap.has(trimmed)) continue
        if (!IMAGE_EXT_RE.test(trimmed)) {
            uploadMap.set(trimmed, null)
            continue
        }
        const file = app.metadataCache.getFirstLinkpathDest(trimmed, sourcePath)
        if (!(file instanceof TFile)) {
            log(`Image not found in vault: ${trimmed}`, 'warn')
            uploadMap.set(trimmed, null)
            continue
        }
        try {
            const data = await app.vault.readBinary(file)
            const ext = (file.extension || '').toLowerCase()
            const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'
            const url = await client.uploadImage(file.name, data, mime)
            uploadMap.set(trimmed, url)
            log(`Uploaded ${trimmed} → ${url}`, 'debug')
        } catch (e) {
            log(`Image upload failed for ${trimmed}`, 'error', e)
            uploadMap.set(trimmed, null)
        }
    }

    return markdown.replace(/!\[\[([^\]]+?)\]\]/g, (_full, inner: string) => {
        const [targetRaw, aliasRaw] = inner.includes('|') ? inner.split('|') : [inner, inner]
        const target = targetRaw!.trim()
        const alias = (aliasRaw ?? target).trim()
        const url = uploadMap.get(target)
        if (!url) return ''
        const altSource = alias || target
        const alt = altSource.replace(IMAGE_EXT_RE, '')
        return `![${alt}](${url})`
    })
}
