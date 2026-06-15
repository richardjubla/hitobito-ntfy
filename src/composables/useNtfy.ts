import { encryptAndSign, wrapMessage, computeMessageTag, encryptForUrl } from './useEncryption'

const NTFY_BASE = (import.meta.env.VITE_NTFY_BASE_URL as string | undefined) ?? 'https://ntfy.sh'

export interface NtfyMessage {
  title: string
  message: string
  tags?: string[]
}

export function useNtfy() {
  async function sendNotification(
    topic: string,
    groupId: number,
    secretKey: Uint8Array,
    encKey: Uint8Array,
    msg: NtfyMessage,
    groupDisplayName?: string,
  ): Promise<void> {
    const normalized = msg.message.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const b64 = await encryptAndSign(msg.title, normalized, secretKey, encKey)
    const wrapper = await wrapMessage(b64)
    // Click URL carries the compressed+encrypted message so it stays readable after ntfy TTL
    const urlPayload = await encryptForUrl(msg.title, normalized, secretKey, encKey)
    const appUrl = `${window.location.origin}${window.location.pathname}#/messages/${groupId}?m=${urlPayload}`
    const body = `Diese Mitteilung in der Jubla Mitteilungen App abrufen.\n${wrapper}`
    const windowTs = Math.floor(Date.now() / 1000 / 300)
    const authTag = await computeMessageTag(encKey, windowTs)
    const ntfyTitle = groupDisplayName ? `JM: ${groupDisplayName}` : 'Jubla Mitteilung'
    const response = await fetch(`${NTFY_BASE}/${topic}`, {
      method: 'POST',
      body,
      headers: {
        Title: ntfyTitle,
        Priority: '3',
        Tags: ['jubla', `jm${authTag}`].join(','),
        Click: appUrl,
      },
    })
    if (!response.ok) throw new Error(`ntfy Fehler: ${await response.text()}`)
  }

  function subscribeUrl(topic: string): string {
    return `${NTFY_BASE}/${topic}`
  }

  return { sendNotification, subscribeUrl }
}
