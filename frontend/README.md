# MTG Vault — frontend

Vue 3 + Vite + shadcn-vue, written in TypeScript.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on :5173. `/api` is proxied to Django on :8000 (`API_PROXY_TARGET` overrides it). |
| `pnpm build` | Type-check and build to `dist/` |
| `pnpm gen:api` | Regenerate `src/api/schema.d.ts` from `../backend/openapi.yaml` |
| `pnpm e2e` / `pnpm e2e:ui` | Playwright end-to-end tests (see the root README) |

## Layout

```
src/
  api/        typed API client (openapi-fetch) and generated schema types
  stores/     pinia stores (auth, locations)
  composables/  card browser state: URL query, paged loading, selection
  router/     routes and the login guard
  layouts/    AppLayout (top bar) and AuthLayout (centered card)
  pages/      one component per route
  components/browser/     the shared card browser (spec 001, principle P-2)
  components/collection/  locations, add card, edit, card detail with EDHREC tabs, import
  components/             shared: Price (tooltip with other currencies), ConfirmDialog
                          (useConfirm), IconButton (tooltip), CardPreview (hover),
                          ExpandButton + FullscreenCard, ManaSymbol
  scanner/                camera, frame loop, sounds; recognition/ is ported from
                          manavault (MPL-2.0, see the root README)
  components/scanner/     result bar, scanner settings sheet
  components/ui/  shadcn-vue components (add more with the shadcn MCP or CLI)
e2e/          Playwright tests, one file per area, named by acceptance criterion
```
