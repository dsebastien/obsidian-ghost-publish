import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { TFile } from 'obsidian'
import type { App } from 'obsidian'
import type { GhostApiClient } from '../api/ghost-api-client'
import type { GhostPost } from '../types/ghost-api.intf'
import { createDefaultSettings } from '../types/plugin-settings.intf'
import type { PluginSettings } from '../types/plugin-settings.intf'
import { newPreset } from '../types/preset.intf'
import type { Preset } from '../types/preset.intf'
import { sha256Hex } from '../utils/content-hash.fn'

const probe = mock((_url: string): Promise<boolean> => Promise.resolve(true))
void mock.module('./canonical-probe', () => ({ canonicalProbe: probe }))
const { publicPostUrl, syncNote } = await import('./sync-note')

const NOTES = 'https://notes.example.com'
const NOTE_URL = `${NOTES}/Folder/My+Note`
const POST_URL = 'https://blog.example.com/my-note/'
const PREVIEW_URL = 'https://blog.example.com/p/uuid-1/'
const BODY = '# Title\n\nSome content.\n'

type PayloadMock = ReturnType<typeof mock>

interface Harness {
    app: App
    client: GhostApiClient
    frontmatter: Record<string, unknown>
    createPost: PayloadMock
    updatePost: PayloadMock
    processFrontMatter: PayloadMock
    file: TFile
}

function post(over: Partial<GhostPost> = {}): GhostPost {
    return {
        id: 'post-1',
        updated_at: '2026-01-01T00:00:00.000Z',
        status: 'published',
        url: POST_URL,
        ...over
    }
}

function harness(opts: {
    frontmatter?: Record<string, unknown>
    existing?: GhostPost
    created?: GhostPost
    updated?: GhostPost
    published?: GhostPost
}): Harness {
    const frontmatter: Record<string, unknown> = { ...opts.frontmatter }
    const processFrontMatter = mock(
        (_f: TFile, fn: (fm: Record<string, unknown>) => void): Promise<void> => {
            fn(frontmatter)
            return Promise.resolve()
        }
    )
    // Object.assign over an empty stub: only the members syncNote reads.
    const app: App = Object.assign({} as App, {
        metadataCache: {
            getFileCache: () => ({ frontmatter: { ...frontmatter } }),
            getFirstLinkpathDest: () => null
        },
        vault: { read: () => Promise.resolve(`---\ntitle: Title\n---\n${BODY}`) },
        fileManager: { processFrontMatter }
    })
    const createPost = mock((_p: Record<string, unknown>) =>
        Promise.resolve(opts.created ?? post())
    )
    const updatePost = mock((_id: string, _p: Record<string, unknown>) =>
        Promise.resolve(opts.updated ?? post())
    )
    const client: GhostApiClient = Object.assign({} as GhostApiClient, {
        createPost,
        updatePost,
        getPost: () => Promise.resolve(opts.existing ?? post()),
        publishDraft: () => Promise.resolve(opts.published ?? post())
    })
    const file = Object.assign(new TFile(), { path: 'Folder/My Note.md', basename: 'My Note' })
    return { app, client, frontmatter, createPost, updatePost, processFrontMatter, file }
}

function setup(
    presetOver: Partial<Preset> = {},
    settingsOver: Partial<PluginSettings> = {}
): {
    settings: PluginSettings
    preset: Preset
    fmKeys: PluginSettings['frontmatter']
    queued: Record<string, unknown>
} {
    const settings: PluginSettings = {
        ...createDefaultSettings(),
        notesBaseUrl: NOTES,
        skipCanonicalProbe: true,
        ...settingsOver
    }
    const preset: Preset = { ...newPreset('news', 'News'), ...presetOver }
    const fmKeys = settings.frontmatter
    const queued = { [fmKeys.flag]: true, [fmKeys.preset]: preset.id }
    return { settings, preset, fmKeys, queued }
}

function payloadOf(m: PayloadMock, arg: number): Record<string, unknown> {
    return m.mock.calls[0]![arg] as Record<string, unknown>
}

function htmlOf(m: PayloadMock, arg: number): string {
    return payloadOf(m, arg)['html'] as string
}

beforeEach(() => {
    probe.mockClear()
    probe.mockImplementation(() => Promise.resolve(true))
})

describe('syncNote', () => {
    it('leaves an unchanged note untouched (no frontmatter write)', async () => {
        const { settings, preset, fmKeys, queued } = setup()
        const h = harness({
            frontmatter: {
                ...queued,
                [fmKeys.ghostId]: 'post-1',
                [fmKeys.contentHash]: await sha256Hex(BODY),
                [fmKeys.syncedAt]: '2026-01-01T00:00:00.000Z'
            }
        })

        const result = await syncNote(h.app, h.client, settings, preset, h.file)

        expect(result.status).toBe('unchanged')
        expect(result.postId).toBe('post-1')
        expect(h.processFrontMatter).not.toHaveBeenCalled()
    })
})

describe('syncNote: link back to the note and canonical_url', () => {
    it('with both on (a migrated preset), sends canonical_url and the link back', async () => {
        const { settings, preset, queued } = setup({
            linkBackToNoteEnabled: true,
            canonicalUrlEnabled: true
        })
        const h = harness({ frontmatter: queued })

        await syncNote(h.app, h.client, settings, preset, h.file)

        expect(payloadOf(h.createPost, 0)['canonical_url']).toBe(NOTE_URL)
        expect(htmlOf(h.createPost, 0)).toContain(`<a href="${NOTE_URL}">`)
    })

    it('with only the link back, adds the link and sends no canonical_url', async () => {
        const { settings, preset, queued } = setup({ linkBackToNoteEnabled: true })
        const h = harness({ frontmatter: queued })

        await syncNote(h.app, h.client, settings, preset, h.file)

        expect(payloadOf(h.createPost, 0)).not.toHaveProperty('canonical_url')
        expect(htmlOf(h.createPost, 0)).toContain(`<a href="${NOTE_URL}">`)
    })

    it('with only canonical_url, sends the field and no link back', async () => {
        const { settings, preset, queued } = setup({ canonicalUrlEnabled: true })
        const h = harness({ frontmatter: queued })

        await syncNote(h.app, h.client, settings, preset, h.file)

        expect(payloadOf(h.createPost, 0)['canonical_url']).toBe(NOTE_URL)
        expect(htmlOf(h.createPost, 0)).not.toContain(NOTE_URL)
    })

    it('with both off, sends neither', async () => {
        const { settings, preset, queued } = setup()
        const h = harness({ frontmatter: queued })

        await syncNote(h.app, h.client, settings, preset, h.file)

        expect(payloadOf(h.createPost, 0)).not.toHaveProperty('canonical_url')
        expect(htmlOf(h.createPost, 0)).not.toContain(NOTE_URL)
    })

    it('clears the canonical_url it had set, on an update once the field is off', async () => {
        const { settings, preset, fmKeys, queued } = setup({ linkBackToNoteEnabled: true })
        const h = harness({
            frontmatter: { ...queued, [fmKeys.ghostId]: 'post-1', [fmKeys.contentHash]: 'old' },
            existing: post({ canonical_url: NOTE_URL })
        })

        const result = await syncNote(h.app, h.client, settings, preset, h.file)

        expect(result.status).toBe('updated')
        expect(payloadOf(h.updatePost, 1)).toHaveProperty('canonical_url', null)
        expect(htmlOf(h.updatePost, 1)).toContain(`<a href="${NOTE_URL}">`)
    })

    it('keeps a canonical_url that someone set by hand in Ghost', async () => {
        const { settings, preset, fmKeys, queued } = setup({ linkBackToNoteEnabled: true })
        const h = harness({
            frontmatter: { ...queued, [fmKeys.ghostId]: 'post-1', [fmKeys.contentHash]: 'old' },
            existing: post({ canonical_url: 'https://elsewhere.example.com/original' })
        })

        await syncNote(h.app, h.client, settings, preset, h.file)

        expect(payloadOf(h.updatePost, 1)).not.toHaveProperty('canonical_url')
    })

    it('sends no canonical_url on an update of a post that has none', async () => {
        const { settings, preset, fmKeys, queued } = setup()
        const h = harness({
            frontmatter: { ...queued, [fmKeys.ghostId]: 'post-1', [fmKeys.contentHash]: 'old' },
            existing: post({ canonical_url: null })
        })

        await syncNote(h.app, h.client, settings, preset, h.file)

        expect(payloadOf(h.updatePost, 1)).not.toHaveProperty('canonical_url')
    })

    it('probes the note URL when only the link back needs it', async () => {
        const { settings, preset, queued } = setup(
            { linkBackToNoteEnabled: true },
            { skipCanonicalProbe: false }
        )
        probe.mockImplementation(() => Promise.resolve(false))
        const h = harness({ frontmatter: queued })

        const result = await syncNote(h.app, h.client, settings, preset, h.file)

        expect(probe).toHaveBeenCalledWith(NOTE_URL)
        expect(result.status).toBe('skipped')
        expect(h.createPost).not.toHaveBeenCalled()
    })

    it('probes the note URL when only canonical_url needs it', async () => {
        const { settings, preset, queued } = setup(
            { canonicalUrlEnabled: true },
            { skipCanonicalProbe: false }
        )
        const h = harness({ frontmatter: queued })

        await syncNote(h.app, h.client, settings, preset, h.file)

        expect(probe).toHaveBeenCalledWith(NOTE_URL)
    })

    it('does not probe when neither needs the note URL', async () => {
        const { settings, preset, queued } = setup({}, { skipCanonicalProbe: false })
        const h = harness({ frontmatter: queued })

        await syncNote(h.app, h.client, settings, preset, h.file)

        expect(probe).not.toHaveBeenCalled()
    })
})

describe('publicPostUrl', () => {
    it('gives the URL of a published post', () => {
        expect(publicPostUrl(post())).toEqual({ url: POST_URL })
    })

    it('refuses a preview or not-found URL, even on a published post', () => {
        expect(publicPostUrl(post({ url: PREVIEW_URL })).url).toBeUndefined()
        expect(publicPostUrl(post({ url: 'https://blog.example.com/404/' })).url).toBeUndefined()
        expect(publicPostUrl(post({ url: '' })).note).toContain('no public URL')
    })

    it('says why when there is no post', () => {
        expect(publicPostUrl(undefined).note).toContain('no public URL yet')
    })
})

describe('syncNote: post URL property', () => {
    function withKey(key: string): ReturnType<typeof setup> {
        const s = setup()
        s.settings.frontmatter = { ...s.settings.frontmatter, postUrl: key }
        return s
    }

    it('writes nothing when no key is set (the default)', async () => {
        const { settings, preset, queued } = setup()
        const h = harness({ frontmatter: queued })

        const result = await syncNote(h.app, h.client, settings, preset, h.file)

        expect(result.status).toBe('created')
        expect(h.frontmatter).not.toHaveProperty('')
        expect(Object.values(h.frontmatter)).not.toContain(POST_URL)
        expect(result.postUrl).toBeUndefined()
        expect(result.postUrlNote).toBeUndefined()
    })

    it('writes the public URL that Ghost returns after a create', async () => {
        const { settings, preset, queued } = withKey('ghost_url')
        const h = harness({ frontmatter: queued })

        const result = await syncNote(h.app, h.client, settings, preset, h.file)

        expect(h.frontmatter['ghost_url']).toBe(POST_URL)
        expect(result.postUrl).toBe(POST_URL)
    })

    it('writes the new URL after an update that changed it', async () => {
        const { settings, preset, fmKeys, queued } = withKey('ghost_url')
        const h = harness({
            frontmatter: {
                ...queued,
                [fmKeys.ghostId]: 'post-1',
                [fmKeys.contentHash]: 'old',
                ghost_url: 'https://blog.example.com/old-slug/'
            },
            updated: post({ url: POST_URL })
        })

        await syncNote(h.app, h.client, settings, preset, h.file)

        expect(h.frontmatter['ghost_url']).toBe(POST_URL)
    })

    it('does not rewrite the property when the URL is the same', async () => {
        const { settings, preset, fmKeys, queued } = withKey('ghost_url')
        const h = harness({
            frontmatter: { ...queued, [fmKeys.ghostId]: 'post-1', [fmKeys.contentHash]: 'old' }
        })
        let writes = 0
        let stored: unknown = POST_URL
        Object.defineProperty(h.frontmatter, 'ghost_url', {
            enumerable: true,
            configurable: true,
            get: (): unknown => stored,
            set: (v: unknown): void => {
                writes += 1
                stored = v
            }
        })

        const result = await syncNote(h.app, h.client, settings, preset, h.file)

        expect(writes).toBe(0)
        expect(stored).toBe(POST_URL)
        expect(result.postUrl).toBe(POST_URL)
    })

    it('writes nothing for a draft and says why', async () => {
        const { settings, preset, queued } = withKey('ghost_url')
        const h = harness({
            frontmatter: queued,
            created: post({ status: 'draft', url: PREVIEW_URL })
        })

        const result = await syncNote(h.app, h.client, settings, preset, h.file)

        expect(h.frontmatter).not.toHaveProperty('ghost_url')
        expect(result.postUrl).toBeUndefined()
        expect(result.postUrlNote).toContain('draft')
    })

    it('writes nothing for a scheduled post and says why', async () => {
        const { settings, preset, queued } = withKey('ghost_url')
        const h = harness({
            frontmatter: queued,
            created: post({ status: 'scheduled', url: PREVIEW_URL })
        })

        const result = await syncNote(h.app, h.client, settings, preset, h.file)

        expect(h.frontmatter).not.toHaveProperty('ghost_url')
        expect(result.postUrlNote).toContain('scheduled')
    })

    it('writes the URL of a post published with its newsletter', async () => {
        const { settings, preset, fmKeys, queued } = withKey('ghost_url')
        preset.newsletterSlug = 'weekly'
        const h = harness({
            frontmatter: { ...queued, [fmKeys.emailFlag]: true },
            created: post({ status: 'draft', url: PREVIEW_URL }),
            published: post({ status: 'published', url: POST_URL })
        })

        const result = await syncNote(h.app, h.client, settings, preset, h.file)

        expect(result.emailed).toBe(true)
        expect(h.frontmatter['ghost_url']).toBe(POST_URL)
    })
})
