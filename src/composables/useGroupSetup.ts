export const MANAGED_TOPIC_RE = /^j[0-9a-f]{32}$/

export function isManagedTopic(name: string): boolean {
  return MANAGED_TOPIC_RE.test(name)
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function generateTopic(groupId: number, kennwort: string): Promise<string> {
  return `j${(await sha256Hex(`${groupId}:${kennwort}`)).slice(0, 32)}`
}
