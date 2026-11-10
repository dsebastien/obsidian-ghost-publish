import { describe, expect, test } from 'bun:test'
import { PendingMutations } from './pending-mutations'
import type { TimerApi } from './pending-mutations'

function fakeTimers(): TimerApi & { fire: () => void; count: () => number } {
    let next = 1
    const pending = new Map<number, () => void>()
    return {
        setTimeout: (fn) => {
            const id = next++
            pending.set(id, fn)
            return id
        },
        clearTimeout: (id) => {
            pending.delete(id)
        },
        fire: () => {
            const fns = [...pending.values()]
            pending.clear()
            for (const fn of fns) fn()
        },
        count: () => pending.size
    }
}

/** Simulated metadataCache: the paths whose cached frontmatter shows the write. */
function fakeCache(): { applied: Set<string>; check: (path: string) => boolean } {
    const applied = new Set<string>()
    return { applied, check: (path) => applied.has(path) }
}

describe('PendingMutations', () => {
    test('begin marks a path as pending', () => {
        const c = fakeCache()
        const p = new PendingMutations(fakeTimers())
        p.begin('a.md', c.check)
        expect(p.has('a.md')).toBe(true)
        expect(p.has('b.md')).toBe(false)
    })

    test('stale change events keep the entry, even after settle (indexing lag)', () => {
        const c = fakeCache()
        const p = new PendingMutations(fakeTimers())
        p.begin('a.md', c.check)
        p.onMetadataChanged('a.md')
        p.settle('a.md')
        p.onMetadataChanged('a.md')
        p.onMetadataChanged('a.md')
        expect(p.has('a.md')).toBe(true)
    })

    test('the first change event that shows the write drops the entry and its timer', () => {
        const c = fakeCache()
        const t = fakeTimers()
        const p = new PendingMutations(t)
        p.begin('a.md', c.check)
        p.settle('a.md')
        expect(t.count()).toBe(1)
        c.applied.add('a.md')
        p.onMetadataChanged('a.md')
        expect(p.has('a.md')).toBe(false)
        expect(t.count()).toBe(0)
    })

    test('settle drops the entry at once when the cache already shows the write', () => {
        const c = fakeCache()
        const t = fakeTimers()
        const p = new PendingMutations(t)
        p.begin('a.md', c.check)
        c.applied.add('a.md')
        p.settle('a.md')
        expect(p.has('a.md')).toBe(false)
        expect(t.count()).toBe(0)
    })

    test('leak timeout drops an entry the cache never confirms', () => {
        const c = fakeCache()
        const t = fakeTimers()
        const p = new PendingMutations(t)
        p.begin('a.md', c.check)
        p.settle('a.md')
        t.fire()
        expect(p.has('a.md')).toBe(false)
    })

    test('cancel drops the entry at once', () => {
        const c = fakeCache()
        const p = new PendingMutations(fakeTimers())
        p.begin('a.md', c.check)
        p.cancel('a.md')
        expect(p.has('a.md')).toBe(false)
    })

    test('rename moves an entry and checks the cache under the new path', () => {
        const c = fakeCache()
        const p = new PendingMutations(fakeTimers())
        p.begin('a.md', c.check)
        p.settle('a.md')
        p.onRenamed('a.md', 'b.md')
        expect(p.has('a.md')).toBe(false)
        expect(p.has('b.md')).toBe(true)
        c.applied.add('b.md')
        p.onMetadataChanged('b.md')
        expect(p.has('b.md')).toBe(false)
    })

    test('leak timeout still fires for a renamed entry', () => {
        const c = fakeCache()
        const t = fakeTimers()
        const p = new PendingMutations(t)
        p.begin('a.md', c.check)
        p.settle('a.md')
        p.onRenamed('a.md', 'b.md')
        t.fire()
        expect(p.has('b.md')).toBe(false)
    })

    test('dispose clears everything', () => {
        const c = fakeCache()
        const t = fakeTimers()
        const p = new PendingMutations(t)
        p.begin('a.md', c.check)
        p.begin('b.md', c.check)
        p.settle('b.md')
        p.dispose()
        expect(p.has('a.md')).toBe(false)
        expect(p.has('b.md')).toBe(false)
        expect(t.count()).toBe(0)
    })
})
