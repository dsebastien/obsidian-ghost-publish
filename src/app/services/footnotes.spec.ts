import { test, expect, describe } from 'bun:test'
import { parseMarkdownWithFootnotes } from './footnotes'

describe('parseMarkdownWithFootnotes', () => {
    test('passes through markdown without footnotes unchanged in spirit', () => {
        const html = parseMarkdownWithFootnotes('Hello **world**.')
        expect(html).toContain('<strong>world</strong>')
        expect(html).not.toContain('footnotes')
    })

    test('renders a reference and a matching definition', () => {
        const md = ['A claim.[^1]', '', '[^1]: The supporting source.'].join('\n')
        const html = parseMarkdownWithFootnotes(md)

        expect(html).toContain('<sup class="footnote-ref"><a href="#fn-1" id="fnref-1">1</a></sup>')
        expect(html).toContain('<section class="footnotes" data-footnotes>')
        expect(html).toContain('<li id="fn-1">')
        expect(html).toContain('The supporting source.')
        expect(html).toContain('href="#fnref-1"')
        expect(html).toContain('class="footnote-backref"')
    })

    test('numbers footnotes by reference order, not definition order', () => {
        const md = ['First.[^a] Second.[^b]', '', '[^b]: Beta.', '[^a]: Alpha.'].join('\n')
        const html = parseMarkdownWithFootnotes(md)

        // [^a] is referenced first → number 1; [^b] → number 2
        expect(html).toContain('href="#fn-1" id="fnref-1">1</a>')
        expect(html).toContain('href="#fn-2" id="fnref-2">2</a>')
        // Section lists in reference order: Alpha (1) before Beta (2)
        const alphaIdx = html.indexOf('Alpha.')
        const betaIdx = html.indexOf('Beta.')
        expect(alphaIdx).toBeGreaterThan(-1)
        expect(betaIdx).toBeGreaterThan(alphaIdx)
    })

    test('re-references the same footnote without duplicating the fnref id', () => {
        const md = ['See here.[^x] And again.[^x]', '', '[^x]: Shared note.'].join('\n')
        const html = parseMarkdownWithFootnotes(md)

        // Both references point at fn-1...
        const refCount = (html.match(/href="#fn-1"/g) ?? []).length
        expect(refCount).toBe(2)
        // ...but only one carries the element id to keep HTML ids unique.
        const idCount = (html.match(/id="fnref-1"/g) ?? []).length
        expect(idCount).toBe(1)
    })

    test('drops unreferenced definitions', () => {
        const md = ['Plain text.', '', '[^unused]: Never cited.'].join('\n')
        const html = parseMarkdownWithFootnotes(md)

        expect(html).not.toContain('footnotes')
        expect(html).not.toContain('Never cited.')
    })

    test('leaves a dangling reference as literal text', () => {
        const html = parseMarkdownWithFootnotes('No definition here.[^missing]')
        expect(html).toContain('[^missing]')
        expect(html).not.toContain('footnote-ref')
    })

    test('supports inline footnotes', () => {
        const html = parseMarkdownWithFootnotes('A statement.^[An inline aside.]')
        expect(html).toContain('<sup class="footnote-ref">')
        expect(html).toContain('<section class="footnotes"')
        expect(html).toContain('An inline aside.')
    })

    test('renders markdown inside definitions', () => {
        const md = ['Cite.[^1]', '', '[^1]: See **bold** and a [link](https://example.com).'].join(
            '\n'
        )
        const html = parseMarkdownWithFootnotes(md)
        expect(html).toContain('<strong>bold</strong>')
        expect(html).toContain('<a href="https://example.com">link</a>')
    })

    test('supports multi-line indented definition continuations', () => {
        const md = [
            'Cite.[^long]',
            '',
            '[^long]: First paragraph.',
            '',
            '    Second paragraph of the same footnote.'
        ].join('\n')
        const html = parseMarkdownWithFootnotes(md)
        expect(html).toContain('First paragraph.')
        expect(html).toContain('Second paragraph of the same footnote.')
    })
})
