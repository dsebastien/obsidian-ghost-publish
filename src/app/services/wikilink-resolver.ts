import { TFile } from 'obsidian'
import type { App } from 'obsidian'
import type { LinkMap } from '../utils/process-link-blocks.fn'
import { vaultPathToUrl } from '../utils/vault-path-to-url.fn'

export interface WikilinkResolverConfig {
    notesBaseUrl: string
    knownUrls: Record<string, string>
    /**
     * Frontmatter key that a destination note must satisfy (`=== true`) for
     * its `[[wikilink]]` to resolve to a public-mirror URL. Empty disables
     * the gate, meaning the wikilink only resolves via LINK blocks or the
     * known URLs map.
     */
    eligibilityKey: string
}

/**
 * Build a link map for every `[[wikilink]]` in `content`. Resolution order:
 *   1. LINK blocks that pair a wikilink with an explicit URL — wins outright.
 *   2. Known URL map (e.g. canonical product pages).
 *   3. Vault lookup via `metadataCache.getFirstLinkpathDest`:
 *      - If the linked note satisfies the eligibility gate AND a notes base
 *        URL is configured, build a notes-base URL.
 *      - Otherwise, return `{ url: null }` — caller will render as bold text.
 */
export function buildLinkMap(
    app: App,
    sourcePath: string,
    content: string,
    config: WikilinkResolverConfig
): LinkMap {
    const linkBlockUrls = extractLinkBlockAssociations(content)
    const wikilinkTargets = extractWikilinkTargets(content)
    const map: LinkMap = {}
    const canResolveViaVault =
        config.notesBaseUrl.trim().length > 0 && config.eligibilityKey.trim().length > 0

    for (const target of wikilinkTargets) {
        const fromBlock = linkBlockUrls[target]
        if (fromBlock) {
            map[target] = { url: fromBlock }
            continue
        }
        const fromKnown = config.knownUrls[target]
        if (fromKnown) {
            map[target] = { url: fromKnown }
            continue
        }

        if (canResolveViaVault) {
            const dest = app.metadataCache.getFirstLinkpathDest(target, sourcePath)
            if (dest instanceof TFile && dest.extension === 'md') {
                const cache = app.metadataCache.getFileCache(dest)
                const isEligible = cache?.frontmatter?.[config.eligibilityKey] === true
                if (isEligible) {
                    map[target] = { url: vaultPathToUrl(config.notesBaseUrl, dest.path) }
                    continue
                }
            }
        }
        map[target] = { url: null }
    }
    return map
}

/**
 * Replace `[[Target]]` and `[[Target|alias]]` outside image embeds:
 *   - If linkMap has a URL → `[alias](url)`
 *   - Otherwise → **alias** (bold fallback, matches the original behaviour)
 */
export function substituteWikilinks(markdown: string, linkMap: LinkMap): string {
    return markdown.replace(/(?<!!)\[\[([^\]]+?)\]\]/g, (_full, inner: string) => {
        const [targetRaw, displayRaw] = inner.includes('|')
            ? [inner.split('|')[0]!, inner.split('|').slice(1).join('|')]
            : [inner, inner]
        const target = targetRaw.trim()
        const display = displayRaw.trim()
        const entry = linkMap[target]
        if (entry?.url) return `[${display}](${entry.url})`
        return `**${display}**`
    })
}

function extractWikilinkTargets(content: string): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    const re = /(?<!!)\[\[([^\]]+?)\]\]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
        const inner = m[1]!
        const target = (inner.includes('|') ? inner.split('|')[0]! : inner).trim()
        if (!seen.has(target)) {
            seen.add(target)
            out.push(target)
        }
    }
    return out
}

function extractLinkBlockAssociations(content: string): Record<string, string> {
    const map: Record<string, string> = {}
    const blockPattern = /LINK:?\s*\n((?:- .+\n?)+)/g
    let match: RegExpExecArray | null
    while ((match = blockPattern.exec(content)) !== null) {
        const lines = match[1]!
            .trim()
            .split('\n')
            .map((l) => l.replace(/^- /, '').trim())
        let noteName: string | null = null
        let url: string | null = null
        for (const line of lines) {
            const wlMatch = line.match(/^\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]$/)
            if (wlMatch) {
                noteName = wlMatch[1]!.trim()
            } else if (line.startsWith('http')) {
                url = line
            }
        }
        if (noteName && url) {
            map[noteName] = url
        }
    }
    return map
}
