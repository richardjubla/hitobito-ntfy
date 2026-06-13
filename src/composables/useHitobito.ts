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

// /oauth/profile gibt User + Rollen zurück (mit with_roles Scope)
// Format: { id, email, name, roles: [{ group_id, role_class_name, ... }] }
function parseProfile(data: Record<string, unknown>): { person: Person; roles: Role[] } {
  const person: Person = {
    id: data['id'] as number,
    href: '',
    first_name: ((data['name'] as string) ?? '').split(' ')[0] ?? '',
    last_name: ((data['name'] as string) ?? '').split(' ').slice(1).join(' '),
    email: data['email'] as string | undefined,
    nickname: data['nickname'] as string | null | undefined,
  }
  const rawRoles = (data['roles'] as Record<string, unknown>[] | undefined) ?? []
  const roles: Role[] = rawRoles.map((r) => ({
    id: String(r['id'] ?? ''),
    type: (r['role_class_name'] ?? r['name'] ?? '') as string,
    group_id: r['group_id'] as number,
    label: r['role_name'] as string | undefined,
  }))
  return { person, roles }
}

export function useHitobito() {
  const auth = useAuthStore()

  function token(): string {
    if (!auth.token) throw new Error('Nicht eingeloggt')
    return auth.token
  }

  async function fetchMeWithToken(t: string): Promise<{ person: Person; roles: Role[] }> {
    // /oauth/profile ist CORS-fähig und braucht keinen separaten api-Scope
    const data = await apiFetch<Record<string, unknown>>('/oauth/profile', t)
    return parseProfile(data)
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
