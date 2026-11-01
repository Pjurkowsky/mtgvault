import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { onAuthenticationLost } from './api/client'
import { router } from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// A request failed with 401 and the session couldn't be refreshed.
onAuthenticationLost(() => {
  useAuthStore().clear()
  const current = router.currentRoute.value
  if (current.meta.requiresAuth) router.push({ name: 'login', query: { next: current.fullPath } })
})

app.mount('#app')
