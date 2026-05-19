import { describe, expect, it } from 'bun:test'
import { stripDataviewQueries, stripLeadingH1, stripVaultOnlySections } from './strip-sections.fn'

describe('stripVaultOnlySections', () => {
    it('removes an H2 section matching the strip list, leaving following H1/H2 intact', () => {
        const input = [
            '# Title',
            '',
            'Intro paragraph.',
            '',
            '## Promotion Tweet',
            'Some tweet draft.',
            '',
            'More draft.',
            '',
            '## Keep me',
            'Body of keep-me section.'
        ].join('\n')

        const out = stripVaultOnlySections(input, ['Promotion Tweet'])
        expect(out).toContain('Intro paragraph.')
        expect(out).toContain('## Keep me')
        expect(out).toContain('Body of keep-me section.')
        expect(out).not.toContain('Promotion Tweet')
        expect(out).not.toContain('Some tweet draft.')
    })

    it('ignores case and punctuation in the title match', () => {
        const input = '## REFERENCES ✨\nfoo'
        expect(stripVaultOnlySections(input, ['references'])).toBe('')
    })

    it('passes through unchanged when no sections to strip', () => {
        const input = '## Heading\nbody'
        expect(stripVaultOnlySections(input, [])).toBe(input)
    })
})

describe('stripDataviewQueries', () => {
    it('removes ```dataview blocks', () => {
        const input = ['intro', '```dataview', 'TABLE foo', '```', 'outro'].join('\n')
        const out = stripDataviewQueries(input)
        expect(out).toContain('intro')
        expect(out).toContain('outro')
        expect(out).not.toContain('TABLE foo')
    })

    it('removes %% dataview-serializer %% blocks', () => {
        const input = 'intro\n%% dataview-serializer foo %%\noutro'
        expect(stripDataviewQueries(input)).toBe('intro\n\noutro')
    })
})

describe('stripLeadingH1', () => {
    it('removes only the very first H1', () => {
        expect(stripLeadingH1('# Hello\nWorld')).toBe('World')
    })

    it('leaves the body untouched when there is no leading H1', () => {
        expect(stripLeadingH1('Body without heading')).toBe('Body without heading')
    })

    it('does not remove an H1 below the first line', () => {
        const input = 'Intro\n\n# H1 inside body'
        expect(stripLeadingH1(input)).toBe(input)
    })
})
