import { describe, expect, it } from 'bun:test'
import { DEFAULT_LINK_BACK_TEXT, newPreset, sanitizePreset } from './preset.intf'

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
        expect(p.linkBackToNoteEnabled).toBe(false)
        expect(p.linkBackText).toBe(DEFAULT_LINK_BACK_TEXT)
        expect(DEFAULT_LINK_BACK_TEXT).toBe('Canonical version:')
        expect(p.listingNoteEnabled).toBe(false)
        expect(p.listingNotePath).toBe('')
    })
})

describe('sanitizePreset', () => {
    const base = { id: 'p', name: 'P' }

    it('turns both note links on for a saved preset that had canonical on', () => {
        const p = sanitizePreset({ ...base, canonicalUrlEnabled: true })
        expect(p.linkBackToNoteEnabled).toBe(true)
        expect(p.canonicalUrlEnabled).toBe(true)
    })

    it('turns both note links off for a saved preset that had canonical off', () => {
        const p = sanitizePreset({ ...base, canonicalUrlEnabled: false })
        expect(p.linkBackToNoteEnabled).toBe(false)
        expect(p.canonicalUrlEnabled).toBe(false)
    })

    it('turns both off when neither setting was saved', () => {
        const p = sanitizePreset({ ...base })
        expect(p.linkBackToNoteEnabled).toBe(false)
        expect(p.canonicalUrlEnabled).toBe(false)
    })

    it('keeps the two settings apart once they are saved', () => {
        const p = sanitizePreset({
            ...base,
            linkBackToNoteEnabled: true,
            canonicalUrlEnabled: false
        })
        expect(p.linkBackToNoteEnabled).toBe(true)
        expect(p.canonicalUrlEnabled).toBe(false)
        const q = sanitizePreset({
            ...base,
            linkBackToNoteEnabled: false,
            canonicalUrlEnabled: true
        })
        expect(q.linkBackToNoteEnabled).toBe(false)
        expect(q.canonicalUrlEnabled).toBe(true)
    })

    it("gives a saved preset without a link text today's text", () => {
        expect(sanitizePreset({ ...base }).linkBackText).toBe(DEFAULT_LINK_BACK_TEXT)
        expect(sanitizePreset({ ...base, linkBackText: 3 }).linkBackText).toBe(
            DEFAULT_LINK_BACK_TEXT
        )
        expect(sanitizePreset({ ...base, linkBackText: 'First in my notes:' }).linkBackText).toBe(
            'First in my notes:'
        )
    })

    it('fills the other fields with defaults', () => {
        const p = sanitizePreset({ ...base, ghostStatus: 'nope', tags: [{ name: 'a' }, 3] })
        expect(p.enabled).toBe(true)
        expect(p.ghostStatus).toBe('published')
        expect(p.tags).toEqual([{ name: 'a' } as never])
        expect(p.newsletterSlug).toBe('')
        expect(p.listingNoteEnabled).toBe(false)
        expect(p.listingNotePath).toBe('')
    })
})
