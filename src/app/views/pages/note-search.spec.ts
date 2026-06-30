import { test, expect, describe } from 'bun:test'
import { filterNotesBySearch } from './note-search'

interface Item {
    name: string
    path: string
}

const ITEMS: Item[] = [
    { name: 'Alpha', path: 'a/alpha.md' },
    { name: 'Beta', path: 'b/beta.md' },
    { name: 'Gamma', path: 'g/gamma.md' }
]

const getName = (i: Item): string => i.name
const getPath = (i: Item): string => i.path

describe('filterNotesBySearch', () => {
    test('returns the original list unchanged for an empty query', () => {
        const result = filterNotesBySearch(ITEMS, '', getName, getPath)
        expect(result).toBe(ITEMS)
    })

    test('returns the original list unchanged for a whitespace-only query', () => {
        const result = filterNotesBySearch(ITEMS, '   ', getName, getPath)
        expect(result).toBe(ITEMS)
    })

    test('filters by title', () => {
        const result = filterNotesBySearch(ITEMS, 'beta', getName, getPath)
        expect(result.map((i) => i.name)).toEqual(['Beta'])
    })

    test('filters by path', () => {
        const result = filterNotesBySearch(ITEMS, 'g/gamma', getName, getPath)
        expect(result.map((i) => i.name)).toEqual(['Gamma'])
    })

    test('returns an empty list when nothing matches', () => {
        const result = filterNotesBySearch(ITEMS, 'zzqxw', getName, getPath)
        expect(result).toEqual([])
    })
})
