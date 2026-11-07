/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Ported from cfbender/manavault `assets/react/src/pages/scan/recognition/recognizer.ts`
 * (MPL-2.0). Changes for MTG Vault: import paths; glare check and combined frames (spec 019).
 */
/**
 * Runs the three bundle graphs on one frame. Ported from the-gathering's
 * `recognizer.worker.ts`: the frame centre replaces the click, so the first detector window is
 * the `scene` px square in the middle of the camera frame.
 *
 * Two shortcuts for a live camera feed, which the-gathering's click-to-identify did not need:
 *
 * - A detector pass that sees nothing card-like ends the frame; the refined pass, embedding and
 *   search are skipped. Most frames of a scanning session are empty (between cards), and this
 *   makes them about three times cheaper, so a card placed in view is noticed sooner.
 * - While a card is in view, the next frame's first pass looks at the previous frame's refined
 *   window instead of the whole scene. When the card has not moved much that pass already is
 *   the refined one, saving a detector run per frame. Otherwise (card moved or gone) the usual
 *   whole-scene pass and refined pass follow.
 *
 * The ORT namespace is a parameter so the worker (`onnxruntime-web/wasm`) and a Node
 * calibration script (`onnxruntime-web`) share this code.
 */
import type * as Ort from "onnxruntime-web"
import type { Identification, IdentifyOptions } from "./messages"
import {
  averageEmbedding,
  cardInView,
  COMBINE_FRAMES,
  glareShare,
  EMPTY_UP_VOTE,
  fromWindow,
  galleryMask,
  isPaddedResult,
  refineWindow,
  resampleWindow,
  sceneWindow,
  upVote,
  windowsAgree,
  type BundleConstants,
  type Candidate,
  type DetectorWindow,
  type GalleryArt,
  type Point,
  type Quad,
  type RgbaImage,
  type SearchScope,
} from "./pipeline"

type OrtModule = Pick<typeof Ort, "InferenceSession" | "Tensor">

export interface Recognizer {
  /**
   * Identify one frame. `scope: "tokens"` searches only token arts when the bundle's
   * `search.onnx` takes a gallery mask; an older bundle searches everything and the caller
   * filters the top results itself.
   */
  identify: (image: RgbaImage, scope?: SearchScope, options?: IdentifyOptions) => Promise<Identification>
  /** Whether `search.onnx` declares the `mask` input, so scopes narrow the search itself. */
  readonly masked: boolean
}

interface Detection {
  quad: Quad
  up: [number, number]
  upVote: number
  centre: Point
  short: number
}

/** After this many frames identified from the tracked window alone, look at the whole scene
 * again (about every two seconds at phone frame rates). */
const REANCHOR_FRAMES = 8

export async function createRecognizer(
  ort: OrtModule,
  graphs: { detector: Uint8Array; embed: Uint8Array; search: Uint8Array },
  constants: BundleConstants,
  arts: GalleryArt[],
): Promise<Recognizer> {
  const options: Ort.InferenceSession.SessionOptions = {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  }
  // Sequential creation keeps peak memory lower on phones than three parallel compiles.
  const detector = await ort.InferenceSession.create(graphs.detector, options)
  const embed = await ort.InferenceSession.create(graphs.embed, options)
  const search = await ort.InferenceSession.create(graphs.search, options)

  // A bundle exported with `--search-mask` (Oracle manifest `search_mask: true`) takes a
  // per-art mask next to the embeddings; the graph's own inputs decide, not the manifest. The
  // masks are built once: one float per gallery art, in `arts.json` order.
  const masked = search.inputNames.includes("mask")
  const masks = masked
    ? {
        all: new ort.Tensor("float32", galleryMask(arts, "all"), [arts.length]),
        tokens: new ort.Tensor("float32", galleryMask(arts, "tokens"), [arts.length]),
      }
    : null

  /** The refined window of the last frame that had a card in view, and how many frames in a
   * row were identified from it alone. */
  let tracked: DetectorWindow | null = null
  let trackedFrames = 0

  async function detect(image: RgbaImage, { cx, cy, side }: DetectorWindow): Promise<Detection> {
    const size = constants.det_input
    const { window, scale } = resampleWindow(image, cx, cy, side, size)
    const out = await detector.run({
      window: new ort.Tensor("uint8", new Uint8Array(window.buffer), [size, size, 4]),
    })
    const quad = out.quad?.data as Float32Array
    const up = out.up?.data as Float32Array
    const centre = out.centre?.data as Float32Array
    const short = out.short?.data as Float32Array
    const corners = [0, 1, 2, 3].map((k) =>
      fromWindow([quad[k * 2] ?? 0, quad[k * 2 + 1] ?? 0], cx, cy, scale, size),
    ) as Quad
    const upVector: [number, number] = [up[0] ?? 0, up[1] ?? 0]
    return {
      quad: corners,
      up: upVector,
      upVote: upVote(upVector, constants),
      centre: fromWindow([centre[0] ?? 0, centre[1] ?? 0], cx, cy, scale, size) as Point,
      short: (short[0] ?? 0) / scale,
    }
  }

  async function embedCard(image: RgbaImage, quad: Quad) {
    const embeddings = await embed.run({
      scene: new ort.Tensor("uint8", new Uint8Array(image.data.buffer), [
        image.height,
        image.width,
        4,
      ]),
      quad: new ort.Tensor("float32", Float32Array.from(quad.flat()), [4, 2]),
    })
    const vectors = Object.values(embeddings)[0]
    if (!vectors) throw new Error("embed graph returned nothing")
    return vectors
  }

  async function searchGallery(vectors: Ort.Tensor, scope: SearchScope) {
    const ranked = await search.run(
      masks ? { embeddings: vectors, mask: masks[scope] } : { embeddings: vectors },
    )
    const indices = ranked.indices?.data as BigInt64Array | Int32Array
    const scores = ranked.scores?.data as Float32Array
    const candidates: Candidate[] = []
    for (let k = 0; k < indices.length; k += 1) {
      const index = Number(indices[k])
      const score = scores[k] ?? 0
      // A mask keeping fewer arts than k pads the tail with masked-out rows.
      if (isPaddedResult(score)) break
      const art = arts[index]
      if (art) candidates.push({ ...art, index, score })
    }
    return candidates
  }

  async function embedAndSearch(image: RgbaImage, quad: Quad, scope: SearchScope) {
    const started = performance.now()
    const vectors = await embedCard(image, quad)
    const embedded = performance.now()
    const candidates = await searchGallery(vectors, scope)
    return { candidates, embed: embedded - started, search: performance.now() - embedded }
  }

  /** Embeddings of the still card's latest frames, oldest first (spec 019, AC-5). */
  let recent: Float32Array[] = []

  /** Embed the card, average it with its latest still frames, then search. */
  async function embedCombinedAndSearch(image: RgbaImage, quad: Quad, scope: SearchScope) {
    const started = performance.now()
    const vectors = await embedCard(image, quad)
    const embedded = performance.now()
    let query = vectors
    if (vectors.type === "float32") {
      recent = [...recent, Float32Array.from(vectors.data as Float32Array)].slice(-COMBINE_FRAMES)
      if (recent.length > 1) query = new ort.Tensor("float32", averageEmbedding(recent), vectors.dims)
    }
    const candidates = await searchGallery(query, scope)
    return {
      candidates,
      combined: Math.max(1, recent.length),
      embed: embedded - started,
      search: performance.now() - embedded,
    }
  }

  async function identify(
    image: RgbaImage,
    scope: SearchScope = "all",
    options: IdentifyOptions = { glareLimit: null, combine: false },
  ): Promise<Identification> {
    const started = performance.now()
    const previous = tracked

    // While a card sits still, one pass on the previous frame's refined window is this frame's
    // refined pass. Anything else (card moved, gone, or the periodic re-anchor) takes the
    // whole-scene path, so tracking can neither drift nor get stuck on a wrong window.
    const seed = tracked && trackedFrames < REANCHOR_FRAMES ? tracked : null
    let fine: Detection | null = null
    if (seed) {
      const pass = await detect(image, seed)
      if (pass.upVote >= EMPTY_UP_VOTE && windowsAgree(seed, refineWindow(pass, constants))) {
        fine = pass
      }
    }
    if (!fine) {
      const coarse = await detect(image, sceneWindow(image, constants))
      // Nothing card-like anywhere: the refined pass would not change that.
      fine =
        coarse.upVote >= EMPTY_UP_VOTE
          ? await detect(image, refineWindow(coarse, constants))
          : coarse
    }
    const detected = performance.now()

    const inView = cardInView(fine.upVote, fine.quad)
    tracked = inView ? refineWindow(fine, constants) : null
    trackedFrames = inView && seed ? trackedFrames + 1 : 0
    // Another card, or one that moved, starts a new average.
    if (!inView || !options.combine || !previous || !windowsAgree(previous, tracked!)) recent = []

    const glare = inView ? glareShare(image, fine.quad) : 0
    const glared = inView && options.glareLimit !== null && glare > options.glareLimit
    const result =
      !inView || glared
        ? { candidates: [], combined: 0, embed: 0, search: 0 }
        : options.combine
          ? await embedCombinedAndSearch(image, fine.quad, scope)
          : { ...(await embedAndSearch(image, fine.quad, scope)), combined: 1 }

    return {
      quad: fine.quad,
      upVote: fine.upVote,
      glare,
      glared,
      combined: result.combined,
      candidates: result.candidates,
      timings: {
        detector: detected - started,
        embed: result.embed,
        search: result.search,
        total: performance.now() - started,
      },
    }
  }

  // The first run of each graph pays for kernel setup; do it before the first real frame. A
  // blank frame has no card, so the embedding and search graphs are warmed explicitly.
  const size = constants.scene
  const blank: RgbaImage = {
    data: new Uint8ClampedArray(size * size * 4).fill(255),
    width: size,
    height: size,
  }
  await identify(blank)
  const half = size / 2
  await embedAndSearch(
    blank,
    [
      [half - 125, half - 175],
      [half + 125, half - 175],
      [half + 125, half + 175],
      [half - 125, half + 175],
    ],
    "all",
  )
  tracked = null
  trackedFrames = 0

  return { identify, masked }
}
