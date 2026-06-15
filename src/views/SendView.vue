<template>
  <div class="page">
    <RouterLink to="/dashboard" class="back">← Zurück</RouterLink>

    <div v-if="!group" class="status">Lade Gruppe…</div>
    <div v-else-if="!topic && hasNtfyAccount" class="empty-card">
      <div class="empty-icon">⚠️</div>
      <h2>Ungültiger Kanal-Eintrag</h2>
      <p>Der Eintrag für <strong>{{ group.name }}</strong> ist nicht gültig. Bitte neu generieren.</p>
      <RouterLink to="/dashboard" class="btn btn-setup">Neu generieren</RouterLink>
    </div>
    <div v-else-if="!topic" class="empty-card">
      <div class="empty-icon">📭</div>
      <h2>Kein Kanal eingerichtet</h2>
      <p>Für <strong>{{ group.name }}</strong> wurde noch kein ntfy-Kanal konfiguriert.</p>
      <RouterLink to="/dashboard" class="btn btn-setup">Kanal einrichten</RouterLink>
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
          <input v-model="form.title" type="text" :maxlength="MAX_TITLE" placeholder="Wichtige Information" required />
          <span class="char-count" :class="{ warn: titleCharsLeft <= 10, over: titleCharsLeft < 0 }">
            {{ titleCharsLeft }} Zeichen übrig
          </span>
        </label>
        <label>
          Nachricht
          <textarea
            v-model="form.message"
            rows="4"
            placeholder="Nachrichtentext…"
            :maxlength="MAX_MESSAGE"
            required
          />
          <span class="char-count" :class="{ warn: charsLeft <= 50, over: charsLeft < 0 }">
            {{ charsLeft }} Zeichen übrig
          </span>
        </label>


        <p v-if="success" class="success">Nachricht erfolgreich gesendet!</p>
        <p v-if="sendError" class="error">{{ sendError }}</p>

        <button type="submit" class="btn-send" :disabled="sending || charsLeft < 0">
          {{ sending ? 'Sende…' : 'Senden' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const MAX_TITLE = 64
const MAX_MESSAGE = 512
import { useAuthStore } from '../stores/auth'
import { useHitobito } from '../composables/useHitobito'
import { useNtfy } from '../composables/useNtfy'
import { canSendInGroup } from '../composables/useCanSend'
import { parseJublaEntry } from '../composables/useGroupSetup'
import type { Group } from '../types/hitobito'

const props = defineProps<{ groupId: string }>()

const auth = useAuthStore()
const { fetchGroupDetails } = useHitobito()
const { sendNotification } = useNtfy()

const group = ref<Group | null>(null)

const jublaEntry = computed(() => {
  const account = group.value?.social_accounts?.find((a) => a.label.toLowerCase() === 'ntfy')
  return account ? parseJublaEntry(account.name) : null
})

const hasNtfyAccount = computed(() =>
  !!group.value?.social_accounts?.find((a) => a.label.toLowerCase() === 'ntfy'),
)

const topic = computed(() => jublaEntry.value?.topic ?? null)
const authorized = computed(() => canSendInGroup(auth.roles, Number(props.groupId)))

const form = ref({ title: '', message: '' })
const titleCharsLeft = computed(() => MAX_TITLE - form.value.title.length)
const charsLeft = computed(() => MAX_MESSAGE - form.value.message.length)
const sending = ref(false)
const success = ref(false)
const sendError = ref<string | null>(null)

async function send() {
  if (!jublaEntry.value) return
  sending.value = true
  success.value = false
  sendError.value = null
  try {
    await sendNotification(
      jublaEntry.value.topic,
      Number(props.groupId),
      jublaEntry.value.signingKey,
      jublaEntry.value.encKey,
      { title: form.value.title, message: form.value.message },
      group.value?.short_name ?? group.value?.name,
    )
    success.value = true
    form.value = { title: '', message: '' }
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
.char-count { font-size: .78rem; color: #999; text-align: right; margin-top: .15rem; }
.char-count.warn { color: #b85c00; }
.char-count.over { color: #c00; }
.success { color: #2a7d2a; font-size: .9rem; }
.error { color: #c00; font-size: .9rem; }
.status { text-align: center; padding: 3rem; color: #666; }
.empty-card {
  background: white;
  border-radius: 10px;
  padding: 2.5rem 1.5rem;
  box-shadow: 0 1px 6px rgba(0,0,0,.08);
  text-align: center;
}
.empty-icon { font-size: 2.5rem; margin-bottom: .8rem; }
.empty-card h2 { font-size: 1.2rem; margin-bottom: .5rem; color: #34363c; }
.empty-card p { font-size: .95rem; color: #666; margin-bottom: 1.4rem; }
.btn { display: inline-block; text-decoration: none; border-radius: 8px; padding: .65rem 1.3rem; font-size: .95rem; }
.btn-setup { background: #014cbc; color: white; }
.btn-setup:hover { background: #013888; }
</style>
