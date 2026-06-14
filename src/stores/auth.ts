import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Person, Role, Group } from '../types/hitobito'

const SESSION_KEY = 'jubla_session'

interface SavedSession {
  token: string
  person: Person
  roles: Role[]
}

function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as SavedSession) : null
  } catch {
    return null
  }
}

function saveSession(t: string, p: Person, r: Role[]) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: t, person: p, roles: r }))
  } catch {}
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY) } catch {}
}

export const useAuthStore = defineStore('auth', () => {
  const saved = loadSession()

  const token = ref<string | null>(saved?.token ?? null)
  const person = ref<Person | null>(saved?.person ?? null)
  const roles = ref<Role[]>(saved?.roles ?? [])
  const groups = ref<Group[]>([])

  const isLoggedIn = computed(() => token.value !== null)

  function setAuth(t: string, p: Person, r: Role[]) {
    token.value = t
    person.value = p
    roles.value = r
    saveSession(t, p, r)
  }

  function setGroups(g: Group[]) {
    groups.value = g
  }

  function clear() {
    token.value = null
    person.value = null
    roles.value = []
    groups.value = []
    clearSession()
  }

  return { token, person, roles, groups, isLoggedIn, setAuth, setGroups, clear }
})
