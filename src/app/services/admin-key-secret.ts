import type { SecretStorage } from 'obsidian'
import { log } from '../../utils/log'

/**
 * The Ghost Admin API key lives in Obsidian's SecretStorage (device-local,
 * never synced), not in data.json: data.json travels with the vault through
 * git, Syncthing or cloud sync. Settings store the secret NAME.
 *
 * Versions up to 1.1.1 stored the key in plain text (`ghostAdminKey`). That
 * field is kept as a read-only, per-device bootstrap source for a grace
 * period: every synced device copies it into its own SecretStorage on its
 * next start, so no device needs the key re-entered. It is never written
 * with a new value, and is dropped after the grace period, on rotation, on
 * "forget key", or via the "Remove plain-text copy now" button.
 */

/** Default secret name (`<plugin-id>-<what>`); a valid SecretStorage id. */
export const DEFAULT_ADMIN_KEY_SECRET_NAME = 'ghost-publish-admin-key'

/** How long the legacy plain-text copy is kept after the first migration. */
export const LEGACY_ADMIN_KEY_GRACE_PERIOD_MS = 60 * 24 * 60 * 60 * 1000

/** The slice of SecretStorage this plugin uses; lets tests pass a fake. */
export type SecretStore = Pick<SecretStorage, 'getSecret' | 'setSecret'>

/** The settings fields the admin key lifecycle touches. */
export interface AdminKeyFields {
    ghostAdminKeySecretName: string
    /** Legacy plain-text key (up to 1.1.1). Bootstrap source only. */
    ghostAdminKey?: string
    /** ISO date of the first migration; starts the grace period. */
    legacySecretMigratedAt?: string
}

/** Upper bound on `-2`, `-3`, ... suffixes tried on first migration. */
const MAX_SUFFIX = 100

/**
 * Read a secret by name; '' when the name is empty or the secret is missing.
 * SecretStorage has no delete API, so an empty value means "absent".
 */
export function readSecret(store: SecretStore | undefined, name: string): string {
    const id = name.trim()
    if (!store || !id) return ''
    return (store.getSecret(id) ?? '').trim()
}

/**
 * First migration only: find the secret name to move the legacy key into.
 * The configured name is kept when its slot is free or already holds the
 * value; otherwise the default name, then `-2`, `-3`, ... A slot holding a
 * DIFFERENT value is never overwritten. Writes the value; idempotent.
 */
export function claimSecretName(store: SecretStore, value: string, currentName: string): string {
    const candidates = [currentName.trim(), DEFAULT_ADMIN_KEY_SECRET_NAME]
    for (let i = 2; i <= MAX_SUFFIX; i += 1) {
        candidates.push(`${DEFAULT_ADMIN_KEY_SECRET_NAME}-${i}`)
    }
    for (const candidate of candidates) {
        if (!candidate) continue
        const existing = readSecret(store, candidate)
        if (existing === value) return candidate
        if (!existing) {
            store.setSecret(candidate, value)
            return candidate
        }
    }
    throw new Error('No free secret name to migrate the Ghost Admin API key into.')
}

/**
 * Per-device bootstrap, run on every load. Mutates `fields` (an Immer draft)
 * and returns whether anything there changed (the caller then persists):
 * - empty legacy field: dropped;
 * - first migration (no `legacySecretMigratedAt`): claim a secret name,
 *   record the date;
 * - later loads, on any device: copy the legacy value into this device's
 *   SecretStorage when the secret is absent there; never overwrite a secret
 *   already set (it may be newer);
 * - grace period over: drop the legacy field.
 * A SecretStorage failure is logged and leaves the legacy field in place, so
 * the key keeps working through the read fallback.
 */
export function bootstrapAdminKey(
    store: SecretStore | undefined,
    fields: AdminKeyFields,
    now: Date
): boolean {
    if (fields.ghostAdminKey === undefined) return false
    const legacy = fields.ghostAdminKey.trim()
    if (!legacy) {
        delete fields.ghostAdminKey
        return true
    }

    let changed = false
    if (!fields.ghostAdminKeySecretName.trim()) {
        fields.ghostAdminKeySecretName = DEFAULT_ADMIN_KEY_SECRET_NAME
        changed = true
    }

    const migratedAt = Date.parse(fields.legacySecretMigratedAt ?? '')
    if (store) {
        try {
            if (Number.isNaN(migratedAt)) {
                const name = claimSecretName(store, legacy, fields.ghostAdminKeySecretName)
                fields.ghostAdminKeySecretName = name
                fields.legacySecretMigratedAt = now.toISOString()
                log(`Copied the Ghost Admin API key to secret storage ("${name}")`, 'info')
                return true
            }
            if (!readSecret(store, fields.ghostAdminKeySecretName)) {
                store.setSecret(fields.ghostAdminKeySecretName, legacy)
                log('Copied the Ghost Admin API key to this device’s secret storage', 'info')
            }
        } catch (e) {
            log('Could not copy the Ghost Admin API key to secret storage', 'error', e)
            return changed
        }
    }

    if (
        !Number.isNaN(migratedAt) &&
        now.getTime() - migratedAt >= LEGACY_ADMIN_KEY_GRACE_PERIOD_MS
    ) {
        delete fields.ghostAdminKey
        changed = true
    }
    return changed
}

/**
 * The admin key for this device: the named secret first, then the legacy
 * plain-text copy (copied into SecretStorage on the spot). '' when neither.
 */
export function readAdminKey(store: SecretStore | undefined, fields: AdminKeyFields): string {
    const secret = readSecret(store, fields.ghostAdminKeySecretName)
    if (secret) return secret
    const legacy = (fields.ghostAdminKey ?? '').trim()
    const name = fields.ghostAdminKeySecretName.trim()
    if (legacy && store && name) {
        try {
            store.setSecret(name, legacy)
        } catch (e) {
            log('Could not copy the Ghost Admin API key to secret storage', 'error', e)
        }
    }
    return legacy
}
