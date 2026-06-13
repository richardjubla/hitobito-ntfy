import { useAuthStore } from '../stores/auth'
import type { Person, Role, Group, SocialAccount } from '../types/hitobito'

const HITOBITO_URL = import.meta.env.VITE_HITOBITO_URL as string

// JSON:API format (new hitobito API at /api/)
interface JsonApiResource {
  id: string
  type: string
  attributes: Record<string, unknown>
  relationships?: Record<string, { data?: { id: string; type: string }[] | { id: string; type: string } | null }>
}

interface JsonApiResponse {
  data: JsonApiResource | JsonApiResource[]
  included?: JsonApiResource[]
  meta?: Record<string, unknown>
}

async function apiFetch<T>(path: string, token: string, accept = 'application/vnd.api+json'): Promise<T> {
  const response = await fetch(`${HITOBITO_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      'Content-Type': 'application/vnd.api+json',
    },
  })
  if (!response.ok) throw new Error(`hitobito ${response.status}: ${path}`)
  return response.json() as Promise<T>
}

function extractIncluded(included: JsonApiResource[], type: string, ids: string[]): JsonApiResource[] {
  return included.filter((r) => r.type === type && ids.includes(r.id))
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
    // /oauth/profile mit X-Scope Header gibt Person-ID und Rollen zurück
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
    }))

    return { person, roles }
  }

  async function fetchGroupsWithToken(t: string, personId: number): Promise<Group[]> {
    // Neue JSON:API unter /api/ — social_accounts includieren
    const url = `/api/groups?filter[person_id]=${personId}&include=social_accounts`
    const data = await apiFetch<JsonApiResponse>(url, t)

    const resources = Array.isArray(data.data) ? data.data : [data.data]
    const included = data.included ?? []

    return resources.map((r) => {
      const saRel = r.relationships?.['social_accounts']?.data
      const saIds = Array.isArray(saRel) ? saRel.map((x) => x.id) : []
      const saResources = extractIncluded(included, 'social_accounts', saIds)

      const socialAccounts: SocialAccount[] = saResources.map((sa) => ({
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
        group_type: r.attributes['group_type'] as string ?? r.type,
        layer: r.attributes['layer'] as boolean ?? false,
        social_accounts: socialAccounts,
      }
    })
  }

  async function fetchMe() {
    return fetchMeWithToken(token())
  }

  async function fetchGroups(personId: number) {
    return fetchGroupsWithToken(token(), personId)
  }

  async function fetchGroupDetails(groupId: number): Promise<Group> {
    const data = await apiFetch<JsonApiResponse>(
      `/api/groups/${groupId}?include=social_accounts`,
      token(),
    )
    const r = Array.isArray(data.data) ? data.data[0] : data.data
    const included = data.included ?? []
    const saRel = r.relationships?.['social_accounts']?.data
    const saIds = Array.isArray(saRel) ? saRel.map((x) => x.id) : []
    const socialAccounts: SocialAccount[] = extractIncluded(included, 'social_accounts', saIds).map((sa) => ({
      id: sa.id,
      label: sa.attributes['label'] as string,
      name: sa.attributes['name'] as string,
      public: sa.attributes['public'] as boolean,
    }))

    return {
      id: Number(r.id),
      href: '',
      name: r.attributes['name'] as string,
      group_type: r.attributes['group_type'] as string ?? r.type,
      layer: r.attributes['layer'] as boolean ?? false,
      social_accounts: socialAccounts,
    }
  }

  return { fetchMe, fetchGroups, fetchGroupDetails, fetchMeWithToken, fetchGroupsWithToken }
}
