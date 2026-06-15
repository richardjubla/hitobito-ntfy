import _sodium from 'libsodium-wrappers-sumo'
import { deflateSync, inflateSync } from 'fflate'

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
  signingKey: Uint8Array,
  encKey: Uint8Array,
): Promise<string> {
  const sodium = await getSodium()
  const { privateKey } = sodium.crypto_sign_seed_keypair(signingKey)
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ct = sodium.crypto_secretbox_easy(message, nonce, encKey)
  const payload = new Uint8Array(nonce.length + ct.length)
  payload.set(nonce)
  payload.set(ct, nonce.length)
  const sig = sodium.crypto_sign_detached(payload, privateKey)
  const combined = new Uint8Array(payload.length + sig.length)
  combined.set(payload)
  combined.set(sig, payload.length)
  return sodium.to_base64(combined, sodium.base64_variants.URLSAFE_NO_PADDING)
}

export async function verifyAndDecrypt(
  b64: string,
  signingKey: Uint8Array,
  encKey: Uint8Array,
): Promise<string> {
  const sodium = await getSodium()
  const { publicKey } = sodium.crypto_sign_seed_keypair(signingKey)
  const combined = sodium.from_base64(b64, sodium.base64_variants.URLSAFE_NO_PADDING)
  const sigLen = sodium.crypto_sign_BYTES
  const nonceLen = sodium.crypto_secretbox_NONCEBYTES
  const payload = combined.slice(0, combined.length - sigLen)
  const sig = combined.slice(combined.length - sigLen)
  if (!sodium.crypto_sign_verify_detached(sig, payload, publicKey)) {
    throw new Error('Ungültige Signatur')
  }
  const pt = sodium.crypto_secretbox_open_easy(payload.slice(nonceLen), payload.slice(0, nonceLen), encKey)
  return new TextDecoder().decode(pt).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function compress(data: Uint8Array): Uint8Array {
  return deflateSync(data)
}

function decompress(data: Uint8Array): Uint8Array {
  return inflateSync(data)
}

export async function encryptForUrl(
  message: string,
  signingKey: Uint8Array,
  encKey: Uint8Array,
): Promise<string> {
  const sodium = await getSodium()
  const { privateKey } = sodium.crypto_sign_seed_keypair(signingKey)
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const compressed = compress(new TextEncoder().encode(message))
  const ct = sodium.crypto_secretbox_easy(compressed, nonce, encKey)
  const payload = new Uint8Array(nonce.length + ct.length)
  payload.set(nonce)
  payload.set(ct, nonce.length)
  const sig = sodium.crypto_sign_detached(payload, privateKey)
  const combined = new Uint8Array(payload.length + sig.length)
  combined.set(payload)
  combined.set(sig, payload.length)
  return sodium.to_base64(combined, sodium.base64_variants.URLSAFE_NO_PADDING)
}

export async function decryptFromUrl(
  b64: string,
  signingKey: Uint8Array,
  encKey: Uint8Array,
): Promise<string> {
  const sodium = await getSodium()
  const { publicKey } = sodium.crypto_sign_seed_keypair(signingKey)
  const combined = sodium.from_base64(b64, sodium.base64_variants.URLSAFE_NO_PADDING)
  const sigLen = sodium.crypto_sign_BYTES
  const nonceLen = sodium.crypto_secretbox_NONCEBYTES
  const payload = combined.slice(0, combined.length - sigLen)
  const sig = combined.slice(combined.length - sigLen)
  if (!sodium.crypto_sign_verify_detached(sig, payload, publicKey)) throw new Error('Ungültige Signatur')
  const compressed = sodium.crypto_secretbox_open_easy(payload.slice(nonceLen), payload.slice(0, nonceLen), encKey)
  const decompressed = decompress(compressed)
  return new TextDecoder().decode(decompressed).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

// TOTP-style auth tag: HMAC-SHA256(encKey, 5-min-window) → first 8 bytes, base64url
export async function computeMessageTag(encKey: Uint8Array, windowTs: number): Promise<string> {
  const keyBytes = new Uint8Array(encKey).buffer as ArrayBuffer
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(windowTs))),
  )
  return btoa(String.fromCharCode(...mac.slice(0, 8)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function wrapMessage(b64: string): Promise<string> {
  const crc = await jublaChecksum(b64)
  return `${HEADER}\n\n${b64}\n=${crc}\n${FOOTER}`
}

export async function unwrapMessage(body: string): Promise<{ payload: string } | null> {
  const s = body.indexOf(HEADER)
  const e = body.indexOf(FOOTER)
  if (s === -1 || e === -1) return null
  const lines = body.slice(s + HEADER.length, e).split('\n')
  let inBody = false
  const parts: string[] = []
  let storedCrc: string | null = null
  for (const line of lines) {
    const t = line.trim()
    if (inBody) {
      if (t.startsWith('=')) storedCrc = t.slice(1)
      else if (t) parts.push(t)
    } else if (t === '') {
      inBody = true
    }
  }
  if (parts.length === 0) return null
  const payload = parts.join('')
  if (storedCrc !== null && storedCrc !== (await jublaChecksum(payload))) return null
  return { payload }
}

export function isJublaMessage(body: string): boolean {
  return body.includes(HEADER)
}
