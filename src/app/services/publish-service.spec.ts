import { describe, expect, it, mock } from 'bun:test'
import { TFile } from 'obsidian'
import type { App } from 'obsidian'
import type { GhostApiClient } from '../api/ghost-api-client'
import type { GhostPost } from '../types/ghost-api.intf'
import { createDefaultSettings } from '../types/plugin-settings.intf'
import { newPreset } from '../types/preset.intf'
import { sha256Hex } from '../utils/content-hash.fn'
import { notesToResync, resyncPostsForPreset } from './publish-service'

const BODY = 'Some content.\n'

function post(id: string): GhostPost {
    return { id, updated_at: '2026-01-01T00:00:00.000Z', status: 'published' }
}

async function vault(): Promise<{
    app: App
    notes: Map<string, Record<string, unknown>>
}> {
    const settings = createDefaultSettings()
    const fm = settings.frontmatter
    const hash = await sha256Hex(BODY)
    const notes = new Map<string, Record<string, unknown>>([
        // On Ghost, content unchanged since the last sync.
        [
            'live.md',
            { [fm.flag]: true, [fm.preset]: 'news', [fm.ghostId]: 'p1', [fm.contentHash]: hash }
        ],
        // On Ghost, opted into the newsletter that was never sent.
        [
            'email.md',
            {
                [fm.flag]: true,
                [fm.preset]: 'news',
                [fm.ghostId]: 'p2',
                [fm.contentHash]: hash,
                [fm.emailFlag]: true
            }
        ],
        // Queued but never pushed: the normal sync handles it.
        ['new.md', { [fm.flag]: true, [fm.preset]: 'news' }],
        // Another preset.
        [
            'other.md',
            { [fm.flag]: true, [fm.preset]: 'blog', [fm.ghostId]: 'p3', [fm.contentHash]: hash }
        ]
    ])
    const files = [...notes.keys()].map((path) =>
        Object.assign(new TFile(), {
            path,
            basename: path.replace(/\.md$/, ''),
            stat: { mtime: 0 }
        })
    )
    const app: App = Object.assign({} as App, {
        vault: {
            getMarkdownFiles: (): TFile[] => files,
            read: (): Promise<string> => Promise.resolve(BODY)
        },
        metadataCache: {
            getFileCache: (f: TFile) => ({ frontmatter: { ...notes.get(f.path) } }),
            getFirstLinkpathDest: (): null => null
        },
        fileManager: {
            processFrontMatter: (
                f: TFile,
                fn: (front: Record<string, unknown>) => void
            ): Promise<void> => {
                fn(notes.get(f.path)!)
                return Promise.resolve()
            }
        }
    })
    return { app, notes }
}

function stubClient(): {
    client: GhostApiClient
    updatePost: ReturnType<typeof mock>
    createPost: ReturnType<typeof mock>
    publishDraft: ReturnType<typeof mock>
} {
    const updatePost = mock((id: string) => Promise.resolve(post(id)))
    const createPost = mock(() => Promise.resolve(post('created')))
    const publishDraft = mock(() => Promise.resolve(post('p2')))
    const client: GhostApiClient = Object.assign({} as GhostApiClient, {
        getPost: (id: string): Promise<GhostPost> => Promise.resolve(post(id)),
        updatePost,
        createPost,
        publishDraft
    })
    return { client, updatePost, createPost, publishDraft }
}

describe('sync again every note of a preset', () => {
    it('counts only the notes of the preset that are already on Ghost', async () => {
        const { app } = await vault()
        const paths = notesToResync(app, createDefaultSettings(), 'news').map((n) => n.file.path)
        expect(paths.sort()).toEqual(['email.md', 'live.md'])
    })

    it('updates every live post, also when the content did not change', async () => {
        const { app } = await vault()
        const stub = stubClient()
        const preset = { ...newPreset('news', 'News'), newsletterSlug: 'weekly' }

        const { summary } = await resyncPostsForPreset(
            app,
            createDefaultSettings(),
            preset,
            stub.client
        )

        expect(summary.updated).toBe(2)
        expect(summary.unchanged).toBe(0)
        const ids = stub.updatePost.mock.calls.map((c) => c[0] as string).sort()
        expect(ids).toEqual(['p1', 'p2'])
        expect(stub.createPost).not.toHaveBeenCalled()
    })

    it('never sends an email', async () => {
        const { app, notes } = await vault()
        const stub = stubClient()
        const settings = createDefaultSettings()
        const preset = { ...newPreset('news', 'News'), newsletterSlug: 'weekly' }

        await resyncPostsForPreset(app, settings, preset, stub.client)

        expect(stub.publishDraft).not.toHaveBeenCalled()
        expect(notes.get('email.md')).not.toHaveProperty(settings.frontmatter.emailedAt)
    })
})
