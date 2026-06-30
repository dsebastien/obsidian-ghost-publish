import { test, expect, describe } from 'bun:test'
import { fuzzySearch, type FuzzySearchConfig } from './fuzzy-search.fn'

interface Note {
    title: string
    path: string
}

const NOTES: Note[] = [
    { title: 'Obsidian Starter Kit', path: 'kits/obsidian-starter-kit.md' },
    { title: 'Ghost Publishing Guide', path: 'guides/ghost-publishing-guide.md' },
    { title: 'Weekly Newsletter', path: 'newsletters/weekly.md' },
    { title: 'Templating Basics', path: 'notes/templating-basics.md' }
]

const CONFIG: FuzzySearchConfig<'title' | 'path'> = {
    fields: { title: { weight: 5 }, path: { weight: 2 } }
}

const getField = (note: Note, field: 'title' | 'path'): string =>
    field === 'title' ? note.title : note.path

describe('fuzzySearch', () => {
    test('returns empty array for an empty / whitespace query', () => {
        expect(fuzzySearch(NOTES, '', CONFIG, getField)).toEqual([])
        expect(fuzzySearch(NOTES, '   ', CONFIG, getField)).toEqual([])
    })

    test('finds an exact substring match', () => {
        const results = fuzzySearch(NOTES, 'newsletter', CONFIG, getField)
        expect(results[0]?.title).toBe('Weekly Newsletter')
    })

    test('is case-insensitive', () => {
        const results = fuzzySearch(NOTES, 'GHOST', CONFIG, getField)
        expect(results[0]?.title).toBe('Ghost Publishing Guide')
    })

    test('matches an acronym-style subsequence ("obsk" -> Obsidian Starter Kit)', () => {
        const results = fuzzySearch(NOTES, 'obsk', CONFIG, getField)
        expect(results[0]?.title).toBe('Obsidian Starter Kit')
    })

    test('tolerates a typo', () => {
        const results = fuzzySearch(NOTES, 'templ', CONFIG, getField)
        expect(results[0]?.title).toBe('Templating Basics')
    })

    test('matches against the path field too', () => {
        const results = fuzzySearch(NOTES, 'guides', CONFIG, getField)
        expect(results.map((n) => n.title)).toContain('Ghost Publishing Guide')
    })

    test('ranks a title match above a path-only match', () => {
        const items: Note[] = [
            { title: 'Unrelated', path: 'ghost/something.md' },
            { title: 'Ghost Notes', path: 'misc/x.md' }
        ]
        const results = fuzzySearch(items, 'ghost', CONFIG, getField)
        expect(results[0]?.title).toBe('Ghost Notes')
    })

    test('returns nothing for a non-matching query', () => {
        expect(fuzzySearch(NOTES, 'zzzzxyq', CONFIG, getField)).toEqual([])
    })

    test('honours the result limit', () => {
        const results = fuzzySearch(NOTES, 'e', CONFIG, getField, { limit: 1 })
        expect(results.length).toBe(1)
    })
})
