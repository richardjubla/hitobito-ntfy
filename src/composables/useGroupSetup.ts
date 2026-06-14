import _sodium from 'libsodium-wrappers'

async function getSodium() {
  await _sodium.ready
  return _sodium
}

export function extractTopic(stored: string): string {
  const i = stored.indexOf(':')
  return i === -1 ? stored : stored.slice(0, i)
}

function fromBase64Url(b64: string): Uint8Array {
  const std = b64.replace(/-/g, '+').replace(/_/g, '/')
  const padded = std + '='.repeat((4 - (std.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

export function parseJublaEntry(
  stored: string,
): { topic: string; secretKey: Uint8Array; encKey: Uint8Array } | null {
  const parts = stored.split(':')
  if (parts.length !== 3) return null
  try {
    const secretKey = fromBase64Url(parts[1])
    const encKey = fromBase64Url(parts[2])
    if (secretKey.length !== 64) return null  // crypto_sign_SECRETKEYBYTES
    if (encKey.length !== 32) return null     // crypto_secretbox_KEYBYTES
    return { topic: parts[0], secretKey, encKey }
  } catch {
    return null
  }
}

export function isManagedEntry(stored: string): boolean {
  return /^j[0-9a-f]{32}:.+:.+$/.test(stored)
}

export async function generateJublaEntry(groupId: number, password: string): Promise<string> {
  const sodium = await getSodium()

  const saltBytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(groupId))),
  ).slice(0, sodium.crypto_pwhash_SALTBYTES)

  const seed = sodium.crypto_pwhash(
    64,
    password,
    saltBytes,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  )

  const { privateKey } = sodium.crypto_sign_seed_keypair(seed.slice(0, 32))
  const encKey = seed.slice(32, 64)

  const topicHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${groupId}:${password}`)),
  )
  const topic = 'j' + Array.from(topicHash).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)

  const b64sk = sodium.to_base64(privateKey, sodium.base64_variants.URLSAFE_NO_PADDING)
  const b64ek = sodium.to_base64(encKey, sodium.base64_variants.URLSAFE_NO_PADDING)

  return `${topic}:${b64sk}:${b64ek}`
}
