export const NTFY_BASE = (import.meta.env.VITE_NTFY_BASE_URL as string | undefined) ?? 'https://ntfy.sh'

const CACHE_PREFIX = 'ntfy_cache_'
const MAX_CACHED = 500

export interface NtfyMessage {
  id: string
  time: number
  topic: string
  title?: string
  message: string
  priority?: number
  tags?: string[]
}

export function loadCachedMessages(topic: string): NtfyMessage[] {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${topic}`)
    return raw ? (JSON.parse(raw) as NtfyMessage[]) : []
  } catch {
    return []
  }
}

function saveToCache(topic: string, messages: NtfyMessage[]): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${topic}`, JSON.stringify(messages.slice(0, MAX_CACHED)))
  } catch {
    // localStorage voll oder nicht verfügbar
  }
}

function mergeAndSort(a: NtfyMessage[], b: NtfyMessage[]): NtfyMessage[] {
  const map = new Map<string, NtfyMessage>()
  for (const m of [...a, ...b]) map.set(m.id, m)
  return [...map.values()].sort((x, y) => y.time - x.time)
}

export async function fetchMessages(topic: string): Promise<NtfyMessage[]> {
  const res = await fetch(`${NTFY_BASE}/${topic}/json?poll=1&since=all`, {
    headers: { Accept: 'application/x-ndjson' },
  })
  if (!res.ok) throw new Error(`ntfy ${res.status}`)
  const text = await res.text()
  const fresh = text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as NtfyMessage)
    .filter((m) => m.id && m.message)

  const merged = mergeAndSort(loadCachedMessages(topic), fresh)
  saveToCache(topic, merged)
  return merged
}

