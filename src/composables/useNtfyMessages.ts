export const NTFY_BASE = (import.meta.env.VITE_NTFY_BASE_URL as string | undefined) ?? 'https://ntfy.sh'

export interface NtfyMessage {
  id: string
  time: number
  topic: string
  title?: string
  message: string
  priority?: number
  tags?: string[]
}

export async function fetchMessages(topic: string): Promise<NtfyMessage[]> {
  const res = await fetch(`${NTFY_BASE}/${topic}/json?poll=1`, {
    headers: { Accept: 'application/x-ndjson' },
  })
  if (!res.ok) throw new Error(`ntfy ${res.status}`)
  const text = await res.text()
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as NtfyMessage)
    .filter((m) => m.id && m.message)
    .reverse()
}

