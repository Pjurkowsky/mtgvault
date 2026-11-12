<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { api, type Schemas } from '@/api/client'
import Price from '@/components/Price.vue'
import PrintingPicker from '@/components/collection/PrintingPicker.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { showFullscreen } from '@/composables/useFullscreen'
import { onBranch, type DeckDetail } from '@/lib/decks'

/**
 * A deck's token: image, price, the cards that make it, and for the owner its printing
 * (spec 021, AC-9 to AC-11).
 */
const props = defineProps<{ deck: DeckDetail; token: Schemas['DeckToken'] | null; editable: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [deck: DeckDetail] }>()

const makers = computed(() => props.deck.cards.filter((c) => props.token?.makers.includes(c.id)).map((c) => c.printing.name))
const printings = ref<Schemas['TokenPrinting'][]>([])
const selected = ref<string | null>(null)
const busy = ref(false)

watch(open, async (isOpen) => {
  if (!isOpen || !props.token || !props.editable) return
  selected.value = props.token.id
  printings.value = []
  const { data } = await api.GET('/api/catalog/tokens/{token_id}/printings/', { params: { path: { token_id: props.token.id } } })
  printings.value = data ?? []
}, { immediate: true })

async function choose(token: string | null) {
  if (!props.token) return
  busy.value = true
  const { data } = await api.POST('/api/decks/{id}/token-printing/', {
    params: { path: { id: props.deck.id }, query: onBranch(props.deck) }, body: { kind: props.token.kind, token },
  })
  busy.value = false
  if (!data) return toast.error('Could not change the printing.')
  toast.success(token ? 'Printing saved.' : 'Back to the default printing.')
  emit('changed', data)
  selected.value = data.tokens.find((t) => t.kind === props.token?.kind)?.id ?? selected.value
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid="token-dialog" @open-auto-focus.prevent>
      <DialogHeader>
        <DialogTitle>{{ token?.name }}</DialogTitle>
        <DialogDescription>{{ token?.set_name || token?.set_code.toUpperCase() }} #{{ token?.collector_number }}</DialogDescription>
      </DialogHeader>
      <div v-if="token" class="grid gap-6 sm:grid-cols-[14rem_1fr]">
        <div class="grid content-start gap-3">
          <button type="button" class="cursor-zoom-in" :aria-label="`Preview ${token.name}`" @click="showFullscreen(token.image_large || token.image_normal, token.name)">
            <img :src="token.image_large || token.image_normal" :alt="token.name" class="aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted" />
          </button>
          <p class="text-sm" data-testid="token-price"><Price :value="token.price" :values="token.prices" :currency="deck.currency" /></p>
        </div>
        <div class="grid content-start gap-4">
          <section class="grid gap-1 text-sm" data-testid="token-makers">
            <h3 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Made by</h3>
            <ul><li v-for="name in makers" :key="name">{{ name }}</li></ul>
          </section>
          <template v-if="editable">
            <Separator />
            <section class="grid gap-3" data-testid="token-printings">
              <h3 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Printing</h3>
              <PrintingPicker v-if="printings.length" v-model="selected" :printings="printings" />
              <div class="flex justify-end gap-2">
                <Button v-if="token.chosen" variant="outline" :disabled="busy" @click="choose(null)">Default</Button>
                <Button :disabled="busy || !selected || selected === token.id" @click="choose(selected)">Save</Button>
              </div>
            </section>
          </template>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
