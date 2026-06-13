import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Person, Role, Group } from '../types/hitobito'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const person = ref<Person | null>(null)
  const roles = ref<Role[]>([])
  const groups = ref<Group[]>([])

  const isLoggedIn = computed(() => token.value !== null)

  function setAuth(t: string, p: Person, r: Role[]) {
    token.value = t
    person.value = p
    roles.value = r
  }

  function setGroups(g: Group[]) {
    groups.value = g
  }

  function clear() {
    token.value = null
    person.value = null
    roles.value = []
    groups.value = []
  }

  return { token, person, roles, groups, isLoggedIn, setAuth, setGroups, clear }
})
