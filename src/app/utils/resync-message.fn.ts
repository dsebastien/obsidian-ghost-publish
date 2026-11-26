/**
 * Confirmation text of the "Sync again every note of a preset" command. It
 * names the number of notes and says that live posts change, because the
 * command pushes notes whose content did not change.
 */
export function resyncConfirmMessage(presetName: string, count: number): string {
    const notes = count === 1 ? '1 note' : `${count} notes`
    const posts = count === 1 ? 'live post' : 'live posts'
    return (
        `This sends ${notes} of the preset "${presetName}" to Ghost again, also the notes ` +
        `that did not change, and updates their ${posts} with the current settings. ` +
        'No newsletter email is sent. Notes that are not on Ghost yet are left to the normal sync.'
    )
}
