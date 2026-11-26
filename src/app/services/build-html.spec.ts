import { describe, expect, it } from 'bun:test'
import { buildPostHtml } from './build-html'

describe('buildPostHtml', () => {
    it('returns the body alone without a note URL', () => {
        expect(buildPostHtml('Hello', 'T', '', 'Ignored:')).not.toContain('Ignored')
    })

    it('starts with the link back, in the given text', () => {
        const html = buildPostHtml('Hello', 'A & B', 'https://n.example.com/x', 'From my notes:')
        expect(html.startsWith('<p><em>From my notes: <a href="https://n.example.com/x">')).toBe(
            true
        )
        expect(html).toContain('>A &amp; B</a>.</em></p>')
    })
})
