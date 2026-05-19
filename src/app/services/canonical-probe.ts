import { requestUrl } from 'obsidian'
import { CANONICAL_PROBE_DELAYS_MS } from '../constants'
import { log } from '../../utils/log'

/**
 * HEAD-probe the canonical URL with exponential backoff. We only push to
 * Ghost once the canonical version is live — otherwise the `canonical_url`
 * on the Ghost post would resolve to a 404 for readers and search engines.
 */
export async function canonicalProbe(url: string): Promise<boolean> {
    for (let attempt = 0; attempt < CANONICAL_PROBE_DELAYS_MS.length; attempt++) {
        const delay = CANONICAL_PROBE_DELAYS_MS[attempt]!
        if (delay > 0) {
            await new Promise<void>((resolve) => window.setTimeout(resolve, delay))
        }
        try {
            const res = await requestUrl({ url, method: 'GET', throw: false })
            if (res.status >= 200 && res.status < 400) {
                return true
            }
            log(`Canonical probe ${attempt + 1}: HTTP ${res.status}`, 'debug')
        } catch (e) {
            log(`Canonical probe ${attempt + 1} threw`, 'debug', e)
        }
    }
    return false
}
