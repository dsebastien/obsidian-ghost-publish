import { describe, expect, it, mock } from 'bun:test'
import { TFile } from 'obsidian'
import type { App } from 'obsidian'
import type { GhostApiClient } from '../api/ghost-api-client'
import { createDefaultSettings } from '../types/plugin-settings.intf'
import { newPreset } from '../types/preset.intf'
import { sha256Hex } from '../utils/content-hash.fn'
import { syncNote } from './sync-note'

describe('syncNote', () => {
    it('leaves an unchanged note untouched (no frontmatter write)', async () => {
        const settings = createDefaultSettings()
        const fmKeys = settings.frontmatter
        const preset = newPreset('news', 'News')
        const body = '# Title\n\nSome content.\n'
        const frontmatter: Record<string, unknown> = {
            [fmKeys.flag]: true,
            [fmKeys.preset]: preset.id,
            [fmKeys.ghostId]: 'post-1',
            [fmKeys.contentHash]: await sha256Hex(body),
            [fmKeys.syncedAt]: '2026-01-01T00:00:00.000Z'
        }
        const processFrontMatter = mock(async () => {})
        const app = {
            metadataCache: { getFileCache: () => ({ frontmatter }) },
            vault: { read: () => Promise.resolve(`---\ntitle: Title\n---\n${body}`) },
            fileManager: { processFrontMatter }
        } as unknown as App
        const file = Object.assign(new TFile(), { path: 'note.md', basename: 'note' })

        const result = await syncNote(app, {} as GhostApiClient, settings, preset, file)

        expect(result.status).toBe('unchanged')
        expect(result.postId).toBe('post-1')
        expect(processFrontMatter).not.toHaveBeenCalled()
    })
})
