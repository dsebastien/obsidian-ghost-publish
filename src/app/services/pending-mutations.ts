/**
 * Tracks notes whose frontmatter is being rewritten by an optimistic panel
 * action (triage decision, remove-from-queue).
 *
 * The panel removes the card the moment the user clicks, before the write
 * lands. Until the metadataCache reflects the write, any re-render (refresh,
 * range change, search, tab switch) would still see the old frontmatter and
 * bring the card back. Lists filter out paths held here to prevent that.
 *
 * An entry is dropped only once the metadataCache shows the new state
 * (`isApplied` returns true). A 'changed' event alone is not enough: while
 * Obsidian indexes the vault, the cache can lag far behind the write and
 * fire events that still carry the old frontmatter.
 *
 * Lifecycle of an entry:
 *   begin(path, isApplied) → card hidden, write in flight
 *   settle(path)           → write resolved; dropped now if the cache already
 *                            shows it, else on the first 'changed' event that
 *                            does (leak guard: PENDING_LEAK_TIMEOUT_MS)
 *   cancel(path)           → write failed; dropped at once so the card returns
 */
export const PENDING_LEAK_TIMEOUT_MS = 10 * 60 * 1000

interface PendingEntry {
    /** Receives the entry's current path (entries follow renames). */
    isApplied: (path: string) => boolean
    timer: number | null
}

export interface TimerApi {
    setTimeout: (fn: () => void, ms: number) => number
    clearTimeout: (id: number) => void
}

const defaultTimers: TimerApi = {
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id)
}

export class PendingMutations {
    private readonly entries = new Map<string, PendingEntry>()

    constructor(
        private readonly timers: TimerApi = defaultTimers,
        private readonly leakTimeoutMs: number = PENDING_LEAK_TIMEOUT_MS
    ) {}

    has(path: string): boolean {
        return this.entries.has(path)
    }

    begin(path: string, isApplied: (path: string) => boolean): void {
        this.clear(path)
        this.entries.set(path, { isApplied, timer: null })
    }

    settle(path: string): void {
        const entry = this.entries.get(path)
        if (!entry) return
        if (entry.isApplied(path)) {
            this.clear(path)
            return
        }
        entry.timer = this.timers.setTimeout(() => {
            // Look the entry up by identity: it may have been renamed since.
            for (const [key, value] of this.entries) {
                if (value === entry) this.clear(key)
            }
        }, this.leakTimeoutMs)
    }

    cancel(path: string): void {
        this.clear(path)
    }

    /** Call from metadataCache 'changed'. Drops the entry once the cache shows the write. */
    onMetadataChanged(path: string): void {
        if (this.entries.get(path)?.isApplied(path)) this.clear(path)
    }

    /** Call from vault 'rename' so an in-flight entry follows the file. */
    onRenamed(oldPath: string, newPath: string): void {
        const entry = this.entries.get(oldPath)
        if (!entry) return
        this.entries.delete(oldPath)
        this.entries.set(newPath, entry)
    }

    dispose(): void {
        for (const path of [...this.entries.keys()]) this.clear(path)
    }

    private clear(path: string): void {
        const entry = this.entries.get(path)
        if (!entry) return
        if (entry.timer !== null) this.timers.clearTimeout(entry.timer)
        this.entries.delete(path)
    }
}
