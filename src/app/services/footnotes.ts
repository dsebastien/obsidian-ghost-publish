import { Marked, marked } from 'marked'
import type { TokenizerThis, Tokens } from 'marked'

/**
 * Markdown footnote support for the Ghost publishing pipeline.
 *
 * `marked` ships without footnote handling, so Obsidian's footnote syntax
 * (`text[^id]` references, `[^id]: definition` blocks, and `^[inline]`
 * footnotes) would otherwise leak into Ghost as broken reference-style links.
 * This module renders them to the standard footnote HTML structure
 * (superscript anchors + a trailing `<section class="footnotes">` ordered
 * list) that Ghost preserves when converting `source=html` to lexical.
 *
 * State (collected definitions, reference order, numbering) is per parse, so
 * a fresh `Marked` instance with fresh closures is built on every call.
 */

interface FootnoteToken {
    type: 'footnoteRef'
    raw: string
    id: string
}

interface FootnoteDefToken {
    type: 'footnoteDef'
    raw: string
    id: string
    text: string
}

const REF_OPEN = /^\[\^([^\]\s][^\]]*)\]/
const INLINE_OPEN = /^\^\[/
const DEF_OPEN = /^ {0,3}\[\^([^\]\s][^\]]*)\]:[ \t]*/

/**
 * Consume a footnote definition starting at the beginning of `src`: the first
 * line plus any following indented (>= 2 spaces or a tab) or blank-then-indented
 * continuation lines. Returns the matched token or `undefined`.
 */
function tokenizeDefinition(src: string): FootnoteDefToken | undefined {
    const open = DEF_OPEN.exec(src)
    if (!open) return undefined
    const id = open[1]
    if (id === undefined) return undefined

    let pos = open[0].length
    const lines: string[] = []

    const firstNl = src.indexOf('\n', pos)
    const firstEnd = firstNl === -1 ? src.length : firstNl
    lines.push(src.slice(pos, firstEnd))
    pos = firstNl === -1 ? src.length : firstNl + 1

    while (pos < src.length) {
        const nl = src.indexOf('\n', pos)
        const lineEnd = nl === -1 ? src.length : nl
        const line = src.slice(pos, lineEnd)

        if (/^( {2,}|\t)/.test(line)) {
            lines.push(line.replace(/^( {1,4}|\t)/, ''))
            pos = nl === -1 ? src.length : nl + 1
            continue
        }

        if (line.trim() === '') {
            const nextStart = nl === -1 ? src.length : nl + 1
            const nextNl = src.indexOf('\n', nextStart)
            const nextEnd = nextNl === -1 ? src.length : nextNl
            const nextLine = src.slice(nextStart, nextEnd)
            if (/^( {2,}|\t)/.test(nextLine)) {
                lines.push('')
                pos = nextStart
                continue
            }
        }
        break
    }

    return {
        type: 'footnoteDef',
        raw: src.slice(0, pos),
        id,
        text: lines.join('\n').trim()
    }
}

/** Render a single footnote definition's markdown content to inline-safe HTML. */
function renderDefinitionBody(text: string): string {
    return marked.parse(text, { async: false }).trim()
}

/**
 * Parse markdown to Ghost-ready HTML with footnote support. References become
 * superscript anchors; a `<section class="footnotes">` ordered list of the
 * referenced definitions (in reference order) is appended to the output.
 */
export function parseMarkdownWithFootnotes(markdown: string): string {
    /** Definition id → raw markdown content (includes synthetic inline ids). */
    const definitions = new Map<string, string>()
    /** Referenced ids, in first-reference order; index + 1 is the footnote number. */
    const order: string[] = []
    /** Ids that already emitted the `id="fnref-N"` anchor (dedupe across re-references). */
    const anchored = new Set<string>()
    let inlineSeq = 0

    function numberFor(id: string): number {
        const existing = order.indexOf(id)
        if (existing !== -1) return existing + 1
        order.push(id)
        return order.length
    }

    function renderRef(id: string): string {
        const n = numberFor(id)
        const idAttr = anchored.has(id) ? '' : ` id="fnref-${n}"`
        anchored.add(id)
        return `<sup class="footnote-ref"><a href="#fn-${n}"${idAttr}>${n}</a></sup>`
    }

    const instance = new Marked()
    instance.use({
        extensions: [
            {
                name: 'footnoteDef',
                level: 'block',
                start(src: string): number | undefined {
                    const i = src.search(/^ {0,3}\[\^[^\]\s][^\]]*\]:/m)
                    return i === -1 ? undefined : i
                },
                tokenizer(this: TokenizerThis, src: string): FootnoteDefToken | undefined {
                    const token = tokenizeDefinition(src)
                    if (!token) return undefined
                    definitions.set(token.id, token.text)
                    return token
                },
                renderer(): string {
                    // Definitions are hoisted into the footnotes section by the
                    // postprocess hook; they emit nothing inline.
                    return ''
                }
            },
            {
                name: 'footnoteInline',
                level: 'inline',
                start(src: string): number | undefined {
                    const i = src.indexOf('^[')
                    return i === -1 ? undefined : i
                },
                tokenizer(this: TokenizerThis, src: string): FootnoteToken | undefined {
                    if (!INLINE_OPEN.test(src)) return undefined
                    // Balance brackets so nested `[...]` inside the footnote survive.
                    // Scanning starts after the opening `^[` (indices 0 and 1).
                    let depth = 0
                    let end = -1
                    for (let i = 2; i < src.length; i++) {
                        const ch = src[i]
                        if (ch === '[') depth++
                        else if (ch === ']') {
                            if (depth === 0) {
                                end = i
                                break
                            }
                            depth--
                        }
                    }
                    if (end === -1) return undefined
                    const text = src.slice(2, end)
                    inlineSeq += 1
                    const id = `inline-${inlineSeq}`
                    definitions.set(id, text)
                    return { type: 'footnoteRef', raw: src.slice(0, end + 1), id }
                },
                renderer(this: unknown, token: Tokens.Generic): string {
                    return renderRef((token as unknown as FootnoteToken).id)
                }
            },
            {
                name: 'footnoteRef',
                level: 'inline',
                start(src: string): number | undefined {
                    const i = src.indexOf('[^')
                    return i === -1 ? undefined : i
                },
                tokenizer(this: TokenizerThis, src: string): FootnoteToken | undefined {
                    const match = REF_OPEN.exec(src)
                    if (!match) return undefined
                    const id = match[1]
                    if (id === undefined) return undefined
                    // All definitions are tokenized during the block phase, which
                    // completes before any inline tokenizer runs, so an unknown id
                    // here means a dangling reference: leave it as literal text.
                    if (!definitions.has(id)) return undefined
                    return { type: 'footnoteRef', raw: match[0], id }
                },
                renderer(this: unknown, token: Tokens.Generic): string {
                    return renderRef((token as unknown as FootnoteToken).id)
                }
            }
        ],
        hooks: {
            postprocess(html: string): string {
                if (order.length === 0) return html
                const items = order.map((id, idx) => {
                    const n = idx + 1
                    const backref =
                        ` <a href="#fnref-${n}" class="footnote-backref" ` +
                        `aria-label="Back to reference ${n}">↩</a>`
                    const rendered = renderDefinitionBody(definitions.get(id) ?? '')
                    const body = rendered.endsWith('</p>')
                        ? rendered.slice(0, -4) + backref + '</p>'
                        : rendered + backref
                    return `<li id="fn-${n}">${body}</li>`
                })
                return (
                    html +
                    `\n<section class="footnotes" data-footnotes>\n<ol>\n` +
                    items.join('\n') +
                    `\n</ol>\n</section>\n`
                )
            }
        }
    })

    return instance.parse(markdown, { async: false })
}
