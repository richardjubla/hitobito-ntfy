const HITOBITO_URL = import.meta.env.VITE_HITOBITO_URL as string
const CLIENT_ID = import.meta.env.VITE_OAUTH_CLIENT_ID as string
const CLIENT_SECRET = import.meta.env.VITE_OAUTH_CLIENT_SECRET as string | undefined

function getRedirectUri(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  return `${window.location.origin}${base}`
}

function generateVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function deriveChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function useAuth() {
  async function login() {
    const verifier = generateVerifier()
    const challenge = await deriveChallenge(verifier)
    sessionStorage.setItem('pkce_verifier', verifier)

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: getRedirectUri(),
      response_type: 'code',
      scope: 'with_roles groups api',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })
    window.location.href = `${HITOBITO_URL}/oauth/authorize?${params}`
  }

  async function exchangeCode(code: string): Promise<Record<string, unknown>> {
    const verifier = sessionStorage.getItem('pkce_verifier')
    if (!verifier) throw new Error('Kein PKCE Verifier gefunden — bitte neu einloggen')
    sessionStorage.removeItem('pkce_verifier')

    const response = await fetch(`${HITOBITO_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        ...(CLIENT_SECRET ? { client_secret: CLIENT_SECRET } : {}),
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri(),
      }),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Token-Exchange fehlgeschlagen: ${err}`)
    }
    const data = await response.json()
    return data as Record<string, unknown>
  }

  return { login, exchangeCode }
}
