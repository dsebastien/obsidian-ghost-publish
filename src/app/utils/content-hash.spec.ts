import { describe, expect, it } from 'bun:test'
import { sha256Hex } from './content-hash.fn'

describe('sha256Hex', () => {
    it('returns the canonical SHA-256 of an empty string', async () => {
        expect(await sha256Hex('')).toBe(
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        )
    })

    it('returns the canonical SHA-256 of "abc"', async () => {
        expect(await sha256Hex('abc')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
        )
    })

    it('is stable for the same input', async () => {
        const a = await sha256Hex('hello world')
        const b = await sha256Hex('hello world')
        expect(a).toBe(b)
    })
})
