import { deriveKey, encryptText, wrapMessage } from './useEncryption'

const NTFY_BASE = (import.meta.env.VITE_NTFY_BASE_URL as string | undefined) ?? 'https://ntfy.sh'

export interface NtfyMessage {
  title: string
  message: string
  priority: 1 | 2 | 3 | 4 | 5
  tags?: string[]
}

export function useNtfy() {
  async function sendNotification(topic: string, groupId: number, msg: NtfyMessage): Promise<void> {
    const key = await deriveKey(topic)
    const b64 = await encryptText(msg.message, key)
    const body = await wrapMessage(groupId, b64)

    const response = await fetch(`${NTFY_BASE}/${topic}`, {
      method: 'POST',
      body,
      headers: {
        Title: msg.title,
        Priority: String(msg.priority),
        Tags: (msg.tags ?? ['jubla']).join(','),
      },
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`ntfy Fehler: ${err}`)
    }
  }

  function subscribeUrl(topic: string): string {
    return `${NTFY_BASE}/${topic}`
  }

  return { sendNotification, subscribeUrl }
}
