import { describe, expect, it } from 'bun:test'
import type { SyncResult } from '../types/sync-result.intf'
import { summarizeFailureReasons } from './failure-reasons.fn'

const failed = (path: string, reason?: string): SyncResult => ({ path, status: 'failed', reason })

describe('summarizeFailureReasons', () => {
    it('returns nothing when no note failed', () => {
        expect(summarizeFailureReasons([{ path: 'a.md', status: 'unchanged' }])).toEqual([])
    })

    it('groups identical reasons and counts the notes', () => {
        const results = [
            failed('a.md', 'Host limit'),
            failed('b.md', 'Host limit'),
            failed('c.md', 'Bad title')
        ]
        expect(summarizeFailureReasons(results)).toEqual([
            'Host limit (2 notes)',
            'Bad title (1 note)'
        ])
    })

    it('falls back to a generic reason when none was captured', () => {
        expect(summarizeFailureReasons([failed('a.md'), failed('b.md', '  ')])).toEqual([
            'Unknown error (2 notes)'
        ])
    })

    it('caps the list and mentions the remainder', () => {
        const results = ['e1', 'e2', 'e3', 'e4', 'e5'].map((r) => failed(`${r}.md`, r))
        expect(summarizeFailureReasons(results, 2)).toEqual([
            'e1 (1 note)',
            'e2 (1 note)',
            '…and 3 other errors'
        ])
    })
})
