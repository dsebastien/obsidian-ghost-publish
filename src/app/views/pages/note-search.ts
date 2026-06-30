import { fuzzySearch, type FuzzySearchConfig } from '../../utils/fuzzy-search.fn'

type NoteSearchField = 'title' | 'path'

/**
 * Field weights for note search: a card's title (basename / Ghost title) is
 * the primary signal; its vault path is a secondary one so folder names are
 * searchable too.
 */
const NOTE_SEARCH_CONFIG: FuzzySearchConfig<NoteSearchField> = {
    fields: {
        title: { weight: 5 },
        path: { weight: 2 }
    }
}

/**
 * Filter a list of note-bearing items by the panel search query, ranking the
 * matches best-first. An empty/whitespace query is a no-op: the original list
 * is returned unchanged (and in its original order).
 */
export function filterNotesBySearch<T>(
    items: T[],
    query: string,
    getTitle: (item: T) => string,
    getPath: (item: T) => string
): T[] {
    if (!query.trim()) return items
    return fuzzySearch(items, query, NOTE_SEARCH_CONFIG, (item, field) =>
        field === 'title' ? getTitle(item) : getPath(item)
    )
}
