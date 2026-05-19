import type { GhostApiClient } from '../api/ghost-api-client'
import { log } from '../../utils/log'

interface LexicalNode {
    type?: string
    url?: string
    children?: LexicalNode[]
    [key: string]: unknown
}

interface LexicalDoc {
    root: LexicalNode
}

/**
 * Find every paragraph that contains a link to one of the supplied YouTube
 * URLs and replace it with a proper Ghost `embed` node. The post is
 * re-fetched here so we use the latest `updated_at` value to satisfy
 * Ghost's optimistic-concurrency check.
 */
export async function embedYoutubeUrls(
    client: GhostApiClient,
    postId: string,
    urls: string[]
): Promise<void> {
    if (urls.length === 0) return
    const post = await client.getPost(postId)
    if (!post.lexical) return

    const oembedCache = new Map<string, Record<string, unknown>>()
    for (const url of urls) {
        try {
            const data = await client.oembed(url)
            oembedCache.set(url, data as unknown as Record<string, unknown>)
        } catch (e) {
            log(`Oembed failed for ${url}`, 'warn', e)
        }
    }

    const lexical = JSON.parse(post.lexical) as LexicalDoc
    let replacements = 0

    const visit = (node: LexicalNode): void => {
        if (!node.children) return
        for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i]!
            if (child.type === 'paragraph' && child.children) {
                for (const [url, oembed] of oembedCache) {
                    if (paragraphContainsLink(child, url)) {
                        node.children[i] = {
                            type: 'embed',
                            version: 1,
                            url,
                            html: oembed['html'],
                            embedType: oembed['type'],
                            metadata: {
                                title: oembed['title'],
                                thumbnail_url: oembed['thumbnail_url'],
                                thumbnail_width: oembed['thumbnail_width'],
                                thumbnail_height: oembed['thumbnail_height'],
                                author_name: oembed['author_name'],
                                author_url: oembed['author_url'],
                                provider_name: oembed['provider_name']
                            },
                            caption: null
                        }
                        replacements++
                        oembedCache.delete(url)
                        break
                    }
                }
            }
            visit(child)
        }
    }

    visit(lexical.root)

    if (replacements > 0) {
        await client.updateLexical(postId, JSON.stringify(lexical), post.updated_at)
    }
}

function paragraphContainsLink(paragraph: LexicalNode, url: string): boolean {
    if (!paragraph.children) return false
    return paragraph.children.some((c) => {
        if (c.type === 'link' && c.url === url) return true
        if (c.children) {
            return c.children.some((gc) => gc.type === 'link' && gc.url === url)
        }
        return false
    })
}
