<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import { z } from 'zod'
import { fieldErrors } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CURRENCIES, PLN_NOTE, type Currency } from '@/lib/currency'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

async function changeCurrency(value: unknown) {
  const currency = value as Currency
  if (currency === auth.user?.currency) return
  const { error } = await auth.updateCurrency(currency)
  if (error) toast.error('Could not change currency.')
  else toast.success(`Currency changed to ${currency}.`)
}

const passwordSchema = toTypedSchema(
  z.object({
    current_password: z.string({ required_error: 'Enter your current password.' }).min(1, 'Enter your current password.'),
    new_password: z.string({ required_error: 'Enter a new password.' }).min(1, 'Enter a new password.'),
  }),
)
const { handleSubmit, setErrors, resetForm, isSubmitting } = useForm({ validationSchema: passwordSchema })

const changePassword = handleSubmit(async (body) => {
  const { error } = await auth.changePassword(body)
  if (error) return setErrors(fieldErrors(error))
  resetForm()
  toast.success('Password changed.')
})
</script>

<template>
  <div v-if="auth.user" class="mx-auto grid max-w-xl gap-6">
    <h1 class="text-2xl font-semibold">Settings</h1>

    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent class="grid gap-4">
        <div class="grid gap-1">
          <Label>Username</Label>
          <p data-testid="settings-username">{{ auth.user.username }}</p>
        </div>
        <div class="grid gap-1">
          <Label>Email</Label>
          <p data-testid="settings-email">{{ auth.user.email }}</p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Currency</CardTitle>
      </CardHeader>
      <CardContent class="grid gap-2">
        <Label for="currency">Currency</Label>
        <Select :model-value="auth.user.currency" @update:model-value="changeCurrency">
          <SelectTrigger id="currency" class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="c in CURRENCIES" :key="c.value" :value="c.value">{{ c.label }}</SelectItem>
          </SelectContent>
        </Select>
        <p v-if="auth.user.currency === 'PLN'" class="text-sm text-muted-foreground">{{ PLN_NOTE }}</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form novalidate class="grid gap-4" @submit="changePassword">
          <FormField v-slot="{ componentField }" name="current_password">
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <FormControl><Input v-bind="componentField" type="password" autocomplete="current-password" /></FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ componentField }" name="new_password">
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl><Input v-bind="componentField" type="password" autocomplete="new-password" /></FormControl>
              <FormMessage class="whitespace-pre-line" />
            </FormItem>
          </FormField>
          <Button type="submit" class="justify-self-start" :disabled="isSubmitting">Change password</Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
