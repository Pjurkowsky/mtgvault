/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Ported from cfbender/manavault `assets/react/src/pages/scan/recognition/messages.ts`
 * (MPL-2.0). Changes for MTG Vault: none.
 */
import type { BundleConstants, Candidate, Quad, SearchScope } from "./pipeline"

/** Bundle files the browser downloads. `printings.json` stays on the server. */
export const BUNDLE_FILES = ["arts.json", "detector.onnx", "embed.onnx", "search.onnx"] as const

export type BundleFile = (typeof BUNDLE_FILES)[number]

/** `GET /api/scanner/bundle`: the installed bundle and where to fetch its files. */
export interface BundleInfo {
  version: string
  created: string
  gallery: { arts: number; dtype: string; embed_dim: number; frame_penalty: number; topk: number }
  constants: BundleConstants
  files: Record<BundleFile, string>
  /** Decoded byte size of each file, for download progress. */
  sizes: Partial<Record<BundleFile, number>>
}

export type WorkerRequest =
  | {
      type: "load"
      bundle: BundleInfo
      /**
       * WASM threads to run inference on. `0` lets onnxruntime pick from the core count. Anything
       * above 1 needs the page to be cross-origin isolated; otherwise the worker runs one thread.
       */
      threads: number
    }
  | {
      type: "identify"
      id: number
      /** RGBA pixels of the frame, transferred (not copied) to the worker. */
      rgba: ArrayBuffer
      width: number
      height: number
      /** Part of the gallery to search; `"all"` when omitted. */
      scope?: SearchScope
      options?: IdentifyOptions
    }

/** Spec 019: skip glare frames, average still frames. */
export interface IdentifyOptions {
  /** Washed-out share of the card above which the frame is not identified; null = never. */
  glareLimit: number | null
  combine: boolean
}

export interface Identification {
  quad: Quad
  /** Washed-out share of the card, 0–1 (spec 019). */
  glare: number
  /** Over the glare limit: the frame was not identified. */
  glared: boolean
  /** Frames whose embeddings were averaged for these candidates (1 without Combine frames). */
  combined: number
  /** Share of detector views that agreed the card is upright, 0–1 (roughly). */
  upVote: number
  candidates: Candidate[]
  /** Milliseconds per stage. */
  timings: { detector: number; embed: number; search: number; total: number }
}

export type WorkerResponse =
  | { type: "progress"; loaded: number; total: number; cached: boolean }
  | {
      type: "ready"
      version: string
      arts: number
      /** Whether `search.onnx` takes a gallery mask, so token scope narrows the search itself. */
      masked: boolean
      ms: number
      /** Threads the runtime actually initialized with. */
      threads: number
    }
  | { type: "load_failed"; message: string }
  | { type: "identified"; id: number; result: Identification }
  | { type: "failed"; id: number; message: string }
