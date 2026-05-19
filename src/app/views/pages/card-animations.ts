/**
 * Fade a card out, then collapse its slot, then remove it from the DOM.
 *
 * The animation runs in two passes:
 *   1. Lock the current height inline so the upcoming transition has a
 *      definite starting value.
 *   2. On the next animation frame, add `.gp-card-removing` which fades
 *      opacity to 0, collapses max-height / margin / padding / border.
 *
 * Once the transition ends the element is removed from the DOM and the
 * `onRemoved` callback runs (where the caller updates summary counts etc.).
 */
export function animateCardRemoval(card: HTMLElement, onRemoved: () => void): void {
    const computed = window.getComputedStyle(card)
    const startHeight = computed.height
    card.style.maxHeight = startHeight
    // Force a reflow so the upcoming transition has a definite start point.
    void card.offsetHeight
    window.requestAnimationFrame(() => {
        card.addClass('gp-card-removing')
    })

    const finalize = (): void => {
        card.removeEventListener('transitionend', finalize)
        card.remove()
        onRemoved()
    }
    card.addEventListener('transitionend', finalize, { once: true })
    // Defensive fallback: if `transitionend` doesn't fire (reduced-motion,
    // browser quirk, very fast unmount), still remove the card after a
    // safety timeout.
    window.setTimeout(() => {
        if (card.isConnected) {
            finalize()
        }
    }, 400)
}
