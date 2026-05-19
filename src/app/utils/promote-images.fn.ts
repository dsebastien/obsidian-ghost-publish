/**
 * Wrap standalone `<p><img …></p>` blocks with Ghost's `kg-image-card`
 * figure so the published post renders them as proper image cards instead
 * of inline images.
 */
export function promoteImagesToGhostCards(html: string): string {
    return html.replace(
        /<p>\s*(<img [^>]+>)\s*<\/p>/g,
        '<figure class="kg-card kg-image-card">$1</figure>'
    )
}
