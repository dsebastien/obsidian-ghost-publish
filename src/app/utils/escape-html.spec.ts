import { describe, expect, it } from 'bun:test'
import { escapeHtml } from './escape-html.fn'

describe('escapeHtml', () => {
    it('escapes every special HTML char', () => {
        expect(escapeHtml(`<div class="x">it's & it's</div>`)).toBe(
            '&lt;div class=&quot;x&quot;&gt;it&#39;s &amp; it&#39;s&lt;/div&gt;'
        )
    })

    it('returns plain strings unchanged', () => {
        expect(escapeHtml('hello world')).toBe('hello world')
    })
})
