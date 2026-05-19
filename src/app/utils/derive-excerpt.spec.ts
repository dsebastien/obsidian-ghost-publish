import { describe, expect, it } from 'bun:test'
import { deriveExcerpt } from './derive-excerpt.fn'

describe('deriveExcerpt', () => {
    it('returns the first sufficiently long paragraph', () => {
        const md = 'Short.\n\nThis is a longer paragraph with more than twenty characters.'
        expect(deriveExcerpt(md)).toBe(
            'This is a longer paragraph with more than twenty characters.'
        )
    })

    it('strips heading lines, code blocks and emphasis markers', () => {
        const md = [
            '# Title',
            '',
            '```',
            'ignored = true',
            '```',
            '',
            'A **bold** paragraph with _underscore_ emphasis and a [link](https://example.com).'
        ].join('\n')
        const out = deriveExcerpt(md)
        expect(out).toContain('bold')
        expect(out).not.toContain('**')
        expect(out).not.toContain('ignored = true')
        expect(out).toContain('link')
    })

    it('returns an empty string when nothing meaningful is left', () => {
        expect(deriveExcerpt('# Heading\n\nshort.')).toBe('')
    })

    it('caps the result at 300 characters', () => {
        const md = 'a'.repeat(500)
        expect(deriveExcerpt(md).length).toBeLessThanOrEqual(300)
    })
})
