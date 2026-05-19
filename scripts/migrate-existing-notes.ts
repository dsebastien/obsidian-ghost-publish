/**
 * One-shot, additive migration for vaults whose notes already have the
 * plugin's "flag" frontmatter property set but no preset id yet (e.g.
 * vaults that previously used a Templater workflow with the same flag).
 *
 * For each markdown file whose frontmatter contains `<flag>: true` but no
 * `<preset-property>` key, insert ONE new line `<preset-property>: <preset-id>`
 * right after the flag line. Nothing else is touched: no key reordering,
 * no quoting changes, no body edits.
 *
 * Defaults to **dry-run**. Pass `--apply` to actually write.
 *
 * Usage:
 *   bun scripts/migrate-existing-notes.ts \
 *     --vault /path/to/vault \
 *     --preset-id <uuid> \
 *     [--flag-property ghost_publish] \
 *     [--preset-property ghost_publish_preset] \
 *     [--apply]
 *
 * The defaults match the plugin's own defaults. Override them to match
 * whatever you configured in the plugin's settings.
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { parseArgs } from 'node:util'

interface Args {
    vault: string
    presetId: string
    flagProperty: string
    presetProperty: string
    apply: boolean
}

const EXCLUDED_PATH_FRAGMENTS = [
    '/.obsidian/',
    '/.smart-env/',
    '/.trash/',
    '/.git/',
    '/node_modules/',
    '/60 Archives/'
]

function parseCliArgs(): Args {
    const { values } = parseArgs({
        args: Bun.argv.slice(2),
        options: {
            'vault': { type: 'string' },
            'preset-id': { type: 'string' },
            'flag-property': { type: 'string', default: 'ghost_publish' },
            'preset-property': {
                type: 'string',
                default: 'ghost_publish_preset'
            },
            'apply': { type: 'boolean', default: false }
        },
        strict: true,
        allowPositionals: false
    })

    const vault = values.vault
    const presetId = values['preset-id']
    if (!vault || !presetId) {
        console.error(
            'Usage: bun scripts/migrate-existing-notes.ts --vault <path> --preset-id <uuid> [--apply]'
        )
        process.exit(1)
    }

    return {
        vault,
        presetId,
        flagProperty: values['flag-property'] ?? 'ghost_publish',
        presetProperty: values['preset-property'] ?? 'ghost_publish_preset',
        apply: values.apply ?? false
    }
}

async function walkMarkdownFiles(root: string): Promise<string[]> {
    const out: string[] = []
    async function walk(dir: string): Promise<void> {
        let entries: import('node:fs').Dirent[]
        try {
            entries = await readdir(dir, { withFileTypes: true })
        } catch {
            return
        }
        for (const entry of entries) {
            const abs = join(dir, entry.name)
            if (EXCLUDED_PATH_FRAGMENTS.some((frag) => abs.includes(frag))) continue
            if (entry.isDirectory()) {
                await walk(abs)
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                out.push(abs)
            }
        }
    }
    await walk(root)
    return out
}

interface FrontmatterSlice {
    /** Index in the file where the opening `---` line begins. */
    start: number
    /** Index where the closing `---` line begins. */
    end: number
    /** Frontmatter text between the two delimiters (no delimiters themselves). */
    body: string
}

/**
 * Locate the leading frontmatter block. Returns null when the file does not
 * start with `---` on its own line, or when the closing delimiter is missing.
 */
function locateFrontmatter(text: string): FrontmatterSlice | null {
    const opener = text.match(/^---[ \t]*\r?\n/)
    if (!opener) return null
    const start = opener.index ?? 0
    const afterOpener = start + opener[0].length
    const rest = text.slice(afterOpener)
    const closerMatch = rest.match(/^---[ \t]*\r?\n/m)
    if (!closerMatch || closerMatch.index === undefined) return null
    const bodyEnd = afterOpener + closerMatch.index
    return {
        start,
        end: bodyEnd,
        body: text.slice(afterOpener, bodyEnd)
    }
}

interface PlannedEdit {
    file: string
    /** Line index (0-based) inside the frontmatter where the flag was found. */
    flagLineIndex: number
    /** Snippet of context to display in dry-run output. */
    contextLines: string[]
    /** Full updated file content if applied. */
    updated: string
}

/**
 * Returns a PlannedEdit when the file has the flag set to true and no preset
 * property yet. Returns null when the file should be skipped.
 */
function planEdit(file: string, raw: string, args: Args): PlannedEdit | null {
    const fm = locateFrontmatter(raw)
    if (!fm) return null

    const lines = fm.body.split('\n')

    // Find the flag line: `<flagProperty>: true`. Match leading whitespace
    // (frontmatter is always top-level, no nested keys, but be forgiving) and
    // tolerate trailing whitespace.
    const flagLineRe = new RegExp(
        '^[ \\t]*' +
            args.flagProperty.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') +
            ':[ \\t]+true[ \\t]*$'
    )
    const presetLineRe = new RegExp(
        '^[ \\t]*' + args.presetProperty.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + ':'
    )

    let flagLineIndex = -1
    for (let i = 0; i < lines.length; i++) {
        if (flagLineRe.test(lines[i]!)) {
            flagLineIndex = i
            break
        }
    }
    if (flagLineIndex === -1) return null

    // Already migrated?
    if (lines.some((line) => presetLineRe.test(line))) return null

    const newLine = `${args.presetProperty}: ${args.presetId}`
    const newLines = [
        ...lines.slice(0, flagLineIndex + 1),
        newLine,
        ...lines.slice(flagLineIndex + 1)
    ]
    const newBody = newLines.join('\n')
    const updated = raw.slice(0, fm.start) + '---\n' + newBody + raw.slice(fm.end)

    // Defensive check: nothing else should have changed.
    const before = raw.slice(fm.end)
    const after = updated.slice(updated.length - before.length)
    if (before !== after) {
        throw new Error(`Edit altered content beyond the frontmatter for ${file}`)
    }

    const start = Math.max(0, flagLineIndex - 2)
    const end = Math.min(newLines.length, flagLineIndex + 4)
    const contextLines = newLines.slice(start, end).map((line, idx) => {
        const realIdx = start + idx
        const marker = realIdx === flagLineIndex + 1 ? '+' : ' '
        return `${marker} ${line}`
    })

    return { file, flagLineIndex, contextLines, updated }
}

async function main(): Promise<void> {
    const args = parseCliArgs()

    const root = args.vault.replace(/\/+$/, '')
    const rootStat = await stat(root).catch(() => null)
    if (!rootStat || !rootStat.isDirectory()) {
        console.error(`Vault path is not a directory: ${root}`)
        process.exit(1)
    }

    console.log('--- Ghost Publish migration ---')
    console.log(`Vault            : ${root}`)
    console.log(`Flag property    : ${args.flagProperty}`)
    console.log(`Preset property  : ${args.presetProperty}`)
    console.log(`Preset id        : ${args.presetId}`)
    console.log(`Mode             : ${args.apply ? 'APPLY (will write)' : 'dry-run (no writes)'}`)
    console.log('')

    const files = await walkMarkdownFiles(root)
    console.log(`Scanning ${files.length} markdown files...`)

    const planned: PlannedEdit[] = []
    let alreadyMigrated = 0
    let notFlagged = 0

    for (const file of files) {
        let raw: string
        try {
            raw = await readFile(file, 'utf8')
        } catch {
            continue
        }
        const fm = locateFrontmatter(raw)
        if (!fm) {
            notFlagged++
            continue
        }
        const lines = fm.body.split('\n')
        const flagRe = new RegExp(
            '^[ \\t]*' +
                args.flagProperty.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') +
                ':[ \\t]+true[ \\t]*$'
        )
        const presetRe = new RegExp(
            '^[ \\t]*' + args.presetProperty.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + ':'
        )
        if (!lines.some((l) => flagRe.test(l))) {
            notFlagged++
            continue
        }
        if (lines.some((l) => presetRe.test(l))) {
            alreadyMigrated++
            continue
        }

        const plan = planEdit(file, raw, args)
        if (plan) planned.push(plan)
    }

    console.log('')
    console.log(`Already migrated   : ${alreadyMigrated}`)
    console.log(`Not flagged        : ${notFlagged}`)
    console.log(`Would modify       : ${planned.length}`)
    console.log('')

    const previewLimit = Math.min(planned.length, 5)
    for (let i = 0; i < previewLimit; i++) {
        const p = planned[i]!
        console.log(`# ${relative(root, p.file)}`)
        for (const line of p.contextLines) {
            console.log(`    ${line}`)
        }
        console.log('')
    }
    if (planned.length > previewLimit) {
        console.log(`... and ${planned.length - previewLimit} more file(s) not shown.`)
        console.log('')
    }

    if (!args.apply) {
        console.log('Dry-run only. Re-run with --apply to write changes.')
        return
    }

    console.log('Applying changes...')
    let written = 0
    let failed = 0
    for (const p of planned) {
        try {
            await writeFile(p.file, p.updated, 'utf8')
            written++
        } catch (e) {
            failed++
            console.error(
                `  ✗ ${relative(root, p.file)}: ${e instanceof Error ? e.message : String(e)}`
            )
        }
    }
    console.log(`Written: ${written}`)
    if (failed > 0) console.log(`Failed:  ${failed}`)
}

if (import.meta.main) {
    await main()
}
