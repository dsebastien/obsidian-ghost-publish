import { escapeHtml } from '../utils/escape-html.fn'
import { DEFAULT_LINK_BACK_TEXT } from '../types/preset.intf'
import { promoteImagesToGhostCards } from '../utils/promote-images.fn'
import { parseMarkdownWithFootnotes } from './footnotes'

/**
 * Convert the processed markdown body into Ghost-ready HTML. When a note
 * URL is supplied, a short callout linking back to the note on the public
 * mirror is prepended (`linkBackText`, then the title as the link);
 * otherwise the HTML is returned bare.
 */
export function buildPostHtml(
    markdown: string,
    title: string,
    noteUrl: string,
    linkBackText: string = DEFAULT_LINK_BACK_TEXT
): string {
    const rendered = parseMarkdownWithFootnotes(markdown)
    const body = promoteImagesToGhostCards(rendered)
    if (!noteUrl) return body

    const callout =
        `<p><em>${escapeHtml(linkBackText.trim() || DEFAULT_LINK_BACK_TEXT)} ` +
        `<a href="${noteUrl}">${escapeHtml(title)}</a>.</em></p>\n\n`
    return callout + body
}
