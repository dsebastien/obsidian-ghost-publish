import { describe, expect, test } from 'bun:test'
import { isRemovedFromQueue, isTriageActionApplied } from './triage-actions'
import { DEFAULT_FRONTMATTER } from '../types/plugin-settings.intf'

const fm = DEFAULT_FRONTMATTER

describe('isTriageActionApplied', () => {
    test('ignore needs the ignore flag and no publish flag', () => {
        expect(isTriageActionApplied({}, fm, 'p1', 'ignore')).toBe(false)
        expect(isTriageActionApplied({ [fm.ignoreFlag]: true }, fm, 'p1', 'ignore')).toBe(true)
        expect(
            isTriageActionApplied({ [fm.ignoreFlag]: true, [fm.flag]: true }, fm, 'p1', 'ignore')
        ).toBe(false)
    })

    test('publish needs the flag and the same preset', () => {
        expect(isTriageActionApplied({ [fm.flag]: true }, fm, 'p1', 'publish')).toBe(false)
        expect(
            isTriageActionApplied({ [fm.flag]: true, [fm.preset]: 'p2' }, fm, 'p1', 'publish')
        ).toBe(false)
        expect(
            isTriageActionApplied({ [fm.flag]: true, [fm.preset]: 'p1' }, fm, 'p1', 'publish')
        ).toBe(true)
    })

    test('publish_email also needs the email flag', () => {
        const queued = { [fm.flag]: true, [fm.preset]: 'p1' }
        expect(isTriageActionApplied(queued, fm, 'p1', 'publish_email')).toBe(false)
        expect(
            isTriageActionApplied({ ...queued, [fm.emailFlag]: true }, fm, 'p1', 'publish_email')
        ).toBe(true)
    })
})

describe('isRemovedFromQueue', () => {
    test('true once the publish flag is gone', () => {
        expect(isRemovedFromQueue({ [fm.flag]: true }, fm)).toBe(false)
        expect(isRemovedFromQueue({}, fm)).toBe(true)
    })
})
