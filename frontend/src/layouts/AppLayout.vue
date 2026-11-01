<script setup lang="ts">
import { useRouter } from 'vue-router'
import { LogOutIcon, SettingsIcon, UserIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-svh">
    <header class="border-b">
      <div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <nav class="flex items-center gap-6">
          <RouterLink to="/" class="font-semibold">MTG Vault</RouterLink>
          <RouterLink :to="{ name: 'directory' }" class="text-sm text-muted-foreground hover:text-foreground" active-class="text-foreground">Users</RouterLink>
        </nav>

        <DropdownMenu v-if="auth.user">
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" data-testid="user-menu">{{ auth.user.username }}</Button>
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

    <main class="mx-auto max-w-5xl px-4 py-8">
      <slot />
    </main>
  </div>
</template>
