import { describe, expect, it } from 'bun:test'
import { triageRangeToSince } from './candidate-discovery'

describe('triageRangeToSince', () => {
    const fixed = new Date('2026-05-19T15:30:00Z')

    it('today rounds to start-of-day', () => {
        const since = triageRangeToSince('today', fixed)
        const d = new Date(since)
        expect(d.getHours()).toBe(0)
        expect(d.getMinutes()).toBe(0)
        expect(d.getDate()).toBe(fixed.getDate())
    })

    it('week rounds to Monday 00:00', () => {
        const since = triageRangeToSince('week', fixed)
        const d = new Date(since)
        expect(d.getDay()).toBe(1)
        expect(d.getHours()).toBe(0)
    })

    it('last14 is 14 days back at midnight', () => {
        const since = triageRangeToSince('last14', fixed)
        const expected = new Date(fixed)
        expected.setDate(expected.getDate() - 14)
        expected.setHours(0, 0, 0, 0)
        expect(since).toBe(expected.getTime())
    })

    it('month rounds to first of month', () => {
        const since = triageRangeToSince('month', fixed)
        expect(new Date(since).getDate()).toBe(1)
    })

    it('year rounds to Jan 1', () => {
        const since = triageRangeToSince('year', fixed)
        const d = new Date(since)
        expect(d.getMonth()).toBe(0)
        expect(d.getDate()).toBe(1)
    })

    it('all returns 0', () => {
        expect(triageRangeToSince('all', fixed)).toBe(0)
    })
})
