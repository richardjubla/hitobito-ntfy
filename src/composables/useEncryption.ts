const HEADER = '-----BEGIN JUBLA MESSAGE-----'
const FOOTER = '-----END JUBLA MESSAGE-----'

export async function deriveKey(topic: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(topic))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptText(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  const buf = new Uint8Array(12 + ct.byteLength)
  buf.set(iv)
  buf.set(new Uint8Array(ct), 12)
  return btoa(String.fromCharCode(...buf))
}

export async function decryptText(b64: string, key: CryptoKey): Promise<string> {
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12))
  return new TextDecoder().decode(pt)
}

async function jublaChecksum(b64payload: string): Promise<string> {
  const raw = Uint8Array.from(atob(b64payload), (c) => c.charCodeAt(0))
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', raw))
  return btoa(String.fromCharCode(hash[0], hash[1], hash[2]))
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
  let afterBlank = false
  const parts: string[] = []
  let storedCrc: string | null = null

  for (const line of lines) {
    const t = line.trim()
    if (afterBlank) {
      if (t.startsWith('=')) storedCrc = t.slice(1)
      else if (t) parts.push(t)
    } else if (t.startsWith('Group:')) {
      groupId = parseInt(t.slice(6).trim(), 10)
    } else if (t === '') {
      afterBlank = true
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
