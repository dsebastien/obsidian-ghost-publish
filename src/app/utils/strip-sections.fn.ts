/**
 * Strip H2 sections whose titles match the configured list. Comparison is
 * case-insensitive and ignores punctuation, so `## References ✨` matches
 * `references`. Stripping continues until the next H1/H2 boundary.
 */
export function stripVaultOnlySections(markdown: string, stripSections: string[]): string {
    if (stripSections.length === 0) return markdown
    const norm = (s: string): string =>
        s
            .replace(/[^\w\s]/g, '')
            .trim()
            .toLowerCase()
    const targets = new Set(stripSections.map(norm))
    const lines = markdown.split('\n')
    const out: string[] = []
    let stripping = false
    for (const line of lines) {
        const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/)
        if (headingMatch) {
            const level = headingMatch[1]!.length
            const title = norm(headingMatch[2]!)
            if (level === 2 && targets.has(title)) {
                stripping = true
                continue
            }
            if (stripping && level <= 2) {
                stripping = false
            }
        }
        if (!stripping) out.push(line)
    }
    return out.join('\n')
}

/** Remove Dataview / Dataview Serializer blocks — they don't translate to Ghost. */
export function stripDataviewQueries(markdown: string): string {
    return markdown
        .replace(/```dataview(js)?[\s\S]*?```/g, '')
        .replace(/%%\s*dataview-serializer[\s\S]*?%%/g, '')
}

/**
 * Ghost renders the `title` field as the page title; the first H1 in the body
 * just duplicates it. Strip the very first H1 line if present.
 */
export function stripLeadingH1(markdown: string): string {
    return markdown.replace(/^\s*#\s+.+?\n/, '')
}
