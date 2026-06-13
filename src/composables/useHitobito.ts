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
    // Versuche /api/v1/people — mit with_roles Scope gibt hitobito nur den aktuellen User zurück
    const data = await apiFetch<Record<string, unknown>>('/api/v1/people', accessToken)
    console.debug('[hitobito] /api/v1/people response keys:', Object.keys(data))
    console.debug('[hitobito] /api/v1/people response:', JSON.stringify(data).slice(0, 500))

    const people = (data['people'] as Record<string, unknown>[] | undefined) ?? []
    if (people.length === 0) throw new Error('Keine Person im API-Response gefunden')

    const p = people[0] as Record<string, unknown>
    const person: Person = {
      id: p['id'] as number,
      href: (p['href'] as string) ?? '',
      first_name: (p['first_name'] as string) ?? '',
      last_name: (p['last_name'] as string) ?? '',
      email: p['email'] as string | undefined,
    }

    const linked = data['linked'] as Record<string, unknown> | undefined
    const rawRoles = (linked?.['roles'] ?? p['roles'] ?? []) as Record<string, unknown>[]
    const roles: Role[] = rawRoles.map((r) => ({
      id: String(r['id'] ?? ''),
      type: (r['role_class_name'] ?? r['type'] ?? '') as string,
      group_id: r['group_id'] as number,
      label: (r['label'] ?? r['role_name']) as string | undefined,
    }))

    return { person, roles }
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
