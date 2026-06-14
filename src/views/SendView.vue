<template>
  <div class="page">
    <RouterLink to="/dashboard" class="back">← Zurück</RouterLink>

    <div v-if="!group" class="status">Lade Gruppe…</div>
    <div v-else-if="!topic" class="error">
      Diese Gruppe hat kein ntfy-Thema gesetzt.<br />
      Trage es in hitobito ein: Gruppe → Soziale Medien → Label <code>ntfy</code>
    </div>
    <div v-else-if="!authorized" class="error">
      Keine Berechtigung zum Senden für diese Gruppe.
    </div>

    <div v-else class="send-card">
      <h1>Nachricht senden</h1>
      <p class="group-name">{{ group.name }}</p>
      <p class="topic-info">Thema: <code>{{ topic }}</code></p>

      <form @submit.prevent="send">
        <label>
          Titel
          <input v-model="form.title" type="text" placeholder="Wichtige Information" required />
        </label>
        <label>
          Nachricht
          <textarea v-model="form.message" rows="4" placeholder="Nachrichtentext…" required />
        </label>
        <label>
          Priorität
          <select v-model="form.priority">
            <option :value="1">1 – Min</option>
            <option :value="2">2 – Tief</option>
            <option :value="3">3 – Normal</option>
            <option :value="4">4 – Hoch</option>
            <option :value="5">5 – Max</option>
          </select>
        </label>

        <p v-if="success" class="success">Nachricht erfolgreich gesendet!</p>
        <p v-if="sendError" class="error">{{ sendError }}</p>

        <button type="submit" class="btn-send" :disabled="sending">
          {{ sending ? 'Sende…' : 'Senden' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useHitobito } from '../composables/useHitobito'
import { useNtfy } from '../composables/useNtfy'
import { canSendInGroup } from '../composables/useCanSend'
import type { Group } from '../types/hitobito'

const props = defineProps<{ groupId: string }>()

const auth = useAuthStore()
const { fetchGroupDetails } = useHitobito()
const { sendNotification } = useNtfy()

const group = ref<Group | null>(null)

const topic = computed(() => {
  const account = group.value?.social_accounts?.find(
    (a) => a.label.toLowerCase() === 'ntfy',
  )
  return account?.name ?? null
})

const authorized = computed(() => canSendInGroup(auth.roles, Number(props.groupId)))

const form = ref({ title: '', message: '', priority: 3 as 1 | 2 | 3 | 4 | 5 })
const sending = ref(false)
const success = ref(false)
const sendError = ref<string | null>(null)

async function send() {
  if (!topic.value) return
  sending.value = true
  success.value = false
  sendError.value = null
  try {
    await sendNotification(topic.value, {
      title: form.value.title,
      message: form.value.message,
      priority: form.value.priority,
    })
    success.value = true
    form.value = { title: '', message: '', priority: 3 }
  } catch (e) {
    sendError.value = e instanceof Error ? e.message : 'Senden fehlgeschlagen'
  } finally {
    sending.value = false
  }
}

onMounted(async () => {
  const cached = auth.groups.find((g) => g.id === Number(props.groupId))
  if (cached) {
    group.value = cached
    return
  }
  try {
    group.value = await fetchGroupDetails(Number(props.groupId))
  } catch {
    // Gruppe konnte nicht geladen werden
  }
})
</script>

<style scoped>
.page { max-width: 500px; margin: 0 auto; padding: 1.5rem 1rem; }
.back { display: inline-block; margin-bottom: 1.2rem; color: #555; text-decoration: none; font-size: .9rem; }
.back:hover { color: #000; }
.send-card { background: white; border-radius: 10px; padding: 1.5rem; box-shadow: 0 1px 6px rgba(0,0,0,.08); }
h1 { font-size: 1.3rem; margin-bottom: .2rem; }
.group-name { color: #555; margin-bottom: .3rem; }
.topic-info { font-size: .85rem; color: #888; margin-bottom: 1.2rem; }
code { background: #f0f0f0; padding: .1em .4em; border-radius: 4px; }
form { display: flex; flex-direction: column; gap: .9rem; }
label { display: flex; flex-direction: column; gap: .3rem; font-size: .9rem; font-weight: 500; }
input, textarea, select {
  padding: .6rem .7rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: .95rem;
  font-family: inherit;
}
input:focus, textarea:focus, select:focus { outline: none; border-color: #014cbc; }
.btn-send {
  padding: .7rem 1rem;
  background: #a1090f;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  margin-top: .3rem;
}
.btn-send:hover:not(:disabled) { background: #7d070b; }
.btn-send:disabled { opacity: .6; cursor: not-allowed; }
.success { color: #2a7d2a; font-size: .9rem; }
.error { color: #c00; font-size: .9rem; }
.status { text-align: center; padding: 3rem; color: #666; }
</style>
