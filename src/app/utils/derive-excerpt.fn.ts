/**
 * Build a short excerpt from markdown body. Strips headings, code blocks,
 * common emphasis markers and link syntax, then returns the first
 * paragraph that's longer than 20 characters (capped at 300 chars).
 */
export function deriveExcerpt(markdown: string): string {
    const text = markdown
        .replace(/^#.+$/gm, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\*\*|__|_|\*/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    const para = text.split(/\n\s*\n/).find((p) => p.trim().length > 20) ?? ''
    return para.replace(/\s+/g, ' ').trim().slice(0, 300)
}
