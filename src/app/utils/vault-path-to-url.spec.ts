import { describe, expect, it } from 'bun:test'
import { vaultPathToUrl } from './vault-path-to-url.fn'

describe('vaultPathToUrl', () => {
    it('drops the .md extension', () => {
        expect(vaultPathToUrl('https://example.com', 'Note.md')).toBe('https://example.com/Note')
    })

    it('replaces spaces with + in each segment', () => {
        expect(vaultPathToUrl('https://example.com', '30 Areas/My Note.md')).toBe(
            'https://example.com/30+Areas/My+Note'
        )
    })

    it('percent-encodes hashes', () => {
        expect(vaultPathToUrl('https://example.com', 'Tagged #note.md')).toBe(
            'https://example.com/Tagged+%23note'
        )
    })

    it('strips a trailing slash from the base URL', () => {
        expect(vaultPathToUrl('https://example.com/', 'a.md')).toBe('https://example.com/a')
    })
})
