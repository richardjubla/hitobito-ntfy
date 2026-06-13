import { useAuthStore } from '../stores/auth'
import type { Person, Role, Group } from '../types/hitobito'

const HITOBITO_URL = import.meta.env.VITE_HITOBITO_URL as string

function makeHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }
}

async function apiFetch<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${HITOBITO_URL}${path}`, { headers: makeHeaders(token) })
  if (!response.ok) throw new Error(`hitobito API ${response.status}: ${path}`)
  return response.json() as Promise<T>
}

export function useHitobito() {
  const auth = useAuthStore()

  function token(): string {
    if (!auth.token) throw new Error('Nicht eingeloggt')
    return auth.token
  }

  async function fetchMeWithToken(
    accessToken: string,
    _idToken?: string,
  ): Promise<{ person: Person; roles: Role[] }> {
    // Teste ob CORS für /api/v1/groups überhaupt funktioniert
    const data = await apiFetch<Record<string, unknown>>('/api/v1/groups', accessToken)
    console.debug('[hitobito] /api/v1/groups keys:', Object.keys(data))
    console.debug('[hitobito] /api/v1/groups response:', JSON.stringify(data).slice(0, 800))

    // Platzhalter — wir wollen erst sehen was zurückkommt
    const person: Person = { id: 0, href: '', first_name: 'Test', last_name: '' }
    return { person, roles: [] }
  }

  async function fetchGroupsWithToken(t: string, personId: number): Promise<Group[]> {
    const data = await apiFetch<Record<string, unknown>>(
      `/api/v1/groups?person_id=${personId}&all=true`,
      t,
    )
    return (data['groups'] as Group[]) ?? []
  }

  async function fetchMe() {
    return fetchMeWithToken(token())
  }

  async function fetchGroups(personId: number) {
    return fetchGroupsWithToken(token(), personId)
  }

  async function fetchGroupDetails(groupId: number): Promise<Group> {
    const data = await apiFetch<Record<string, unknown>>(
      `/api/v1/groups/${groupId}`,
      token(),
    )
    const groups = data['groups'] as Group[]
    return groups[0]
  }

  return { fetchMe, fetchGroups, fetchGroupDetails, fetchMeWithToken, fetchGroupsWithToken }
}
