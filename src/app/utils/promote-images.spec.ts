import { describe, expect, it } from 'bun:test'
import { promoteImagesToGhostCards } from './promote-images.fn'

describe('promoteImagesToGhostCards', () => {
    it('wraps a standalone <p><img></p> in a kg-image-card figure', () => {
        const input = '<p><img src="https://example.com/cat.png" alt="cat"></p>'
        expect(promoteImagesToGhostCards(input)).toBe(
            '<figure class="kg-card kg-image-card"><img src="https://example.com/cat.png" alt="cat"></figure>'
        )
    })

    it('leaves images embedded in other content alone', () => {
        const input = '<p>Before <img src="x.png"> after</p>'
        expect(promoteImagesToGhostCards(input)).toBe(input)
    })
})
