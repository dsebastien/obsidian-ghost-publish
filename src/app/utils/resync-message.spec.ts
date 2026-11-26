import { describe, expect, it } from 'bun:test'
import { resyncConfirmMessage } from './resync-message.fn'

describe('resyncConfirmMessage', () => {
    it('names the number of notes, says it updates live posts and sends no email', () => {
        const text = resyncConfirmMessage('News', 12)
        expect(text).toContain('12 notes')
        expect(text).toContain('"News"')
        expect(text).toContain('live posts')
        expect(text).toContain('No newsletter email is sent')
    })

    it('uses the singular for one note', () => {
        const text = resyncConfirmMessage('News', 1)
        expect(text).toContain('1 note ')
        expect(text).toContain('live post ')
    })
})
