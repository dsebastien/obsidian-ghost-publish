/** SHA-256 of a string, returned as lowercase hex. */
export async function sha256Hex(input: string): Promise<string> {
    const encoded = new TextEncoder().encode(input)
    const buf = new ArrayBuffer(encoded.byteLength)
    new Uint8Array(buf).set(encoded)
    const digest = await crypto.subtle.digest('SHA-256', buf)
    const arr = new Uint8Array(digest)
    let hex = ''
    for (let i = 0; i < arr.length; i++) {
        const b = arr[i]!
        hex += b.toString(16).padStart(2, '0')
    }
    return hex
}
