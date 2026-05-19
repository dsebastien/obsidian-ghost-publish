/**
 * Convert a vault-relative markdown path to a canonical public URL.
 *
 *   "30 Areas/Some Note.md"  →  "<base>/30+Areas/Some+Note"
 *
 * Spaces become `+`, `#` is percent-encoded, the `.md` extension is dropped.
 */
export function vaultPathToUrl(notesBaseUrl: string, relativePath: string): string {
    const withoutExt = relativePath.replace(/\.md$/, '')
    const encoded = withoutExt
        .split('/')
        .map((seg) => seg.replace(/ /g, '+').replace(/#/g, '%23'))
        .join('/')
    return `${notesBaseUrl.replace(/\/+$/, '')}/${encoded}`
}
