/**
 * Typo-tolerant, weighted multi-field fuzzy search.
 *
 * Ported from the tools-website search (https://github.com/dsebastien) so the
 * panel's search box behaves the same way: subsequence ("obsk" → "obsidian
 * starter kit") and typo tolerance, with per-field weighting and start-of-
 * field / substring / exact-match bonuses for ranking.
 *
 * Pure module — no Obsidian or DOM dependency — so it is unit-testable.
 */

import uFuzzy from '@leeoniya/ufuzzy'

/** Configuration for a single searchable field. */
export interface SearchFieldConfig {
    /** Relative importance of this field in the final ranking. */
    weight: number
}

/** Field-weight configuration keyed by the searchable field names. */
export interface FuzzySearchConfig<TFields extends string> {
    fields: Record<TFields, SearchFieldConfig>
}

interface FuzzySearchResult<T> {
    item: T
    score: number
}

/** Optional search behaviour. */
export interface FuzzySearchOptions {
    /** Cap on the number of returned items (default: unlimited). */
    limit?: number
}

// One lenient matcher instance, reused across calls.
const fuzzyMatcher = new uFuzzy({
    // Allow characters between query letters (for "obsk" -> "obsidian starter kit").
    interIns: 50,
    // Allow some character mismatches for typo tolerance.
    intraMode: 1,
    // Maximum allowed extra chars between terms.
    intraIns: 1,
    interSplit: '[^a-zA-Z0-9]+',
    intraSplit: '[a-zA-Z][0-9]|[0-9][a-zA-Z]|[a-z][A-Z]'
})

/** Whether the query chars appear in order within the text (subsequence match). */
function isSubsequence(text: string, query: string): boolean {
    let queryIndex = 0
    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
        if (text[i] === query[queryIndex]) {
            queryIndex++
        }
    }
    return queryIndex === query.length
}

/** Score a subsequence match — fallback for when uFuzzy returns nothing. */
function subsequenceScore(text: string, query: string): number {
    if (!isSubsequence(text, query)) return 0

    let score = 10 // Base score for any match.
    let queryIndex = 0
    let lastMatchIndex = -1
    let consecutiveBonus = 0

    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
        if (text[i] === query[queryIndex]) {
            // Bonus for consecutive matches.
            if (lastMatchIndex === i - 1) {
                consecutiveBonus += 5
            }
            // Bonus for match at start.
            if (i === 0 && queryIndex === 0) {
                score += 20
            }
            lastMatchIndex = i
            queryIndex++
        }
    }

    score += consecutiveBonus
    // Prefer shorter texts (closer length ratio).
    score += (query.length / text.length) * 20

    return score
}

/**
 * Fuzzy-search a collection across multiple weighted fields. Returns the
 * matching items sorted best-first; an empty/whitespace query returns `[]`.
 */
export function fuzzySearch<T, TFields extends string>(
    items: T[],
    query: string,
    config: FuzzySearchConfig<TFields>,
    getFieldValue: (item: T, field: TFields) => string | string[] | null | undefined,
    options?: FuzzySearchOptions
): T[] {
    const trimmedQuery = query.trim().toLowerCase()
    if (!trimmedQuery) return []

    const fields = Object.keys(config.fields) as TFields[]
    const scoredResults: FuzzySearchResult<T>[] = []

    for (const item of items) {
        let bestScore = 0

        for (const field of fields) {
            const rawValue = getFieldValue(item, field)
            const fieldWeight = config.fields[field].weight

            // Normalise to an array so a string and a string[] field behave alike.
            const values: string[] = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : []

            for (const value of values) {
                if (!value) continue

                const normalizedValue = value.toLowerCase()
                const haystack = [normalizedValue]
                const idxs = fuzzyMatcher.filter(haystack, trimmedQuery)

                let score = 0

                if (idxs && idxs.length > 0) {
                    const info = fuzzyMatcher.info(idxs, haystack, trimmedQuery)
                    if (info) {
                        const matchStart = info.start[0] ?? 0
                        const lengthRatio = trimmedQuery.length / normalizedValue.length

                        score = fieldWeight * 100

                        if (matchStart === 0) {
                            score += 50
                        } else {
                            score -= matchStart * 2
                        }

                        score += lengthRatio * 30

                        if (normalizedValue === trimmedQuery) {
                            score += 200
                        } else if (normalizedValue.includes(trimmedQuery)) {
                            score += 100
                        }
                    }
                } else {
                    const subScore = subsequenceScore(normalizedValue, trimmedQuery)
                    if (subScore > 0) {
                        // Lower priority than direct uFuzzy matches.
                        score = fieldWeight * 50 + subScore
                    }
                }

                bestScore = Math.max(bestScore, score)
            }
        }

        if (bestScore > 0) {
            scoredResults.push({ item, score: bestScore })
        }
    }

    scoredResults.sort((a, b) => b.score - a.score)
    const sortedItems = scoredResults.map((r) => r.item)

    if (options?.limit !== undefined && options.limit > 0) {
        return sortedItems.slice(0, options.limit)
    }
    return sortedItems
}
