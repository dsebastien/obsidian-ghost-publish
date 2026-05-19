import type { GhostApiClient } from '../api/ghost-api-client'
import { log } from '../../utils/log'

interface LexicalNode {
    type?: string
    url?: string
    text?: string
    children?: LexicalNode[]
    [key: string]: unknown
}

interface LexicalDoc {
    root: LexicalNode
}

/**
 * Convert every link-block paragraph that contains one of the supplied URLs
 * into a Ghost bookmark card (or oembed embed for embeddable providers).
 *
 * `explicitMode = true` matches any paragraph containing the URL,
 * regardless of the 🔗 marker. The caller passes the URLs the markdown
 * pipeline already detected, so the marker check is redundant in this
 * plugin — kept for parity with the original script.
 */
export async function embedLinkUrls(
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
            log(`Oembed lookup failed for ${url}`, 'warn', e)
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
                        const metadata = (oembed['metadata'] ?? {}) as Record<string, unknown>
                        if (oembed['type'] === 'bookmark') {
                            node.children[i] = {
                                type: 'bookmark',
                                version: 1,
                                url,
                                metadata,
                                caption: null
                            }
                        } else {
                            node.children[i] = {
                                type: 'embed',
                                version: 1,
                                url,
                                html: oembed['html'],
                                embedType: oembed['type'],
                                metadata: {
                                    title: oembed['title'] ?? metadata['title'],
                                    thumbnail_url: oembed['thumbnail_url'] ?? metadata['thumbnail'],
                                    author_name: oembed['author_name'] ?? metadata['author'],
                                    publisher: metadata['publisher']
                                },
                                caption: null
                            }
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
