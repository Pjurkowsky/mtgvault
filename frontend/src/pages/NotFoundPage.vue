<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <div class="py-16 text-center">
    <h1 class="text-2xl font-semibold">Page not found</h1>
    <p class="mt-2 text-muted-foreground">This page doesn't exist.</p>
    <Button as-child variant="outline" class="mt-6"><RouterLink to="/">Go home</RouterLink></Button>
  </div>
</template>
