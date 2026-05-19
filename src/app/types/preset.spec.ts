import { describe, expect, it } from 'bun:test'
import { newPreset } from './preset.intf'

describe('newPreset', () => {
    it('returns a preset enabled by default', () => {
        const p = newPreset('preset-1', 'Blog post')
        expect(p.id).toBe('preset-1')
        expect(p.name).toBe('Blog post')
        expect(p.enabled).toBe(true)
    })

    it('uses neutral defaults — no tags, no newsletter, no listing', () => {
        const p = newPreset('p', 'n')
        expect(p.tags).toEqual([])
        expect(p.newsletterSlug).toBe('')
        expect(p.ghostStatus).toBe('published')
        expect(p.canonicalUrlEnabled).toBe(false)
        expect(p.listingNoteEnabled).toBe(false)
        expect(p.listingNotePath).toBe('')
    })
})
