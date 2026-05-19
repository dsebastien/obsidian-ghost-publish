import { describe, expect, it } from 'bun:test'
import { processLinkBlocks } from './process-link-blocks.fn'

describe('processLinkBlocks', () => {
    it('handles single-line LINK: URL', () => {
        const { markdown, urls } = processLinkBlocks('LINK: https://example.com')
        expect(urls).toEqual(['https://example.com'])
        expect(markdown).toBe('🔗 [https://example.com](https://example.com)')
    })

    it('handles single-line LINK [[wikilink]] with resolution', () => {
        const linkMap = { Foo: { url: 'https://foo.example' } }
        const { markdown, urls } = processLinkBlocks('LINK [[Foo]]', linkMap)
        expect(urls).toEqual(['https://foo.example'])
        expect(markdown).toBe('🔗 [https://foo.example](https://foo.example)')
    })

    it('drops the line entirely when wikilink does not resolve', () => {
        const { markdown, urls } = processLinkBlocks('LINK: [[Unknown]]', {})
        expect(urls).toEqual([])
        expect(markdown).toBe('')
    })

    it('handles multi-line LINK block with URL', () => {
        const input = ['LINK:', '- https://example.com', ''].join('\n')
        const { markdown, urls } = processLinkBlocks(input)
        expect(urls).toEqual(['https://example.com'])
        expect(markdown).toContain('🔗 [https://example.com]')
        expect(markdown).not.toContain('LINK:')
    })

    it('falls back to wikilink resolution in a multi-line block', () => {
        const input = ['LINK:', '- [[Foo]]', '- [[Bar]]'].join('\n')
        const { urls } = processLinkBlocks(input, {
            Foo: { url: null },
            Bar: { url: 'https://bar.example' }
        })
        expect(urls).toEqual(['https://bar.example'])
    })

    it('consumes the block when nothing resolves so raw LINK: never leaks', () => {
        const input = ['LINK:', '- [[Unresolved]]'].join('\n')
        const { markdown } = processLinkBlocks(input, { Unresolved: { url: null } })
        expect(markdown).not.toContain('LINK:')
        expect(markdown).not.toContain('Unresolved')
    })

    it('passes unrelated lines through verbatim', () => {
        const input = 'paragraph one\n\nparagraph two'
        const { markdown, urls } = processLinkBlocks(input)
        expect(urls).toEqual([])
        expect(markdown).toBe(input)
    })
})
