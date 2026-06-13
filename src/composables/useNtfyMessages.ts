const NTFY_BASE = (import.meta.env.VITE_NTFY_BASE_URL as string | undefined) ?? 'https://ntfy.sh'

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

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array([...raw].map((c) => c.charCodeAt(0)))
  return arr.buffer as ArrayBuffer
}

export async function subscribePush(topics: string[]): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push nicht unterstützt')
  }
  const cfg = await fetch(`${NTFY_BASE}/v1/config`).then((r) => r.json()) as Record<string, unknown>
  const vapidKey = (cfg['web-push-public-key'] as string | undefined)
    ?? (cfg['webPushPublicKey'] as string | undefined)
  if (!vapidKey) throw new Error('Kein VAPID-Key von ntfy')

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  })

  await fetch(`${NTFY_BASE}/v1/webpush`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topics, browserSubscription: sub.toJSON() }),
  })
}

export async function unsubscribePush(topics: string[]): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await fetch(`${NTFY_BASE}/v1/webpush`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topics, browserSubscription: sub.toJSON() }),
  })
}

export async function isSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub !== null
}
