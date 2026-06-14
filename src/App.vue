<template>
  <div v-if="loading" class="loading">Lade…</div>
  <div v-else-if="error" class="error">{{ error }}</div>
  <RouterView v-else />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from './composables/useAuth'
import { useHitobito } from './composables/useHitobito'
import { useAuthStore } from './stores/auth'

const router = useRouter()
const auth = useAuthStore()
const { exchangeCode } = useAuth()
const hitobito = useHitobito()

const loading = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return

  // OAuth callback: hitobito hat uns mit ?code= zurückgeleitet
  loading.value = true
  history.replaceState({}, '', window.location.pathname)

  try {
    const tokenResponse = await exchangeCode(code)
    const accessToken = tokenResponse['access_token'] as string
    const { person, roles } = await hitobito.fetchMeWithToken(accessToken)
    const groupIds = [...new Set(roles.map((r) => r.group_id).filter(Boolean))]
    const groups = await hitobito.fetchGroupsWithToken(accessToken, person.id, groupIds)
    // Preserve social_accounts from previous cache for any group the API returned without them
    let merged = groups
    try {
      const raw = localStorage.getItem(`jubla_groups_${person.id}`)
      const prev: { id: number; social_accounts?: unknown[] }[] = raw ? JSON.parse(raw).groups ?? [] : []
      merged = groups.map((g) => {
        if (!(g.social_accounts?.length)) {
          const old = prev.find((p) => p.id === g.id)
          if (old?.social_accounts?.length) return { ...g, social_accounts: old.social_accounts as typeof g.social_accounts }
        }
        return g
      })
    } catch {}
    auth.setAuth(accessToken, person, roles)
    auth.setGroups(merged)
    // Cache groups immediately so DashboardView skips the background refresh
    try {
      localStorage.setItem(
        `jubla_groups_${person.id}`,
        JSON.stringify({ groups: merged, refreshedAt: Date.now() }),
      )
    } catch {}
    router.push('/dashboard')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unbekannter Fehler beim Login'
  } finally {
    loading.value = false
  }
})
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #333; }
.loading, .error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-size: 1.2rem;
}
.error { color: #c00; }
</style>
