import type { SocialAccount } from '../types/hitobito'

const HITOBITO_URL = import.meta.env.VITE_HITOBITO_URL as string

export const MANAGED_TOPIC_RE = /^j[0-9a-f]{24}v\d+$/

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

function randomHex16(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function generateTopic(groupId: number): Promise<string> {
  const gHash8 = (await sha256Hex(String(groupId))).slice(0, 8)
  return `j${gHash8}${randomHex16()}v1`
}

export function reinitTopic(currentTopic: string): string {
  const match = currentTopic.match(/^j([0-9a-f]{8})[0-9a-f]{16}v(\d+)$/)
  if (!match) throw new Error('Kein managed Topic — Re-Init nicht möglich')
  const gHash8 = match[1]
  const counter = parseInt(match[2], 10)
  return `j${gHash8}${randomHex16()}v${counter + 1}`
}

export async function createSocialAccount(
  groupId: number,
  topic: string,
  token: string,
): Promise<SocialAccount> {
  const res = await fetch(`${HITOBITO_URL}/api/social_accounts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'social_accounts',
        attributes: { label: 'ntfy', name: topic, public: false },
        relationships: {
          contactable: { data: { type: 'groups', id: String(groupId) } },
        },
      },
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`hitobito ${res.status}: ${body}`)
  }
  const json = await res.json() as { data: { id: string; attributes: Record<string, unknown> } }
  return {
    id: json.data.id,
    label: json.data.attributes['label'] as string,
    name: json.data.attributes['name'] as string,
    public: json.data.attributes['public'] as boolean,
  }
}

export async function updateSocialAccount(
  saId: string,
  topic: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${HITOBITO_URL}/api/social_accounts/${saId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'social_accounts',
        id: saId,
        attributes: { name: topic },
      },
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`hitobito ${res.status}: ${body}`)
  }
}
