import { encryptAndSign, wrapMessage } from './useEncryption'

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
  ): Promise<void> {
    const b64 = await encryptAndSign(msg.message.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), secretKey, encKey)
    const wrapper = await wrapMessage(b64)
    const appUrl = `${window.location.origin}${window.location.pathname}#/messages/${groupId}`
    const body = `Diese Mitteilung in der Jubla Mitteilungen App abrufen.\n${wrapper}`
    // Receipt topic: main topic + 'r' suffix — only visible in ntfy, filtered by app
    const ackTopic = `${topic}r`
    const actions = [
      `view, In App lesen, ${appUrl}, clear=true`,
      `http, Gelesen ✓, ${NTFY_BASE}/${ackTopic}, method=POST, body=gelesen, clear=true`,
    ].join('; ')
    const response = await fetch(`${NTFY_BASE}/${topic}`, {
      method: 'POST',
      body,
      headers: {
        Title: msg.title,
        Priority: '3',
        Tags: (msg.tags ?? ['jubla']).join(','),
        Click: appUrl,
        Actions: actions,
      },
    })
    if (!response.ok) throw new Error(`ntfy Fehler: ${await response.text()}`)
  }

  function subscribeUrl(topic: string): string {
    return `${NTFY_BASE}/${topic}`
  }

  return { sendNotification, subscribeUrl }
}
