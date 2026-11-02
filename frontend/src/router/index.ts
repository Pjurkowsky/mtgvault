import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** Page frame. Defaults to the app layout with the top bar. */
    layout?: 'app' | 'auth' | 'bare'
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
    { path: '/cards', name: 'cards', component: () => import('@/pages/CollectionPage.vue'), meta: { requiresAuth: true } },
    { path: '/decks', name: 'decks', component: () => import('@/pages/DecksPage.vue'), meta: { requiresAuth: true } },
    { path: '/decks/:id(\\d+)', name: 'deck', component: () => import('@/pages/DeckPage.vue'), meta: { requiresAuth: true } },
    { path: '/locations/:id', name: 'location', component: () => import('@/pages/LocationPage.vue'), meta: { requiresAuth: true } },
    // /scan/fast is served cross-origin isolated for multi-threaded recognition (spec 003, AC-16).
    { path: '/scan', name: 'scan', component: () => import('@/pages/ScanPage.vue'), meta: { requiresAuth: true, layout: 'bare' } },
    { path: '/scan/fast', name: 'scan-fast', component: () => import('@/pages/ScanPage.vue'), meta: { requiresAuth: true, layout: 'bare' } },
    { path: '/users', name: 'directory', component: () => import('@/pages/DirectoryPage.vue') },
    { path: '/u/:username/locations/:id', name: 'public-location', component: () => import('@/pages/PublicLocationPage.vue') },
    { path: '/u/:username/decks/:id(\\d+)', name: 'public-deck', component: () => import('@/pages/DeckPage.vue') },
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
