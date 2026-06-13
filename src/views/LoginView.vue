<template>
  <div class="login-page">
    <div class="login-card">
      <div class="logo-placeholder">🏕️</div>
      <h1>hitobito → ntfy</h1>
      <p class="subtitle">Push-Benachrichtigungen für JUBLA-Gruppen</p>
      <button class="btn-login" :disabled="loading" @click="handleLogin">
        {{ loading ? 'Weiterleitung…' : 'Mit hitobito einloggen' }}
      </button>
      <p v-if="error" class="error">{{ error }}</p>
      <p class="hint">
        Einloggen mit deinem JUBLA-Konto auf
        <strong>{{ hitobitoHost }}</strong>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const { login } = useAuth()
const loading = ref(false)
const error = ref<string | null>(null)
const hitobitoHost = new URL(import.meta.env.VITE_HITOBITO_URL).hostname

async function handleLogin() {
  loading.value = true
  error.value = null
  try {
    await login()
  } catch (e) {
    loading.value = false
    error.value = e instanceof Error ? e.message : 'Login fehlgeschlagen'
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}
.login-card {
  background: white;
  border-radius: 12px;
  padding: 2.5rem 2rem;
  max-width: 380px;
  width: 90%;
  text-align: center;
  box-shadow: 0 2px 16px rgba(0,0,0,.1);
}
.logo-placeholder { font-size: 3rem; margin-bottom: 1rem; }
h1 { font-size: 1.5rem; margin-bottom: .4rem; }
.subtitle { color: #666; margin-bottom: 1.8rem; font-size: .95rem; }
.btn-login {
  width: 100%;
  padding: .8rem 1rem;
  background: #c8002c;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background .15s;
}
.btn-login:hover:not(:disabled) { background: #a00022; }
.btn-login:disabled { opacity: .6; cursor: not-allowed; }
.error { color: #c00; margin-top: .8rem; font-size: .9rem; }
.hint { margin-top: 1.2rem; color: #888; font-size: .8rem; }
</style>
