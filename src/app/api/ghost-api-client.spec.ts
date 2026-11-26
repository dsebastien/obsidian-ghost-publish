import { beforeEach, describe, expect, it, mock } from 'bun:test'

interface FakeResponse {
    status: number
    text: string
    readonly json: unknown
}

let respond: () => FakeResponse = () => jsonResponse(200, {})

function jsonResponse(status: number, body: unknown): FakeResponse {
    return { status, text: JSON.stringify(body), json: body }
}

const requestUrl = mock((_params: unknown): Promise<FakeResponse> => Promise.resolve(respond()))
const real = await import('obsidian')
void mock.module('obsidian', () => ({ ...real, requestUrl }))
void mock.module('./ghost-auth', () => ({
    createGhostAdminToken: (): Promise<string> => Promise.resolve('token')
}))
const { GhostApiClient } = await import('./ghost-api-client')

beforeEach(() => {
    requestUrl.mockClear()
})

describe('GhostApiClient.publishDraft', () => {
    const client = new GhostApiClient('https://blog.example.com', 'id:secret')

    it('returns the published post', async () => {
        respond = () =>
            jsonResponse(200, {
                posts: [{ id: 'p1', status: 'published', url: 'https://blog.example.com/a/' }]
            })

        const published = await client.publishDraft('p1', '2026-01-01T00:00:00.000Z', 'weekly')

        expect(published?.url).toBe('https://blog.example.com/a/')
        const params = requestUrl.mock.calls[0]![0] as { url: string; method: string }
        expect(params.method).toBe('PUT')
        expect(params.url).toContain('?newsletter=weekly')
    })

    it('returns undefined, not an error, when a successful answer has no post', async () => {
        respond = () => jsonResponse(200, {})
        expect(await client.publishDraft('p1', 'x')).toBeUndefined()

        respond = () => jsonResponse(200, { posts: [] })
        expect(await client.publishDraft('p1', 'x')).toBeUndefined()
    })

    it('returns undefined when a successful answer is not JSON', async () => {
        respond = () => ({
            status: 200,
            text: 'ok',
            get json(): unknown {
                throw new SyntaxError('Unexpected token')
            }
        })
        expect(await client.publishDraft('p1', 'x')).toBeUndefined()
    })

    it('still throws when Ghost refuses the publish', async () => {
        respond = () => jsonResponse(422, { errors: [{ message: 'Validation error' }] })
        let error: unknown
        try {
            await client.publishDraft('p1', 'x')
        } catch (e) {
            error = e
        }
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Validation error')
    })
})
