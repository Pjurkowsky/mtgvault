import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** Page frame. Defaults to the app layout with the top bar. */
    layout?: 'app' | 'auth'
    requiresAuth?: boolean
    guestOnly?: boolean
  }
}

/** Only follow `next` when it points inside this app (no open redirects). */
export function safeNext(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { layout: 'auth', guestOnly: true } },
    { path: '/signup', name: 'signup', component: () => import('@/pages/SignupPage.vue'), meta: { layout: 'auth', guestOnly: true } },
    { path: '/', name: 'collection', component: () => import('@/pages/CollectionPage.vue'), meta: { requiresAuth: true } },
    { path: '/settings', name: 'settings', component: () => import('@/pages/SettingsPage.vue'), meta: { requiresAuth: true } },
    { path: '/u/:username', name: 'profile', component: () => import('@/pages/ProfilePage.vue') },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: { next: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.isLoggedIn) {
    return safeNext(to.query.next) ?? { name: 'collection' }
  }
})
