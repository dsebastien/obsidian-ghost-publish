import { FuzzySuggestModal } from 'obsidian'
import type { App } from 'obsidian'
import type { Preset } from '../types/preset.intf'

/** Pick one preset by name (used by the "sync again" command). */
export class PresetSuggestModal extends FuzzySuggestModal<Preset> {
    private readonly presets: Preset[]
    private readonly onPick: (preset: Preset) => void

    constructor(app: App, presets: Preset[], onPick: (preset: Preset) => void) {
        super(app)
        this.presets = presets
        this.onPick = onPick
        this.setPlaceholder('Pick a preset')
    }

    override getItems(): Preset[] {
        return this.presets
    }

    override getItemText(preset: Preset): string {
        return preset.name
    }

    override onChooseItem(preset: Preset): void {
        this.onPick(preset)
    }
}
