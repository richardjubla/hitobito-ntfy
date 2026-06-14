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
          <span v-if="canSend(group.id)">
            Kein ntfy-Kanal eingerichtet.
            <button class="btn-setup" @click="openSetup(group)">Kanal einrichten</button>
          </span>
          <span v-else>Kein ntfy-Kanal eingerichtet.</span>
        </div>
      </li>
    </ul>
  </div>

  <Teleport to="body">
    <div v-if="setupGroup" class="modal-backdrop" @click.self="closeSetup">
      <div class="modal" role="dialog" aria-modal="true">
        <h2>Kanal einrichten</h2>
        <p>Ein eindeutiges ntfy-Thema wird generiert und für <strong>{{ setupGroup.name }}</strong> in hitobito gespeichert.</p>
        <p class="modal-note">Nur Mitglieder mit hitobito-Zugang können den Kanal lesen. Das Thema kann später vom Vorstand zurückgesetzt werden.</p>
        <div v-if="setupError" class="setup-error">
          <p class="error">{{ setupError }}</p>
          <p class="manual-hint">
            Alternativ manuell in hitobito eintragen:<br />
            Gruppe → Info → Soziale Medien → Bezeichnung <code>ntfy</code>, Wert = beliebiger Thema-Name
          </p>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="closeSetup" :disabled="setupLoading">Abbrechen</button>
          <button class="btn-confirm" @click="confirmSetup" :disabled="setupLoading">
            {{ setupLoading ? 'Wird eingerichtet…' : 'Einrichten' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { canSendInGroup } from '../composables/useCanSend'
import { generateTopic, createSocialAccount } from '../composables/useGroupSetup'
import type { Group } from '../types/hitobito'

const auth = useAuthStore()
const router = useRouter()

const loading = ref(false)
const error = ref<string | null>(null)
const groups = ref<Group[]>([])
const setupGroup = ref<Group | null>(null)
const setupLoading = ref(false)
const setupError = ref<string | null>(null)

function ntfyTopic(group: Group): string | null {
  const account = group.social_accounts?.find((a) => a.label.toLowerCase() === 'ntfy')
  return account?.name ?? null
}

function canSend(groupId: number): boolean {
  return canSendInGroup(auth.roles, groupId)
}

function openSetup(group: Group) {
  setupGroup.value = group
  setupError.value = null
}

function closeSetup() {
  if (setupLoading.value) return
  setupGroup.value = null
  setupError.value = null
}

async function confirmSetup() {
  if (!setupGroup.value || !auth.token) return
  setupLoading.value = true
  setupError.value = null
  try {
    const topic = await generateTopic(setupGroup.value.id)
    const sa = await createSocialAccount(setupGroup.value.id, topic, auth.token)
    auth.setGroups(
      auth.groups.map((g) =>
        g.id === setupGroup.value!.id
          ? { ...g, social_accounts: [...(g.social_accounts ?? []), sa] }
          : g,
      ),
    )
    setupGroup.value = null
  } catch (e) {
    setupError.value = e instanceof Error ? e.message : 'Fehler beim Einrichten'
  } finally {
    setupLoading.value = false
  }
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
.no-topic { margin-top: .8rem; font-size: .9rem; color: #888; display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; }
.btn-setup {
  padding: .35rem .8rem;
  background: #014cbc;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: .85rem;
  cursor: pointer;
}
.btn-setup:hover { background: #013888; }
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal {
  background: white;
  border-radius: 12px;
  padding: 1.8rem 1.6rem;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 4px 24px rgba(0,0,0,.18);
}
.modal h2 { font-size: 1.1rem; margin-bottom: .8rem; color: #34363c; }
.modal p { font-size: .9rem; color: #444; margin-bottom: .6rem; }
.modal-note { font-size: .82rem; color: #888; }
.modal-actions { display: flex; gap: .6rem; justify-content: flex-end; margin-top: 1.2rem; }
.btn-cancel { padding: .5rem 1rem; background: #eee; border: none; border-radius: 6px; cursor: pointer; font-size: .9rem; }
.btn-cancel:hover:not(:disabled) { background: #ddd; }
.btn-confirm { padding: .5rem 1rem; background: #014cbc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: .9rem; }
.btn-confirm:hover:not(:disabled) { background: #013888; }
.btn-confirm:disabled, .btn-cancel:disabled { opacity: .6; cursor: not-allowed; }
.setup-error { margin-top: .6rem; }
.manual-hint { margin-top: .4rem; font-size: .82rem; color: #666; background: #f5f5f5; padding: .5rem .7rem; border-radius: 6px; }
.status { text-align: center; padding: 3rem; color: #666; }
.error { color: #c00; padding: 1rem; }
</style>
