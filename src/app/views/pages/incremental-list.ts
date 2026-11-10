/** Cards rendered per batch. Keeps the DOM small so layout stays cheap. */
export const CARD_BATCH_SIZE = 40

/**
 * Render `items` into `list` in batches: the first batch at once, the next
 * one each time a sentinel at the end of the list scrolls into view.
 *
 * Reason: a wide triage range can match thousands of notes. Rendering them
 * all makes the first paint slow and every later layout (card removal,
 * scroll) expensive, because the browser lays out the full list.
 */
export function renderIncrementally<T>(
    list: HTMLElement,
    items: readonly T[],
    renderItem: (item: T) => void,
    batchSize: number = CARD_BATCH_SIZE
): void {
    let next = 0
    const renderBatch = (): void => {
        const end = Math.min(next + batchSize, items.length)
        for (; next < end; next++) renderItem(items[next]!)
    }
    renderBatch()
    if (next >= items.length) return

    const sentinel = list.createDiv({ cls: 'gp-list-sentinel' })
    const observer = new IntersectionObserver(
        (entries) => {
            if (!sentinel.isConnected) {
                observer.disconnect()
                return
            }
            if (!entries.some((e) => e.isIntersecting)) return
            renderBatch()
            // Keep the sentinel last so the next batch triggers on scroll.
            list.appendChild(sentinel)
            if (next >= items.length) {
                observer.disconnect()
                sentinel.remove()
            }
        },
        { rootMargin: '600px 0px' }
    )
    observer.observe(sentinel)
}
