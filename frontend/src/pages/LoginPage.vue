<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { z } from 'zod'
import { fieldErrors } from '@/api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { safeNext } from '@/router'
import { useAuthStore } from '@/stores/auth'

const schema = toTypedSchema(
  z.object({
    login: z.string({ required_error: 'Enter your username or email.' }).min(1, 'Enter your username or email.'),
    password: z.string({ required_error: 'Enter your password.' }).min(1, 'Enter your password.'),
  }),
)

const { handleSubmit, isSubmitting } = useForm({ validationSchema: schema })
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const formError = ref('')

const onSubmit = handleSubmit(async (body) => {
  formError.value = ''
  const { error } = await auth.login(body)
  if (!error) return router.replace(safeNext(route.query.next) ?? { name: 'collection' })
  // The server sends one generic message for every failed login (AC-8).
  formError.value = Object.values(fieldErrors(error)).join(' ')
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Log in</CardTitle>
    </CardHeader>

    <form novalidate @submit="onSubmit">
      <CardContent class="grid gap-4">
        <Alert v-if="formError" variant="destructive" data-testid="login-error">
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <FormField v-slot="{ componentField }" name="login">
          <FormItem>
            <FormLabel>Username or email</FormLabel>
            <FormControl><Input v-bind="componentField" autocomplete="username" /></FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="password">
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl><Input v-bind="componentField" type="password" autocomplete="current-password" /></FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </CardContent>

      <CardFooter class="mt-6 flex flex-col gap-3">
        <Button type="submit" class="w-full" :disabled="isSubmitting">Log in</Button>
        <p class="text-sm text-muted-foreground">
          No account yet?
          <RouterLink :to="{ name: 'signup' }" class="text-foreground underline underline-offset-4">Sign up</RouterLink>
        </p>
      </CardFooter>
    </form>
  </Card>
</template>
