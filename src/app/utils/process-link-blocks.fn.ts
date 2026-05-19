/**
 * Replace LINK / `LINK:` blocks with a `🔗 [URL](URL)` marker paragraph,
 * resolving wikilinks via the provided link map. Returns the rewritten
 * markdown plus the URLs that should be upgraded to bookmark cards
 * post-creation.
 *
 * Accepted forms:
 *   LINK: https://...
 *   LINK: [[NoteName]]
 *   LINK
 *   - https://...
 *   - [[NoteName]]
 */

export type LinkMap = Record<string, { url: string | null }>

export function processLinkBlocks(
    markdown: string,
    linkMap: LinkMap = {}
): { markdown: string; urls: string[] } {
    const urls: string[] = []
    const lines = markdown.split('\n')
    const out: string[] = []

    const resolveWikilink = (target: string): string | null => linkMap[target]?.url ?? null
    const wikilinkLineRe = /^\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]$/

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!

        const inlineUrl = line.match(/^LINK:?\s+(https?:\/\/\S+)\s*$/)
        if (inlineUrl) {
            urls.push(inlineUrl[1]!)
            out.push(`🔗 [${inlineUrl[1]}](${inlineUrl[1]})`)
            continue
        }

        const inlineWl = line.match(/^LINK:?\s+\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]\s*$/)
        if (inlineWl) {
            const resolved = resolveWikilink(inlineWl[1]!.trim())
            if (resolved) {
                urls.push(resolved)
                out.push(`🔗 [${resolved}](${resolved})`)
            }
            continue
        }

        if (/^LINK:?\s*$/.test(line)) {
            let url: string | null = null
            const wikilinkTargets: string[] = []
            let lastConsumed = 0
            for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                const sub = lines[j]!.trim()
                if (sub === '') break
                if (!sub.startsWith('-')) break
                const content = sub.slice(1).trim()
                if (/^https?:\/\//.test(content)) {
                    url = content
                    lastConsumed = j - i
                    break
                }
                const wlm = content.match(wikilinkLineRe)
                if (wlm) {
                    wikilinkTargets.push(wlm[1]!.trim())
                    lastConsumed = j - i
                    continue
                }
                break
            }
            if (!url && wikilinkTargets.length > 0) {
                for (const target of wikilinkTargets) {
                    const resolved = resolveWikilink(target)
                    if (resolved) {
                        url = resolved
                        break
                    }
                }
            }
            if (url) {
                urls.push(url)
                out.push(`🔗 [${url}](${url})`)
                i += lastConsumed
                continue
            }
            if (lastConsumed > 0) {
                i += lastConsumed
                continue
            }
        }

        out.push(line)
    }

    return { markdown: out.join('\n'), urls }
}
