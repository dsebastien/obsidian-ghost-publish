import { Keymap } from 'obsidian'
import type { App } from 'obsidian'

/**
 * Open a vault note from a panel UI element. Matches Obsidian's own
 * wikilink anchors:
 *
 *   - Plain left click            → opens in the current tab.
 *   - Ctrl / Cmd + left click     → opens in a new tab.
 *   - Middle-button click         → opens in a new tab.
 *
 * Pass this as the handler for both `click` and `auxclick` so middle-button
 * clicks are caught (browsers only fire `click` for the primary button).
 */
export function openNoteLink(app: App, path: string, ev: MouseEvent): void {
    // Filter out right-clicks and other non-actionable buttons reaching the
    // auxclick handler.
    if (ev.button !== 0 && ev.button !== 1) return
    ev.preventDefault()
    const newLeaf = ev.button === 1 ? 'tab' : Keymap.isModEvent(ev)
    void app.workspace.openLinkText(path, path, newLeaf)
}
