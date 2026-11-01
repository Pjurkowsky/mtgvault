<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { z } from 'zod'
import { CircleAlertIcon } from '@lucide/vue'
import { fieldErrors } from '@/api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CURRENCIES, PLN_NOTE } from '@/lib/currency'
import { useAuthStore } from '@/stores/auth'

const schema = toTypedSchema(
  z.object({
    username: z
      .string({ required_error: 'Enter a username.' })
      .regex(/^[A-Za-z0-9_-]{3,30}$/, 'Use 3 to 30 characters: letters, digits, "_" or "-".'),
    email: z.string({ required_error: 'Enter your email.' }).email('Enter a valid email.'),
    password: z.string({ required_error: 'Enter a password.' }).min(1, 'Enter a password.'),
    currency: z.enum(['USD', 'EUR', 'PLN'], { required_error: 'Choose a currency.' }),
  }),
)

const { handleSubmit, setErrors, isSubmitting, values } = useForm({ validationSchema: schema })
const auth = useAuthStore()
const router = useRouter()
const formError = ref('')

const onSubmit = handleSubmit(async (body) => {
  formError.value = ''
  const { error } = await auth.register(body)
  if (!error) return router.replace({ name: 'collection' })
  const { form, ...fields } = fieldErrors(error)
  setErrors(fields)
  formError.value = form ?? ''
})
</script>

<template>
  <Card>
    <form novalidate @submit="onSubmit">
      <CardContent class="grid gap-4">
        <Alert v-if="formError" variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <FormField v-slot="{ componentField }" name="username">
          <FormItem>
            <FormLabel>Username</FormLabel>
            <FormControl><Input v-bind="componentField" autocomplete="username" /></FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="email">
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input v-bind="componentField" type="email" autocomplete="email" /></FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="password">
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl><Input v-bind="componentField" type="password" autocomplete="new-password" /></FormControl>
            <FormMessage class="whitespace-pre-line" />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="currency">
          <FormItem>
            <FormLabel>Currency</FormLabel>
            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger class="w-full"><SelectValue placeholder="Choose a currency" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem v-for="c in CURRENCIES" :key="c.value" :value="c.value">{{ c.label }}</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription v-if="values.currency === 'PLN'">{{ PLN_NOTE }}</FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>
      </CardContent>

      <CardFooter class="mt-6 flex flex-col gap-3">
        <Button type="submit" class="w-full" :disabled="isSubmitting">Create account</Button>
        <p class="text-sm text-muted-foreground">
          Already have an account?
          <RouterLink :to="{ name: 'login' }" class="text-foreground underline underline-offset-4">Log in</RouterLink>
        </p>
      </CardFooter>
    </form>
  </Card>
</template>
