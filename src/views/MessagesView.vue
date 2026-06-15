<template>
  <div class="page">
    <RouterLink to="/dashboard" class="back">← Zurück</RouterLink>

    <div v-if="!group" class="status">Lade…</div>
    <div v-else-if="!topic && hasNtfyAccount" class="error">Ungültiger Kanal-Eintrag — bitte im Dashboard neu generieren.</div>
    <div v-else-if="!topic" class="error">Kein ntfy-Thema für diese Gruppe gesetzt.</div>

    <template v-else>
      <header>
        <div>
          <h1>{{ group.name }}</h1>
          <p class="topic-label">Thema: <code>{{ topic }}</code></p>
        </div>
        <div class="header-actions">
          <RouterLink v-if="canSend" :to="`/send/${group.id}`" class="btn btn-send">
            Senden
          </RouterLink>
        </div>
      </header>

      <div class="cache-info">
        <button class="cache-toggle" @click="infoOpen = !infoOpen" :aria-expanded="infoOpen">
          <span class="info-icon">ℹ</span>
          Wie funktioniert der Nachrichtenverlauf?
          <span class="chevron" :class="{ open: infoOpen }">›</span>
        </button>
        <div v-if="infoOpen" class="cache-details">
          <p>Neue Mitteilungen werden als <strong>Push-Benachrichtigung</strong> über die <strong>ntfy-App</strong> zugestellt. Beim Tippen auf die Benachrichtigung öffnet sich diese App mit der entschlüsselten Mitteilung.</p>
          <p>Damit das funktioniert, muss der Kanal dieser Gruppe in der ntfy-App abonniert sein:</p>
          <div class="subscribe-row">
            <button class="btn-sub btn-sub-app" @click="openInNtfyApp">In ntfy-App öffnen</button>
            <a class="btn-sub btn-sub-web" :href="safeSubscribeUrl" target="_blank" rel="noopener">Im Browser öffnen</a>
          </div>
          <p class="muted-small">Der Server speichert Mitteilungen nur <strong>ca. 12 Stunden</strong>. Einmal geladene Mitteilungen bleiben <strong>lokal auf diesem Gerät</strong> erhalten — solange die App regelmässig geöffnet wird.</p>
          <p v-if="oldestMessage">Älteste gespeicherte Mitteilung: <strong>{{ formatTime(oldestMessage.time) }}</strong></p>
          <p v-else class="muted">Noch keine Mitteilungen lokal gespeichert.</p>
        </div>
      </div>

      <div class="messages">
        <article v-if="urlMessage" class="msg-card msg-card-url">
          <div class="msg-header">
            <span class="msg-title">{{ urlMessage.title }}</span>
          </div>
          <p class="msg-body">{{ urlMessage.text }}</p>
        </article>

        <div v-if="loading && messages.length === 0" class="status">Lade Nachrichten…</div>
        <div v-else-if="error && messages.length === 0" class="error">{{ error }}</div>
        <div v-else-if="visibleMessages.length === 0" class="empty">Noch keine Mitteilungen.</div>

        <div v-if="loading && visibleMessages.length > 0" class="refreshing">Aktualisiere…</div>

        <article v-for="msg in visibleMessages" :key="msg.id" class="msg-card" :data-priority="msg.priority ?? 3">
          <div class="msg-header">
            <span class="msg-title">{{ msg.title || 'Mitteilung' }}</span>
            <span class="msg-time">{{ formatTime(msg.time) }}</span>
          </div>
          <p class="msg-body">{{ decryptedBodies.get(msg.id) }}</p>
          <div v-if="msg.tags?.length" class="msg-tags">
            <span v-for="tag in msg.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useHitobito } from '../composables/useHitobito'
import type { Group } from '../types/hitobito'
import { fetchMessages, loadCachedMessages, NTFY_BASE, type NtfyMessage } from '../composables/useNtfyMessages'
import { canSendInGroup } from '../composables/useCanSend'
import { verifyAndDecrypt, unwrapMessage, isJublaMessage, computeMessageTag, decryptFromUrl } from '../composables/useEncryption'
import { parseJublaEntry } from '../composables/useGroupSetup'

const props = defineProps<{ groupId: string }>()
const route = useRoute()
const auth = useAuthStore()
const { fetchGroupDetails } = useHitobito()

const group = ref<Group | null>(null)
const urlMessage = ref<{ title: string; text: string } | null>(null)
const messages = ref<NtfyMessage[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const infoOpen = ref(false)
const decryptedBodies = ref<Map<string, string>>(new Map())
const visibleMessages = computed(() =>
  messages.value.filter((m) => decryptedBodies.value.has(m.id)),
)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const oldestMessage = computed(() =>
  messages.value.length > 0 ? messages.value[messages.value.length - 1] : null,
)

const jublaEntry = computed(() => {
  const account = group.value?.social_accounts?.find((a) => a.label.toLowerCase() === 'ntfy')
  return account ? parseJublaEntry(account.name) : null
})

const hasNtfyAccount = computed(() =>
  !!group.value?.social_accounts?.find((a) => a.label.toLowerCase() === 'ntfy'),
)

const topic = computed(() => jublaEntry.value?.topic ?? null)

const canSend = computed(() => canSendInGroup(auth.roles, Number(props.groupId)))

const safeSubscribeUrl = computed(() => {
  if (!topic.value) return undefined
  return new URL(`/${topic.value}`, NTFY_BASE).href
})

function openInNtfyApp() {
  const ntfyBase = new URL(NTFY_BASE).host
  window.location.href = `ntfy://${ntfyBase}/${topic.value}`
  setTimeout(() => window.open(safeSubscribeUrl.value, '_blank', 'noopener,noreferrer'), 600)
}

function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

async function hasValidTag(tags: string[] | undefined, encKey: Uint8Array, ntfyTime: number): Promise<boolean> {
  const macTag = tags?.find((t) => t.startsWith('jm'))
  if (!macTag) return true  // ältere Nachrichten ohne Tag werden akzeptiert
  const received = macTag.slice(2)
  const w = Math.floor(ntfyTime / 300)
  for (const offset of [-1, 0, 1]) {
    if ((await computeMessageTag(encKey, w + offset)) === received) return true
  }
  return false
}

async function decryptAll(msgs: NtfyMessage[]) {
  const keys = jublaEntry.value
  if (!keys) return
  const map = new Map(decryptedBodies.value)
  for (const m of msgs) {
    if (map.has(m.id)) continue
    if (!await hasValidTag(m.tags, keys.encKey, m.time)) continue
    if (!isJublaMessage(m.message)) continue
    try {
      const wrapped = await unwrapMessage(m.message)
      if (!wrapped) continue
      map.set(m.id, await verifyAndDecrypt(wrapped.payload, keys.signingKey, keys.encKey))
    } catch {
      // ungültige Signatur oder Entschlüsselungsfehler → nicht anzeigen
    }
  }
  decryptedBodies.value = map
}

async function loadMessages() {
  if (!topic.value) return
  try {
    const msgs = await fetchMessages(topic.value)
    messages.value = msgs
    error.value = null
    await decryptAll(msgs)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Fehler beim Laden'
  }
}

onMounted(async () => {
  group.value = auth.groups.find((g) => g.id === Number(props.groupId)) ?? null
  if (!group.value) {
    try {
      group.value = await fetchGroupDetails(Number(props.groupId))
    } catch {
      // Gruppe konnte nicht geladen werden
    }
  }

  // Mitteilung aus Click-URL entschlüsseln (lesbar auch nach ntfy-TTL)
  const urlPayload = route.query.m as string | undefined
  if (urlPayload && jublaEntry.value) {
    try {
      const text = await decryptFromUrl(urlPayload, jublaEntry.value.signingKey, jublaEntry.value.encKey)
      const title = decodeURIComponent((route.query.t as string | undefined) ?? '')
      urlMessage.value = { title: title || 'Mitteilung', text }
    } catch {
      // Ungültiger oder manipulierter URL-Payload → ignorieren
    }
  }

  if (topic.value) {
    messages.value = loadCachedMessages(topic.value)
  }
  loading.value = true
  await loadMessages()
  loading.value = false

  // Duplikat ausblenden falls die Mitteilung noch bei ntfy verfügbar ist
  if (urlMessage.value) {
    const txt = urlMessage.value.text
    if ([...decryptedBodies.value.values()].some((v) => v === txt)) urlMessage.value = null
  }

  refreshTimer = setInterval(loadMessages, 30_000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.page { max-width: 620px; margin: 0 auto; padding: 1.5rem 1rem; }
.back { display: inline-block; margin-bottom: 1rem; color: #555; text-decoration: none; font-size: .9rem; }
.back:hover { color: #000; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.2rem; flex-wrap: wrap; }
h1 { font-size: 1.3rem; }
.topic-label { font-size: .8rem; color: #888; margin-top: .2rem; }
code { background: #f0f0f0; padding: .1em .35em; border-radius: 4px; }
.header-actions { display: flex; gap: .5rem; flex-shrink: 0; }
.btn { padding: .45rem .9rem; border-radius: 6px; font-size: .85rem; text-decoration: none; border: none; cursor: pointer; }
.btn-send { background: #a1090f; color: white; }
.btn-send:hover { background: #7d070b; }
.cache-info { margin-bottom: 1rem; border: 1px solid #dde3f0; border-radius: 8px; overflow: hidden; }
.cache-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: .4rem;
  padding: .6rem .8rem;
  background: #eef2fb;
  border: none;
  cursor: pointer;
  font-size: .82rem;
  color: #014cbc;
  text-align: left;
}
.cache-toggle:hover { background: #dde6f7; }
.info-icon { font-style: normal; font-weight: 700; width: 1rem; text-align: center; }
.chevron { margin-left: auto; font-size: 1rem; transition: transform .2s; display: inline-block; }
.chevron.open { transform: rotate(90deg); }
.cache-details {
  padding: .7rem .9rem;
  background: white;
  display: flex;
  flex-direction: column;
  gap: .4rem;
  font-size: .82rem;
  color: #444;
  border-top: 1px solid #dde3f0;
}
.cache-details p { margin: 0; }
.subscribe-row { display: flex; gap: .5rem; flex-wrap: wrap; margin: .2rem 0; }
.btn-sub {
  padding: .35rem .8rem;
  border-radius: 6px;
  font-size: .8rem;
  text-decoration: none;
  border: none;
  cursor: pointer;
  display: inline-block;
}
.btn-sub-app { background: #014cbc; color: white; }
.btn-sub-app:hover { background: #013888; }
.btn-sub-web { background: #eee; color: #333; }
.btn-sub-web:hover { background: #ddd; }
.muted { color: #999; }
.muted-small { color: #888; font-size: .79rem; }
.refreshing { font-size: .78rem; color: #888; text-align: right; margin-bottom: .4rem; }
.messages { display: flex; flex-direction: column; gap: .8rem; }
.msg-card {
  background: white;
  border-radius: 10px;
  padding: 1rem 1.1rem;
  box-shadow: 0 1px 5px rgba(0,0,0,.07);
  border-left: 4px solid #ccc;
}
.msg-card[data-priority="4"] { border-left-color: #f0a500; }
.msg-card[data-priority="5"] { border-left-color: #a1090f; }
.msg-card[data-priority="1"], .msg-card[data-priority="2"] { border-left-color: #aaa; }
.msg-header { display: flex; justify-content: space-between; align-items: baseline; gap: .5rem; margin-bottom: .4rem; }
.msg-title { font-weight: 600; font-size: .95rem; }
.msg-time { font-size: .75rem; color: #999; white-space: nowrap; }
.msg-body { font-size: .9rem; color: #444; white-space: pre-wrap; }
.msg-tags { display: flex; gap: .3rem; margin-top: .4rem; flex-wrap: wrap; }
.tag { background: #f0f0f0; border-radius: 4px; padding: .1em .5em; font-size: .75rem; color: #666; }
.msg-card-url { border-left-color: #014cbc; }
.status, .empty { text-align: center; padding: 2rem; color: #888; }
.error { color: #c00; }
.error.small { font-size: .85rem; margin-bottom: .5rem; }
</style>
