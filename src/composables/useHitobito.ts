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

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1]
  if (!payload) throw new Error('Kein gültiger JWT')
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
}

export function useHitobito() {
  const auth = useAuthStore()

  function token(): string {
    if (!auth.token) throw new Error('Nicht eingeloggt')
    return auth.token
  }

  async function fetchMeWithToken(
    _accessToken: string,
    idToken?: string,
  ): Promise<{ person: Person; roles: Role[] }> {
    if (!idToken) throw new Error('Kein id_token — openid Scope fehlt oder nicht unterstützt')

    // id_token ist ein signiertes JWT mit person ID als "sub"
    const claims = decodeJwtPayload(idToken)
    console.debug('[hitobito] id_token claims:', claims)

    const personId = Number(claims['sub'])
    if (!personId) throw new Error(`Person-ID nicht im id_token gefunden. Claims: ${JSON.stringify(claims)}`)

    const person: Person = {
      id: personId,
      href: '',
      first_name: (claims['first_name'] as string | undefined) ?? '',
      last_name: (claims['last_name'] as string | undefined) ?? '',
      email: claims['email'] as string | undefined,
    }

    // Rollen aus id_token (with_roles Scope) oder leer lassen
    const jwtRoles = claims['roles'] as Record<string, unknown>[] | undefined
    const roles: Role[] = (jwtRoles ?? []).map((r) => ({
      id: String(r['id'] ?? ''),
      type: (r['role_class_name'] ?? r['type'] ?? '') as string,
      group_id: r['group_id'] as number,
      label: r['role_name'] as string | undefined,
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
