import { describe, expect, it } from 'bun:test'
import { processYoutubeEmbeds } from './process-youtube.fn'

describe('processYoutubeEmbeds', () => {
    it('rewrites a youtube.com watch URL to a Watch on YouTube marker', () => {
        const input = '![](https://www.youtube.com/watch?v=dQw4w9WgXcQ)'
        const { markdown, urls } = processYoutubeEmbeds(input)
        expect(urls).toEqual(['https://www.youtube.com/watch?v=dQw4w9WgXcQ'])
        expect(markdown).toContain('▶️ [Watch on YouTube]')
    })

    it('rewrites a youtu.be short URL', () => {
        const input = '![Alt text](https://youtu.be/abcdEFG_123)'
        const { markdown, urls } = processYoutubeEmbeds(input)
        expect(urls).toEqual(['https://youtu.be/abcdEFG_123'])
        expect(markdown).toContain('▶️ [Watch on YouTube](https://youtu.be/abcdEFG_123)')
    })

    it('leaves non-youtube image embeds alone', () => {
        const input = '![](https://example.com/cat.png)'
        const { markdown, urls } = processYoutubeEmbeds(input)
        expect(urls).toEqual([])
        expect(markdown).toBe(input)
    })

    it('collects multiple URLs', () => {
        const input = [
            '![](https://www.youtube.com/watch?v=AAA)',
            'intro',
            '![](https://youtu.be/BBB)'
        ].join('\n')
        const { urls } = processYoutubeEmbeds(input)
        expect(urls).toEqual(['https://www.youtube.com/watch?v=AAA', 'https://youtu.be/BBB'])
    })
})
