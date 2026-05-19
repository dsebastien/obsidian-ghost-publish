/**
 * Ghost Admin API JWT signing using the browser-native Web Crypto API.
 *
 * The Admin key is `id:secret` where `secret` is hex-encoded. The JWT spec
 * for Ghost: HS256, kid = id, payload `{ iat, exp (iat+5min), aud: '/admin/' }`.
 */

function base64UrlEncode(input: ArrayBuffer | Uint8Array | string): string {
    let bytes: Uint8Array
    if (typeof input === 'string') {
        bytes = new TextEncoder().encode(input)
    } else if (input instanceof ArrayBuffer) {
        bytes = new Uint8Array(input)
    } else {
        bytes = input
    }
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!)
    }
    return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function hexToBuffer(hex: string): ArrayBuffer {
    if (hex.length % 2 !== 0) {
        throw new Error('Ghost admin secret must be hex (even length).')
    }
    const buf = new ArrayBuffer(hex.length / 2)
    const view = new Uint8Array(buf)
    for (let i = 0; i < view.length; i++) {
        const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
        if (Number.isNaN(byte)) {
            throw new Error('Ghost admin secret is not valid hex.')
        }
        view[i] = byte
    }
    return buf
}

export async function createGhostAdminToken(adminKey: string): Promise<string> {
    const split = adminKey.indexOf(':')
    if (split === -1) {
        throw new Error('Ghost admin key must be in the form "id:secret".')
    }
    const id = adminKey.slice(0, split)
    const secret = adminKey.slice(split + 1)
    if (!id || !secret) {
        throw new Error('Ghost admin key is missing an id or secret.')
    }

    const header = { alg: 'HS256', typ: 'JWT', kid: id }
    const now = Math.floor(Date.now() / 1000)
    const payload = { iat: now, exp: now + 300, aud: '/admin/' }

    const headerEnc = base64UrlEncode(JSON.stringify(header))
    const payloadEnc = base64UrlEncode(JSON.stringify(payload))
    const signingInput = `${headerEnc}.${payloadEnc}`

    const key = await crypto.subtle.importKey(
        'raw',
        hexToBuffer(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const signingBuf = new ArrayBuffer(signingInput.length)
    new Uint8Array(signingBuf).set(new TextEncoder().encode(signingInput))
    const signature = await crypto.subtle.sign('HMAC', key, signingBuf)
    return `${signingInput}.${base64UrlEncode(signature)}`
}
