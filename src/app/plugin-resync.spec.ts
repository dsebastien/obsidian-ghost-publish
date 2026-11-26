import { describe, expect, mock, test } from 'bun:test'
import { produce } from 'immer'
import type { App } from 'obsidian'
import { createDefaultSettings } from './types/plugin-settings.intf'
import { newPreset } from './types/preset.intf'
import type { Preset } from './types/preset.intf'

const offered: Preset[][] = []
void mock.module('./ui/preset-suggest-modal', () => ({
    PresetSuggestModal: class {
        constructor(_app: App, presets: Preset[]) {
            offered.push(presets)
        }
        open(): void {}
    }
}))
const { GhostPublishPlugin } = await import('./plugin')

describe('sync again command', () => {
    test('offers only the enabled presets', () => {
        const plugin = Object.assign(
            Object.create(GhostPublishPlugin.prototype) as InstanceType<typeof GhostPublishPlugin>,
            {
                app: {} as App,
                settings: produce(createDefaultSettings(), (d) => {
                    d.presets = [
                        { ...newPreset('on', 'On') },
                        { ...newPreset('off', 'Off'), enabled: false }
                    ]
                })
            }
        )

        plugin.pickPresetToResync()

        expect(offered.at(-1)?.map((p) => p.id)).toEqual(['on'])
    })
})
