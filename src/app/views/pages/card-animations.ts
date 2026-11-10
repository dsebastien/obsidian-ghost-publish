/** Safety net (ms) for when `transitionend` never fires. Keep above the CSS collapse duration. */
const REMOVAL_FALLBACK_MS = 250

/**
 * Hide a card at once, collapse its slot, then remove it from the DOM.
 *
 * Called synchronously from the click handler, before any write: the card
 * must react on the same frame as the click (optimistic UI).
 *   1. Lock the current height inline so the collapse has a definite start.
 *   2. Force a reflow, then add `.gp-card-removing` in the same frame: the
 *      card stops taking clicks and fades immediately while its slot collapses.
 *
 * Once the transition ends the element is removed and `onRemoved` runs.
 */
export function animateCardRemoval(card: HTMLElement, onRemoved?: () => void): void {
    if (card.hasClass('gp-card-removing')) return
    // Reading offsetHeight forces the one reflow the transition needs.
    card.style.maxHeight = `${card.offsetHeight}px`
    void card.offsetHeight
    card.addClass('gp-card-removing')

    let done = false
    const finalize = (): void => {
        if (done) return
        done = true
        card.remove()
        onRemoved?.()
    }
    card.addEventListener('transitionend', (ev) => {
        if (ev.target === card && ev.propertyName === 'max-height') finalize()
    })
    window.setTimeout(finalize, REMOVAL_FALLBACK_MS)
}
