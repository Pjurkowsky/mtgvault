<script setup lang="ts">
import 'vue-sonner/style.css'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import FullscreenCard from '@/components/FullscreenCard.vue'
import { Toaster } from '@/components/ui/sonner'
import { isDark } from '@/lib/theme'
import { TooltipProvider } from '@/components/ui/tooltip'
import AppLayout from '@/layouts/AppLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BareLayout from '@/layouts/BareLayout.vue'

const route = useRoute()
const layout = computed(() => ({ auth: AuthLayout, bare: BareLayout, app: AppLayout })[route.meta.layout ?? 'app'])
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <component :is="layout" v-if="route.matched.length">
      <RouterView />
    </component>
    <ConfirmDialog />
    <FullscreenCard />
  </TooltipProvider>
  <!-- Green success, red errors (AC-4). -->
  <Toaster position="top-center" rich-colors :theme="isDark ? 'dark' : 'light'" />
</template>
