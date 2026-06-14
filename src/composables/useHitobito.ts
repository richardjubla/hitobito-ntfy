import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import type { Person, Role, Group, SocialAccount } from '../types/hitobito'

const HITOBITO_URL = import.meta.env.VITE_HITOBITO_URL as string

interface JsonApiResource {
  id: string
  type: string
  attributes: Record<string, unknown>
  relationships?: Record<string, {
    data?: { id: string; type: string }[] | { id: string; type: string } | null
  }>
}

interface JsonApiResponse {
  data: JsonApiResource | JsonApiResource[]
  included?: JsonApiResource[]
}

async function apiFetch<T>(path: string, token: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${HITOBITO_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    signal,
  })
  if (response.status === 401) throw new TokenExpiredError()
  if (!response.ok) throw new Error(`hitobito ${response.status}: ${path}`)
  return response.json() as Promise<T>
}

class TokenExpiredError extends Error {
  constructor() { super('Token abgelaufen') }
}

function parseGroup(data: JsonApiResponse): Group {
  const r = Array.isArray(data.data) ? data.data[0] : data.data
  const included = data.included ?? []

  const saRel = r.relationships?.['social_accounts']?.data
  const saIds = Array.isArray(saRel) ? saRel.map((x) => x.id) : []
  const socialAccounts: SocialAccount[] = included
    .filter((i) => i.type === 'social_accounts' && saIds.includes(i.id))
    .map((sa) => ({
      id: sa.id,
      label: sa.attributes['label'] as string,
      name: sa.attributes['name'] as string,
      public: sa.attributes['public'] as boolean,
    }))

  return {
    id: Number(r.id),
    href: '',
    name: r.attributes['name'] as string,
    short_name: r.attributes['short_name'] as string | undefined,
    group_type: (r.attributes['group_type'] as string) ?? r.type,
    layer: (r.attributes['layer'] as boolean) ?? false,
    description: (r.attributes['description'] as string) ?? undefined,
    social_accounts: socialAccounts,
  }
}

export { TokenExpiredError }

export function useHitobito() {
  const auth = useAuthStore()
  const router = useRouter()

  function handleError(e: unknown): never {
    if (e instanceof TokenExpiredError) {
      auth.clear()
      router.push('/login')
    }
    throw e
  }

  function token(): string {
    if (!auth.token) throw new Error('Nicht eingeloggt')
    return auth.token
  }

  async function fetchMeWithToken(
    accessToken: string,
    _idToken?: string,
  ): Promise<{ person: Person; roles: Role[] }> {
    const response = await fetch(`${HITOBITO_URL}/oauth/profile`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Scope': 'with_roles',
        Accept: 'application/json',
      },
    })
    if (!response.ok) throw new Error(`/oauth/profile: ${response.status}`)
    const data = await response.json() as Record<string, unknown>

    const person: Person = {
      id: data['id'] as number,
      href: '',
      first_name: ((data['name'] as string) ?? '').split(' ')[0] ?? '',
      last_name: ((data['name'] as string) ?? '').split(' ').slice(1).join(' '),
      email: data['email'] as string | undefined,
    }

    const rawRoles = (data['roles'] as Record<string, unknown>[] | undefined) ?? []
    const roles: Role[] = rawRoles.map((r) => ({
      id: String(r['id'] ?? ''),
      type: (r['role_class_name'] ?? r['type'] ?? '') as string,
      group_id: r['group_id'] as number,
      label: (r['label'] ?? r['role_name']) as string | undefined,
      permissions: (r['permissions'] as string[] | undefined) ?? [],
    }))

    return { person, roles }
  }

  async function fetchGroupsWithToken(t: string, _personId: number, groupIds?: number[], signal?: AbortSignal): Promise<Group[]> {
    const ids = [...new Set(groupIds ?? [])]
    if (ids.length === 0) return []
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          // Try with social_accounts; fall back to plain if server errors (hitobito bug)
          try {
            return parseGroup(
              await apiFetch<JsonApiResponse>(`/api/groups/${id}?include=social_accounts`, t, signal),
            )
          } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') throw e
            return parseGroup(await apiFetch<JsonApiResponse>(`/api/groups/${id}`, t, signal))
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e
          return null
        }
      }),
    )
    return results.filter((g): g is Group => g !== null)
  }

  async function fetchMe() {
    return fetchMeWithToken(token())
  }

  async function fetchGroups(personId: number, groupIds?: number[], signal?: AbortSignal) {
    return fetchGroupsWithToken(token(), personId, groupIds, signal).catch(handleError)
  }

  async function fetchGroupDetails(groupId: number): Promise<Group> {
    try {
      return parseGroup(
        await apiFetch<JsonApiResponse>(`/api/groups/${groupId}?include=social_accounts`, token()),
      )
    } catch (e) {
      if (e instanceof TokenExpiredError) handleError(e)
      return parseGroup(
        await apiFetch<JsonApiResponse>(`/api/groups/${groupId}`, token()).catch(handleError),
      )
    }
  }

  return { fetchMe, fetchGroups, fetchGroupDetails, fetchMeWithToken, fetchGroupsWithToken }
}
