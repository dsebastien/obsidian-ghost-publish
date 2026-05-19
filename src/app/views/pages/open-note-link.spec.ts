import { afterEach, describe, expect, it } from 'bun:test'
import { Keymap } from 'obsidian'
import type { App } from 'obsidian'
import { openNoteLink } from './open-note-link'

interface RecordedCall {
    linktext: string
    sourcePath: string
    newLeaf: unknown
}

function makeApp(): { app: App; calls: RecordedCall[] } {
    const calls: RecordedCall[] = []
    const app = {
        workspace: {
            openLinkText: (
                linktext: string,
                sourcePath: string,
                newLeaf?: unknown
            ): Promise<void> => {
                calls.push({ linktext, sourcePath, newLeaf })
                return Promise.resolve()
            }
        }
    } as unknown as App
    return { app, calls }
}

function makeEvent(button: number): { ev: MouseEvent; prevented: { value: boolean } } {
    const prevented = { value: false }
    const ev = {
        button,
        preventDefault: (): void => {
            prevented.value = true
        }
    } as unknown as MouseEvent
    return { ev, prevented }
}

// The test-setup mock returns `false` from `Keymap.isModEvent`. We re-set
// the static back to that default after each test, so individual tests
// can override it freely.
const defaultIsModEvent = (): false => false

afterEach(() => {
    Keymap.isModEvent = defaultIsModEvent
})

describe('openNoteLink', () => {
    it('opens in the current tab on a plain left click', () => {
        const { app, calls } = makeApp()
        const { ev, prevented } = makeEvent(0)
        openNoteLink(app, 'Notes/foo.md', ev)
        expect(prevented.value).toBe(true)
        expect(calls.length).toBe(1)
        expect(calls[0]).toEqual({
            linktext: 'Notes/foo.md',
            sourcePath: 'Notes/foo.md',
            newLeaf: false
        })
    })

    it('opens in a new tab on Ctrl/Cmd + left click', () => {
        const { app, calls } = makeApp()
        const { ev } = makeEvent(0)
        // Simulate Keymap.isModEvent returning `'tab'` (what it returns when
        // Ctrl/Cmd is held).
        Keymap.isModEvent = () => 'tab'
        openNoteLink(app, 'Notes/foo.md', ev)
        expect(calls.length).toBe(1)
        expect(calls[0]?.newLeaf).toBe('tab')
    })

    it('opens in a new tab on a middle-button click', () => {
        const { app, calls } = makeApp()
        const { ev, prevented } = makeEvent(1)
        openNoteLink(app, 'Notes/foo.md', ev)
        expect(prevented.value).toBe(true)
        expect(calls.length).toBe(1)
        expect(calls[0]?.newLeaf).toBe('tab')
    })

    it('ignores right-clicks (no openLinkText call, no preventDefault)', () => {
        const { app, calls } = makeApp()
        const { ev, prevented } = makeEvent(2)
        openNoteLink(app, 'Notes/foo.md', ev)
        expect(prevented.value).toBe(false)
        expect(calls.length).toBe(0)
    })

    it('ignores other non-actionable buttons (e.g. 3, 4)', () => {
        const { app, calls } = makeApp()
        openNoteLink(app, 'Notes/foo.md', makeEvent(3).ev)
        openNoteLink(app, 'Notes/foo.md', makeEvent(4).ev)
        expect(calls.length).toBe(0)
    })
})
