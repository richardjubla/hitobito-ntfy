import { encryptAndSign, wrapMessage } from './useEncryption'

const NTFY_BASE = (import.meta.env.VITE_NTFY_BASE_URL as string | undefined) ?? 'https://ntfy.sh'

export interface NtfyMessage {
  title: string
  message: string
  priority: 1 | 2 | 3 | 4 | 5
  tags?: string[]
}

export function useNtfy() {
  async function sendNotification(
    topic: string,
    groupId: number,
    secretKey: Uint8Array,
    encKey: Uint8Array,
    msg: NtfyMessage,
  ): Promise<void> {
    const b64 = await encryptAndSign(msg.message.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), secretKey, encKey)
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
    if (!response.ok) throw new Error(`ntfy Fehler: ${await response.text()}`)
  }

  function subscribeUrl(topic: string): string {
    return `${NTFY_BASE}/${topic}`
  }

  return { sendNotification, subscribeUrl }
}
