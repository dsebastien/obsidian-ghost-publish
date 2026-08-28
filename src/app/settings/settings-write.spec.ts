import { describe, expect, test, mock } from 'bun:test'
import { produce } from 'immer'
import { GhostPublishPlugin } from '../plugin'
import { GhostPublishSettingTab } from './settings-tab'
import { DEFAULT_SETTINGS } from '../types/plugin-settings.intf'
import { newPreset } from '../types/preset.intf'

/**
 * Behavioral coverage for the settings write path.
 *
 * `settings-guard.spec.ts` only scans source text, and nothing in CI renders a
 * settings pane. These tests exercise the properties no UI test can reach:
 * writes are serialized, memory is committed only after persistence succeeds,
 * a rejected value never reaches the store, and structural preset edits are
 * serialized behind the latch.
 */

/** Lets the fire-and-forget writes the pane starts run to completion. */
async function settle(): Promise<void> {
    for (let i = 0; i < 20; i += 1) {
        await Promise.resolve()
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
}

async function expectRejection(promise: Promise<unknown>, contains: string): Promise<void> {
    let caught: unknown
    await promise.catch((error: unknown) => {
        caught = error
    })
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toContain(contains)
}

interface Harness {
    plugin: GhostPublishPlugin
    tab: GhostPublishSettingTab
    saveData: ReturnType<typeof mock>
    refreshView: ReturnType<typeof mock>
    update: ReturnType<typeof mock>
}

function createHarness(options?: { saveData?: () => Promise<void> }): Harness {
    const saveData = mock(async () => {
        if (options?.saveData) {
            await options.saveData()
        }
    })
    const refreshView = mock(() => {})
    const update = mock(() => {})

    const plugin = Object.create(GhostPublishPlugin.prototype) as GhostPublishPlugin
    const internals = plugin as unknown as Record<string, unknown>
    internals['settings'] = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)
    internals['settingsWriteChain'] = Promise.resolve()
    internals['saveData'] = saveData
    internals['refreshView'] = refreshView

    const tab = Object.create(GhostPublishSettingTab.prototype) as GhostPublishSettingTab
    const tabInternals = tab as unknown as Record<string, unknown>
    tabInternals['plugin'] = plugin
    tabInternals['update'] = update
    tabInternals['presetActionPending'] = false

    return { plugin, tab, saveData, refreshView, update }
}

/** Reaches the private commitPresets without widening its visibility. */
function commitPresets(tab: GhostPublishSettingTab, mutator: (presets: unknown[]) => void): void {
    ;(tab as unknown as { commitPresets: (m: (presets: unknown[]) => void) => void }).commitPresets(
        mutator
    )
}

describe('updateSettings', () => {
    test('commits to memory only after the write is persisted', async () => {
        let release = (): void => {}
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        const { plugin, saveData } = createHarness({ saveData: () => gate })

        const pending = plugin.updateSettings((draft) => {
            draft.skipCanonicalProbe = !DEFAULT_SETTINGS.skipCanonicalProbe
        })

        // Let the queued write start and reach its save await; a bare
        // synchronous assertion would pass even with the ordering reversed,
        // because the chain defers the work to a microtask.
        await Promise.resolve()
        await Promise.resolve()
        expect(saveData).toHaveBeenCalledTimes(1)
        expect(plugin.settings.skipCanonicalProbe).toBe(DEFAULT_SETTINGS.skipCanonicalProbe)

        release()
        await pending
        expect(plugin.settings.skipCanonicalProbe).toBe(!DEFAULT_SETTINGS.skipCanonicalProbe)
    })

    test('leaves memory untouched when persistence fails', async () => {
        const { plugin } = createHarness({
            saveData: () => Promise.reject(new Error('disk full'))
        })

        await expectRejection(
            plugin.updateSettings((draft) => {
                draft.ghostUrl = 'https://example.ghost.io'
            }),
            'disk full'
        )

        expect(plugin.settings.ghostUrl).toBe(DEFAULT_SETTINGS.ghostUrl)
    })

    test('overlapping writes do not drop each other', async () => {
        let releaseFirst = (): void => {}
        const first = new Promise<void>((resolve) => {
            releaseFirst = resolve
        })
        let call = 0
        const { plugin } = createHarness({
            saveData: () => {
                call += 1
                return call === 1 ? first : Promise.resolve()
            }
        })

        const a = plugin.updateSettings((draft) => {
            draft.mocTag = 'type/map/moc'
        })
        const b = plugin.updateSettings((draft) => {
            draft.skipCanonicalProbe = true
        })

        releaseFirst()
        await Promise.all([a, b])

        expect(plugin.settings.mocTag).toBe('type/map/moc')
        expect(plugin.settings.skipCanonicalProbe).toBe(true)
    })
})

describe('setControlValue', () => {
    test('normalizes the Ghost and mirror URLs (trim + trailing slashes)', async () => {
        const { tab, plugin } = createHarness()

        await tab.setControlValue('ghostUrl', '  https://example.ghost.io// ')
        await tab.setControlValue('notesBaseUrl', 'https://notes.example.com/ ')

        expect(plugin.settings.ghostUrl).toBe('https://example.ghost.io')
        expect(plugin.settings.notesBaseUrl).toBe('https://notes.example.com')
    })

    test('round-trips the textarea-backed lists', async () => {
        const { tab, plugin } = createHarness()

        await tab.setControlValue('excludedFolders', ' Journal \n\nTemplates\n')
        await tab.setControlValue('stripSections', 'References\nRelated')

        expect(plugin.settings.excludedFolders).toEqual(['Journal', 'Templates'])
        expect(plugin.settings.stripSections).toEqual(['References', 'Related'])
        expect(tab.getControlValue('excludedFolders')).toBe('Journal\nTemplates')
        expect(tab.getControlValue('stripSections')).toBe('References\nRelated')
    })

    test('parses the known-URL map and drops malformed lines', async () => {
        const { tab, plugin } = createHarness()

        await tab.setControlValue(
            'knownUrls',
            'My Note=https://example.com/a\nnot-a-mapping\n=missing-key\nOther = https://example.com/b'
        )

        expect(plugin.settings.knownUrls).toEqual({
            'My Note': 'https://example.com/a',
            'Other': 'https://example.com/b'
        })
        expect(tab.getControlValue('knownUrls')).toBe(
            'My Note=https://example.com/a\nOther=https://example.com/b'
        )
    })

    test('writes frontmatter property names through their dot keys, trimmed', async () => {
        const { tab, plugin } = createHarness()

        await tab.setControlValue('frontmatter.ghostId', ' ghost_id ')

        expect(plugin.settings.frontmatter.ghostId).toBe('ghost_id')
        expect(tab.getControlValue('frontmatter.ghostId')).toBe('ghost_id')
    })

    test('rejects an unknown frontmatter field without writing', async () => {
        const { tab, saveData } = createHarness()

        await expectRejection(tab.setControlValue('frontmatter.nope', 'x'), 'known field')
        expect(saveData).not.toHaveBeenCalled()
    })

    test('rejects a wrongly typed value without writing', async () => {
        const { tab, plugin, saveData } = createHarness()

        await expectRejection(tab.setControlValue('skipCanonicalProbe', 'yes'), 'boolean')
        await expectRejection(tab.setControlValue('ghostUrl', 42), 'string')
        expect(saveData).not.toHaveBeenCalled()
        expect(plugin.settings.skipCanonicalProbe).toBe(DEFAULT_SETTINGS.skipCanonicalProbe)
    })

    test('rejects an unknown key', async () => {
        const { tab, saveData } = createHarness()

        await expectRejection(tab.setControlValue('nope', true), 'known field')
        expect(saveData).not.toHaveBeenCalled()
    })

    test('getControlValue answers for every declared scalar key', () => {
        const { tab, plugin } = createHarness()

        expect(tab.getControlValue('ghostUrl')).toBe(plugin.settings.ghostUrl)
        expect(tab.getControlValue('notesBaseUrl')).toBe(plugin.settings.notesBaseUrl)
        expect(tab.getControlValue('mocTag')).toBe(plugin.settings.mocTag)
        expect(tab.getControlValue('skipCanonicalProbe')).toBe(plugin.settings.skipCanonicalProbe)
        expect(tab.getControlValue('debugModeEnabled')).toBe(plugin.settings.debugModeEnabled)
        expect(tab.getControlValue('nope')).toBeUndefined()
    })
})

describe('preset structural edits', () => {
    test('persist before the view refresh and re-render', async () => {
        let release = (): void => {}
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        const { tab, plugin, refreshView, update } = createHarness({ saveData: () => gate })

        commitPresets(tab, (presets) => {
            presets.push(newPreset('id-1', 'Blog'))
        })

        await Promise.resolve()
        await Promise.resolve()
        expect(refreshView).not.toHaveBeenCalled()
        expect(update).not.toHaveBeenCalled()

        release()
        await settle()

        expect(plugin.settings.presets).toHaveLength(1)
        expect(refreshView).toHaveBeenCalledTimes(1)
        expect(update).toHaveBeenCalledTimes(1)
    })

    test('the latch serializes structural edits: a second click during a pending write is ignored', async () => {
        let release = (): void => {}
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        let gating = true
        const { tab, plugin } = createHarness({
            saveData: () => (gating ? gate : Promise.resolve())
        })

        commitPresets(tab, (presets) => {
            presets.push(newPreset('id-1', 'First'))
        })
        // Second structural click while the first write is still pending:
        // dropped by the latch rather than acting on stale rows.
        commitPresets(tab, (presets) => {
            presets.push(newPreset('id-2', 'Second'))
        })

        gating = false
        release()
        await settle()

        expect(plugin.settings.presets.map((p) => p.id)).toEqual(['id-1'])
    })

    test('a failed structural write releases the latch and does not refresh', async () => {
        const failing = createHarness({
            saveData: () => Promise.reject(new Error('disk full'))
        })

        commitPresets(failing.tab, (presets) => {
            presets.push(newPreset('id-1', 'Blog'))
        })
        await settle()

        expect(failing.plugin.settings.presets).toHaveLength(0)
        expect(failing.refreshView).not.toHaveBeenCalled()
        expect(failing.update).not.toHaveBeenCalled()

        // The latch must be released: a later edit still lands.
        const retryGate = failing
        ;(retryGate.plugin as unknown as Record<string, unknown>)['saveData'] = mock(async () => {})
        commitPresets(retryGate.tab, (presets) => {
            presets.push(newPreset('id-2', 'Retry'))
        })
        await settle()

        expect(retryGate.plugin.settings.presets.map((p) => p.id)).toEqual(['id-2'])
    })
})
