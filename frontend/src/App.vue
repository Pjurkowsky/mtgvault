<script setup lang="ts">
import 'vue-sonner/style.css'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import AppLayout from '@/layouts/AppLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'

const route = useRoute()
const layout = computed(() => (route.meta.layout === 'auth' ? AuthLayout : AppLayout))
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <component :is="layout" v-if="route.matched.length">
      <RouterView />
    </component>
  </TooltipProvider>
  <Toaster position="top-center" />
</template>
