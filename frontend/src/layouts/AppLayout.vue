<script setup lang="ts">
import { useRouter } from 'vue-router'
import { LogOutIcon, SettingsIcon, ShieldIcon, UserIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useForge } from '@/lib/sims'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
// Simulations: logged-in users, when the server has Forge (spec 025, AC-1).
const forge = useForge()

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-svh">
    <header class="border-b">
      <div class="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
        <nav class="flex min-w-0 items-center gap-4 whitespace-nowrap sm:gap-6">
          <RouterLink to="/" class="font-semibold whitespace-nowrap">MTG Vault</RouterLink>
          <RouterLink v-if="auth.user" :to="{ name: 'decks' }" class="text-sm text-muted-foreground hover:text-foreground" active-class="text-foreground">Decks</RouterLink>
          <RouterLink :to="{ name: 'directory' }" class="text-sm text-muted-foreground hover:text-foreground" active-class="text-foreground">Users</RouterLink>
          <RouterLink v-if="auth.user && forge" :to="{ name: 'simulations' }" class="text-sm text-muted-foreground hover:text-foreground" active-class="text-foreground">Simulations</RouterLink>
        </nav>

        <DropdownMenu v-if="auth.user">
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="shrink-0" :aria-label="auth.user.username" data-testid="user-menu">
              <UserIcon class="sm:hidden" /><span class="sr-only sm:not-sr-only">{{ auth.user.username }}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem as-child>
              <RouterLink :to="{ name: 'profile', params: { username: auth.user.username } }">
                <UserIcon /> Profile
              </RouterLink>
            </DropdownMenuItem>
            <DropdownMenuItem as-child>
              <RouterLink :to="{ name: 'settings' }"><SettingsIcon /> Settings</RouterLink>
            </DropdownMenuItem>
            <DropdownMenuItem v-if="auth.user.is_staff" as-child>
              <a href="/admin/"><ShieldIcon /> Admin</a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="logout"><LogOutIcon /> Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div v-else class="flex gap-2">
          <Button variant="ghost" as-child><RouterLink :to="{ name: 'login' }">Log in</RouterLink></Button>
          <Button as-child><RouterLink :to="{ name: 'signup' }">Sign up</RouterLink></Button>
        </div>
      </div>
    </header>

    <main class="px-4 py-8 sm:px-6">
      <slot />
    </main>
  </div>
</template>
