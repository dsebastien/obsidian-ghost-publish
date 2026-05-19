const YOUTUBE_URL_RE =
    /^!\[[^\]]*\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^)]+)\)\s*$/gm

/**
 * Convert `![](youtube-url)` image embeds to a placeholder paragraph
 * `▶️ [Watch on YouTube](url)`. The paragraph is later swapped for a Ghost
 * oembed embed card by `embedYoutube` once the post id is known.
 */
export function processYoutubeEmbeds(markdown: string): { markdown: string; urls: string[] } {
    const urls: string[] = []
    const out = markdown.replace(YOUTUBE_URL_RE, (_match, url: string) => {
        urls.push(url)
        return `▶️ [Watch on YouTube](${url})`
    })
    return { markdown: out, urls }
}
