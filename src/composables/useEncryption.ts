import _sodium from 'libsodium-wrappers-sumo'

const HEADER = '-----BEGIN JUBLA MESSAGE-----'
const FOOTER = '-----END JUBLA MESSAGE-----'

async function getSodium() {
  await _sodium.ready
  return _sodium
}

async function jublaChecksum(b64: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(b64)))
  return btoa(String.fromCharCode(hash[0], hash[1], hash[2]))
}

export async function encryptAndSign(
  message: string,
  secretKey: Uint8Array,
  encKey: Uint8Array,
): Promise<string> {
  const sodium = await getSodium()
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ct = sodium.crypto_secretbox_easy(message, nonce, encKey)
  const payload = new Uint8Array(nonce.length + ct.length)
  payload.set(nonce)
  payload.set(ct, nonce.length)
  const sig = sodium.crypto_sign_detached(payload, secretKey)
  const combined = new Uint8Array(payload.length + sig.length)
  combined.set(payload)
  combined.set(sig, payload.length)
  return sodium.to_base64(combined, sodium.base64_variants.URLSAFE_NO_PADDING)
}

export async function verifyAndDecrypt(
  b64: string,
  secretKey: Uint8Array,
  encKey: Uint8Array,
): Promise<string> {
  const sodium = await getSodium()
  const combined = sodium.from_base64(b64, sodium.base64_variants.URLSAFE_NO_PADDING)
  const sigLen = sodium.crypto_sign_BYTES
  const nonceLen = sodium.crypto_secretbox_NONCEBYTES
  const payload = combined.slice(0, combined.length - sigLen)
  const sig = combined.slice(combined.length - sigLen)
  const pubKey = sodium.crypto_sign_ed25519_sk_to_pk(secretKey)
  if (!sodium.crypto_sign_verify_detached(sig, payload, pubKey)) {
    throw new Error('Ungültige Signatur')
  }
  const pt = sodium.crypto_secretbox_open_easy(payload.slice(nonceLen), payload.slice(0, nonceLen), encKey)
  return new TextDecoder().decode(pt)
}

export async function wrapMessage(groupId: number, b64: string): Promise<string> {
  const crc = await jublaChecksum(b64)
  return `${HEADER}\nGroup: ${groupId}\nVersion: 1\n\n${b64}\n=${crc}\n${FOOTER}`
}

export async function unwrapMessage(body: string): Promise<{ groupId: number; payload: string } | null> {
  const s = body.indexOf(HEADER)
  const e = body.indexOf(FOOTER)
  if (s === -1 || e === -1) return null
  const lines = body.slice(s + HEADER.length, e).split('\n')
  let groupId: number | null = null
  let seenHeader = false
  let inBody = false
  const parts: string[] = []
  let storedCrc: string | null = null
  for (const line of lines) {
    const t = line.trim()
    if (inBody) {
      if (t.startsWith('=')) storedCrc = t.slice(1)
      else if (t) parts.push(t)
    } else if (t === '' && seenHeader) {
      inBody = true
    } else if (t.startsWith('Group:')) {
      groupId = parseInt(t.slice(6).trim(), 10)
      seenHeader = true
    } else if (t) {
      seenHeader = true
    }
  }
  if (groupId === null || parts.length === 0) return null
  const payload = parts.join('')
  if (storedCrc !== null && storedCrc !== (await jublaChecksum(payload))) return null
  return { groupId, payload }
}

export function isJublaMessage(body: string): boolean {
  return body.includes(HEADER)
}
