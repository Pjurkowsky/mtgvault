import { reactive } from 'vue'

type Options = { title: string; description?: string; action?: string; destructive?: boolean }

/** One shared dialog (ConfirmDialog in App.vue); `confirm()` resolves true or false. */
export const confirmState = reactive({
  open: false,
  title: '',
  description: '',
  action: 'Delete',
  destructive: true,
  resolve: null as null | ((ok: boolean) => void),
})

export function useConfirm() {
  return (options: Options) =>
    new Promise<boolean>((resolve) => {
      confirmState.resolve?.(false)
      Object.assign(confirmState, {
        description: '', action: 'Delete', destructive: true, ...options, open: true, resolve,
      })
    })
}

export function settleConfirm(ok: boolean) {
  confirmState.resolve?.(ok)
  confirmState.resolve = null
  confirmState.open = false
}
