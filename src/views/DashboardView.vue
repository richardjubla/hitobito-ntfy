<template>
  <div class="page">
    <header>
      <img src="/logo_jubla.png" alt="JUBLA" class="logo" />
      <h1>Meine Gruppen</h1>
      <button class="btn-logout" @click="logout">Abmelden</button>
    </header>

    <div v-if="loading" class="status">Lade Gruppen…</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="groups.length === 0" class="status">Keine Gruppen gefunden.</div>

    <ul v-else class="groups">
      <li v-for="group in groups" :key="group.id" class="group-card">
        <div class="group-header">
          <span class="group-type">{{ group.group_type }}</span>
          <h2>{{ group.name }}</h2>
        </div>

        <div v-if="ntfyTopic(group)" class="ntfy-section">
          <div class="actions">
            <RouterLink :to="`/messages/${group.id}`" class="btn btn-messages">
              Mitteilungen
            </RouterLink>
            <RouterLink
              v-if="canSend(group.id)"
              :to="`/send/${group.id}`"
              class="btn btn-send"
            >
              Senden
            </RouterLink>
          </div>
        </div>
        <div v-else class="no-topic">
          Kein ntfy-Thema gesetzt.
          <span v-if="canSend(group.id)">
            Trage es in hitobito ein: Gruppe → Soziale Medien → Bezeichnung <code>ntfy</code>, Wert = Thema-Name
          </span>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { canSendInGroup } from '../composables/useCanSend'
import type { Group } from '../types/hitobito'

const auth = useAuthStore()
const router = useRouter()

const loading = ref(false)
const error = ref<string | null>(null)
const groups = ref<Group[]>([])

function ntfyTopic(group: Group): string | null {
  const account = group.social_accounts?.find((a) => a.label.toLowerCase() === 'ntfy')
  return account?.name ?? null
}

function canSend(groupId: number): boolean {
  return canSendInGroup(auth.roles, groupId)
}

function logout() {
  auth.clear()
  router.push('/login')
}

onMounted(async () => {
  if (auth.groups.length > 0) {
    groups.value = auth.groups
    return
  }
  loading.value = true
  try {
    groups.value = auth.groups
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Fehler beim Laden'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page { max-width: 700px; margin: 0 auto; padding: 1.5rem 1rem; }
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}
.logo { height: 32px; }
h1 { font-size: 1.4rem; color: #34363c; }
.btn-logout {
  background: none;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: .4rem .8rem;
  cursor: pointer;
  font-size: .9rem;
  color: #34363c;
}
.btn-logout:hover { background: #f0f0f0; }
.groups { list-style: none; display: flex; flex-direction: column; gap: 1rem; }
.group-card {
  background: white;
  border-radius: 10px;
  padding: 1.2rem;
  box-shadow: 0 1px 6px rgba(0,0,0,.08);
}
.group-type { font-size: .75rem; color: #888; text-transform: uppercase; letter-spacing: .05em; }
h2 { font-size: 1.1rem; margin-top: .2rem; }
.ntfy-section { margin-top: .8rem; }
.topic-label { font-size: .9rem; color: #555; margin-bottom: .6rem; }
code { background: #f0f0f0; padding: .1em .4em; border-radius: 4px; font-size: .85em; }
.actions { display: flex; gap: .6rem; flex-wrap: wrap; }
.btn {
  padding: .5rem 1rem;
  border-radius: 6px;
  font-size: .9rem;
  text-decoration: none;
  border: none;
  cursor: pointer;
}
.btn-messages { background: #014cbc; color: white; }
.btn-messages:hover { background: #013888; }
.btn-send { background: #a1090f; color: white; }
.btn-send:hover { background: #7d070b; }
.no-topic { margin-top: .8rem; font-size: .9rem; color: #888; }
.status { text-align: center; padding: 3rem; color: #666; }
.error { color: #c00; padding: 1rem; }
</style>
