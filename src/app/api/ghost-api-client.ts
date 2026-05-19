import { requestUrl } from 'obsidian'
import type { RequestUrlParam, RequestUrlResponse } from 'obsidian'
import { createGhostAdminToken } from './ghost-auth'
import type {
    GhostImageUploadResponse,
    GhostNewsletterSummary,
    GhostNewslettersResponse,
    GhostOembedResponse,
    GhostPost,
    GhostPostsResponse,
    GhostTagSummary,
    GhostTagsResponse
} from '../types/ghost-api.intf'
import { log } from '../../utils/log'

export class GhostApiError extends Error {
    statusCode: number
    detail: string
    constructor(detail: string, statusCode: number) {
        super(detail)
        this.name = 'GhostApiError'
        this.statusCode = statusCode
        this.detail = detail
    }
}

interface MultipartField {
    name: string
    /** A plain field value. */
    value?: string
    /** A file field. */
    filename?: string
    data?: ArrayBuffer
    contentType?: string
}

/**
 * Build a multipart/form-data body manually so requestUrl can ship it.
 * Returns an ArrayBuffer and the boundary string.
 */
function buildMultipart(fields: MultipartField[]): { body: ArrayBuffer; boundary: string } {
    const boundary = `----GhostPublish${Math.random().toString(16).slice(2)}`
    const chunks: Uint8Array[] = []
    const encoder = new TextEncoder()
    const CRLF = '\r\n'

    for (const f of fields) {
        chunks.push(encoder.encode(`--${boundary}${CRLF}`))
        if (f.filename && f.data) {
            chunks.push(
                encoder.encode(
                    `Content-Disposition: form-data; name="${f.name}"; filename="${f.filename}"${CRLF}`
                )
            )
            chunks.push(
                encoder.encode(
                    `Content-Type: ${f.contentType ?? 'application/octet-stream'}${CRLF}${CRLF}`
                )
            )
            chunks.push(new Uint8Array(f.data))
            chunks.push(encoder.encode(CRLF))
        } else {
            chunks.push(
                encoder.encode(`Content-Disposition: form-data; name="${f.name}"${CRLF}${CRLF}`)
            )
            chunks.push(encoder.encode(`${f.value ?? ''}${CRLF}`))
        }
    }
    chunks.push(encoder.encode(`--${boundary}--${CRLF}`))

    const total = chunks.reduce((sum, c) => sum + c.byteLength, 0)
    const merged = new Uint8Array(total)
    let offset = 0
    for (const c of chunks) {
        merged.set(c, offset)
        offset += c.byteLength
    }
    return { body: merged.buffer, boundary }
}

export class GhostApiClient {
    private readonly baseUrl: string
    private readonly adminKey: string

    constructor(baseUrl: string, adminKey: string) {
        this.baseUrl = baseUrl.replace(/\/+$/, '')
        this.adminKey = adminKey
    }

    async getPost(postId: string): Promise<GhostPost> {
        const res = await this.request({
            method: 'GET',
            path: `/ghost/api/admin/posts/${encodeURIComponent(postId)}/?formats=lexical`
        })
        return (res.json as GhostPostsResponse).posts[0]!
    }

    async createPost(post: Record<string, unknown>): Promise<GhostPost> {
        const res = await this.request({
            method: 'POST',
            path: `/ghost/api/admin/posts/?source=html`,
            body: JSON.stringify({ posts: [post] }),
            contentType: 'application/json'
        })
        return (res.json as GhostPostsResponse).posts[0]!
    }

    async updatePost(postId: string, post: Record<string, unknown>): Promise<GhostPost> {
        const res = await this.request({
            method: 'PUT',
            path: `/ghost/api/admin/posts/${encodeURIComponent(postId)}/?source=html`,
            body: JSON.stringify({ posts: [post] }),
            contentType: 'application/json'
        })
        return (res.json as GhostPostsResponse).posts[0]!
    }

    /**
     * Update a post's lexical content directly (no source=html conversion).
     * Used by the YouTube / link-block embed upgrade.
     */
    async updateLexical(postId: string, lexical: string, updatedAt: string): Promise<void> {
        await this.request({
            method: 'PUT',
            path: `/ghost/api/admin/posts/${encodeURIComponent(postId)}/`,
            body: JSON.stringify({ posts: [{ lexical, updated_at: updatedAt }] }),
            contentType: 'application/json'
        })
    }

    /**
     * Publish a draft, optionally triggering a newsletter email. Ghost only
     * fires the newsletter on the draft→published transition.
     */
    async publishDraft(postId: string, updatedAt: string, newsletterSlug?: string): Promise<void> {
        const qs = newsletterSlug ? `?newsletter=${encodeURIComponent(newsletterSlug)}` : ''
        await this.request({
            method: 'PUT',
            path: `/ghost/api/admin/posts/${encodeURIComponent(postId)}/${qs}`,
            body: JSON.stringify({ posts: [{ status: 'published', updated_at: updatedAt }] }),
            contentType: 'application/json'
        })
    }

    async uploadImage(filename: string, data: ArrayBuffer, contentType: string): Promise<string> {
        const { body, boundary } = buildMultipart([
            { name: 'file', filename, data, contentType },
            { name: 'purpose', value: 'image' }
        ])
        const res = await this.request({
            method: 'POST',
            path: `/ghost/api/admin/images/upload/`,
            body,
            contentType: `multipart/form-data; boundary=${boundary}`
        })
        return (res.json as GhostImageUploadResponse).images[0]!.url
    }

    async oembed(url: string): Promise<GhostOembedResponse> {
        const res = await this.request({
            method: 'GET',
            path: `/ghost/api/admin/oembed/?url=${encodeURIComponent(url)}`
        })
        return res.json as GhostOembedResponse
    }

    /**
     * Fetch every tag, paginating until the API reports no more pages. Used
     * by the settings UI to populate the tag autocomplete cache.
     */
    async listAllTags(): Promise<GhostTagSummary[]> {
        const out: GhostTagSummary[] = []
        let page = 1
        for (;;) {
            const res = await this.request({
                method: 'GET',
                path: `/ghost/api/admin/tags/?limit=100&page=${page}`
            })
            const body = res.json as GhostTagsResponse
            out.push(...(body.tags ?? []))
            const next = body.meta?.pagination?.next
            if (!next) return out
            page = next
        }
    }

    /**
     * Fetch every newsletter, paginating until exhausted. The Ghost API
     * usually returns only active newsletters when no filter is supplied.
     */
    async listAllNewsletters(): Promise<GhostNewsletterSummary[]> {
        const out: GhostNewsletterSummary[] = []
        let page = 1
        for (;;) {
            const res = await this.request({
                method: 'GET',
                path: `/ghost/api/admin/newsletters/?limit=100&page=${page}`
            })
            const body = res.json as GhostNewslettersResponse
            out.push(...(body.newsletters ?? []))
            const next = body.meta?.pagination?.next
            if (!next) return out
            page = next
        }
    }

    private async request(opts: {
        method: string
        path: string
        body?: string | ArrayBuffer
        contentType?: string
    }): Promise<RequestUrlResponse> {
        const token = await createGhostAdminToken(this.adminKey)
        const url = `${this.baseUrl}${opts.path}`
        log(`${opts.method} ${url}`, 'debug')

        const params: RequestUrlParam = {
            url,
            method: opts.method,
            headers: {
                Authorization: `Ghost ${token}`
            },
            throw: false
        }
        if (opts.contentType) {
            params.contentType = opts.contentType
        }
        if (opts.body !== undefined) {
            params.body = opts.body
        }

        const res = await requestUrl(params)

        if (res.status >= 200 && res.status < 300) {
            return res
        }

        let detail = `Request failed with status ${res.status}`
        try {
            const json = res.json as { errors?: { message?: string }[] } | undefined
            if (json?.errors?.[0]?.message) {
                detail = json.errors[0].message
            } else if (res.text) {
                detail = res.text.slice(0, 500)
            }
        } catch {
            // ignore
        }
        throw new GhostApiError(detail, res.status)
    }
}
