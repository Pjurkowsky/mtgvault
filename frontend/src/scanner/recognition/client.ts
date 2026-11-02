import type { BundleInfo, Identification, WorkerResponse } from './messages'
import type { RgbaImage } from './pipeline'

export type LoadProgress = { loaded: number; total: number; cached: boolean }
export type Ready = Extract<WorkerResponse, { type: 'ready' }>

/**
 * Talks to the recognition worker: load a model bundle once, then identify
 * frames one at a time. The worker does all ONNX work off the main thread.
 */
export class RecognizerClient {
  private worker: Worker
  private nextId = 1
  private pending = new Map<number, { resolve: (r: Identification) => void; reject: (e: Error) => void }>()
  private loading: { resolve: (r: Ready) => void; reject: (e: Error) => void; onProgress?: (p: LoadProgress) => void } | null = null

  constructor() {
    this.worker = new Worker(new URL('./recognizer.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handle(event.data)
    this.worker.onerror = (event) => this.failAll(new Error(event.message || 'Recognition worker failed'))
  }

  /** `threads`: 0 lets the runtime pick (only helps on cross-origin isolated pages), 1 = single. */
  load(bundle: BundleInfo, threads: number, onProgress?: (p: LoadProgress) => void): Promise<Ready> {
    return new Promise((resolve, reject) => {
      this.loading = { resolve, reject, onProgress }
      this.worker.postMessage({ type: 'load', bundle, threads })
    })
  }

  /** Identify one frame. The pixel buffer is transferred to the worker (not copied). */
  identify(image: RgbaImage): Promise<Identification> {
    const id = this.nextId++
    const buffer = image.data.buffer as ArrayBuffer
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ type: 'identify', id, rgba: buffer, width: image.width, height: image.height }, [buffer])
    })
  }

  terminate() {
    this.worker.terminate()
    this.failAll(new Error('Recognizer stopped'))
  }

  private handle(message: WorkerResponse) {
    if (message.type === 'progress') this.loading?.onProgress?.(message)
    else if (message.type === 'ready') {
      this.loading?.resolve(message)
      this.loading = null
    } else if (message.type === 'load_failed') {
      this.loading?.reject(new Error(message.message))
      this.loading = null
    } else if (message.type === 'identified' || message.type === 'failed') {
      const waiter = this.pending.get(message.id)
      this.pending.delete(message.id)
      if (message.type === 'identified') waiter?.resolve(message.result)
      else waiter?.reject(new Error(message.message))
    }
  }

  private failAll(error: Error) {
    this.loading?.reject(error)
    this.loading = null
    for (const waiter of this.pending.values()) waiter.reject(error)
    this.pending.clear()
  }
}
