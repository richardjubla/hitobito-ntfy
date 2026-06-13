const NTFY_BASE = import.meta.env.VITE_NTFY_BASE_URL as string ?? 'https://ntfy.sh'

export interface NtfyMessage {
  title: string
  message: string
  priority: 1 | 2 | 3 | 4 | 5
  tags?: string[]
}

export function useNtfy() {
  async function sendNotification(topic: string, msg: NtfyMessage): Promise<void> {
    const response = await fetch(`${NTFY_BASE}/${topic}`, {
      method: 'POST',
      body: msg.message,
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
