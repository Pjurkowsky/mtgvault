# Plan 000: Accounts

Spec: [spec.md](spec.md)

This is the first feature, so the plan also sets up the frontend foundation
(router, state, API client, layout) and the end-to-end test setup that later
specs reuse.

## Decisions

| Topic | Choice |
| --- | --- |
| Token storage | Access token in memory only. Refresh token in an httpOnly cookie. |
| API client | drf-spectacular writes `backend/openapi.yaml`, openapi-typescript generates TS types, openapi-fetch makes typed calls. |
| Tests | Playwright end-to-end. Each acceptance criterion maps to at least one test. |
| Frontend libraries | vue-router, pinia, vee-validate + zod (shadcn-vue's form stack). |

## Backend

### Model changes (`users.User`, new migration `0002`)

| Field | Change |
| --- | --- |
| `username` | max length 30, validator `^[A-Za-z0-9_-]{3,30}$` (AC-3) |
| `email` | required (AC-1) |
| `currency` | new, choices `USD`, `EUR`, `PLN`, required, no default (AC-1, AC-2) |

Constraints:

- unique on `Lower(username)` (AC-3)
- unique on `Lower(email)` (AC-4)

`REQUIRED_FIELDS = ['email', 'currency']` so `createsuperuser` asks for both.

### Login by username or email (AC-7)

Add `users.backends.UsernameOrEmailBackend` and use it in
`AUTHENTICATION_BACKENDS`. It looks the user up with `username__iexact` or
`email__iexact`, then checks the password.

### Refresh cookie

- Name `refresh`, `HttpOnly`, `SameSite=Lax`, path `/api/auth/`, max age 7 days.
- `Secure` turns on through a new env var `AUTH_COOKIE_SECURE` (on in prod
  with HTTPS, off in dev).
- simplejwt settings: `ROTATE_REFRESH_TOKENS=True`,
  `BLACKLIST_AFTER_ROTATION=True`, refresh lifetime 7 days. Every refresh
  issues a new 7-day cookie, which gives the "7 days without activity" rule
  (AC-9).
- Add `rest_framework_simplejwt.token_blacklist` to `INSTALLED_APPS` so logout
  and rotation revoke old refresh tokens.
- The frontend and API share one origin (Vite proxy in dev, nginx in prod), so
  the cookie needs no CORS setup.

### Endpoints

The current `/api/auth/token/*` routes are replaced.

| Method | Path | Auth | Purpose | ACs |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register/` | public | Create user. Returns `{access, user}` and sets the refresh cookie. | 1-6 |
| POST | `/api/auth/login/` | public | `{login, password}`. Returns `{access, user}` and sets the cookie. Any failure returns the same 401 message. | 7, 8 |
| POST | `/api/auth/refresh/` | cookie | Returns `{access}` and sets a rotated cookie. 401 if missing or invalid. | 9 |
| POST | `/api/auth/logout/` | cookie | Blacklists the refresh token and clears the cookie. Always 204. | 10 |
| GET | `/api/me/` | bearer | `{username, email, currency, date_joined}` | 12 |
| PATCH | `/api/me/` | bearer | `{currency}` only | 13 |
| POST | `/api/me/password/` | bearer | `{current_password, new_password}` | 14 |
| GET | `/api/users/<username>/` | public | `{username, date_joined}`, looked up case-insensitively. 404 if missing. | 15-17 |

Validation errors use DRF's standard shape `{field: [messages]}`. Password
errors come from Django's `validate_password`, one message per failed rule
(AC-5).

### Code layout

```
backend/users/
  models.py        User with currency and constraints
  backends.py      UsernameOrEmailBackend
  serializers.py   Register, Login, Me, PasswordChange, PublicUser
  views.py         auth views and me/profile views
  cookies.py       set/clear refresh cookie helpers
  urls.py          /api/auth/*, /api/me/*, /api/users/*
```

## API contract and typed client

- `backend/openapi.yaml` is committed. Regenerate it with
  `uv run manage.py spectacular --file openapi.yaml`.
- `frontend/src/api/schema.d.ts` is generated from it with
  `pnpm gen:api` (openapi-typescript).
- `scripts/check-api.sh` regenerates both files and fails if git shows a diff.
  A task's done check runs it.

## Frontend

### New dependencies

- Runtime: `vue-router`, `pinia`, `openapi-fetch`, `vee-validate`,
  `@vee-validate/zod`, `zod`
- Dev: `openapi-typescript`, `@playwright/test`
- shadcn-vue components, added through the shadcn MCP or CLI: `form`, `input`,
  `label`, `select`, `card`, `sonner`, `dropdown-menu`, `alert`

### Structure

```
src/
  api/
    schema.d.ts       generated
    client.ts         openapi-fetch client + auth middleware
  stores/
    auth.ts           pinia: user, access token, init/login/register/logout/updateCurrency
  router/
    index.ts          routes + guard
  layouts/
    AppLayout.vue     top bar: app name, user menu (Settings, Log out)
    AuthLayout.vue    centered card for login/sign-up
  pages/
    LoginPage.vue
    SignupPage.vue
    SettingsPage.vue
    ProfilePage.vue
    CollectionPage.vue   empty placeholder until spec 001
    NotFoundPage.vue
  lib/
    currency.ts       currency list and labels (shared with spec 001)
```

### Auth flow

- **App start:** `auth.init()` calls `/api/auth/refresh/`. On success it keeps
  the access token in memory and loads `/api/me/`. The router waits for
  `init()` before the first navigation, so a reload never flashes the login
  page (AC-9).
- **Requests:** the client middleware adds `Authorization: Bearer <access>`.
  On a 401 it refreshes once and retries. If the refresh fails, it clears the
  store and sends the user to login.
- **Concurrent 401s** share one refresh call, so rotation can't race.

### Routes

| Path | Page | Access | ACs |
| --- | --- | --- | --- |
| `/login` | LoginPage | guests (logged-in users go to `/`) | 7, 8, 11 |
| `/signup` | SignupPage | guests | 1-6 |
| `/` | CollectionPage | login required | 6 |
| `/settings` | SettingsPage | login required | 12-14 |
| `/u/:username` | ProfilePage | anyone | 15-17 |
| `*` | NotFoundPage | anyone | 16 |

The guard sends logged-out users to `/login?next=<path>`. After login the app
goes to `next` when it is a local path, otherwise to `/` (AC-11).

### Forms

- zod schemas repeat the simple client-side rules: required fields, username
  pattern, email format.
- Server errors map onto fields, so password rule failures show under the
  password input (AC-5).
- Sign-up currency is a shadcn `select` with no default value. Under it, a
  helper line says PLN prices are converted from EUR (AC-2).
- Settings saves currency on change and confirms with a toast (AC-13).
- Login errors show one `alert` with the generic message (AC-8).

## End-to-end tests (Playwright)

### Setup

- Location: `frontend/e2e/`, config in `frontend/playwright.config.ts`.
- Playwright's `webServer` starts:
  - Django on `127.0.0.1:8100` against the database `mtgvault_e2e`,
    running `migrate` first
  - Vite on port `5180` with `API_PROXY_TARGET=http://127.0.0.1:8100`
- Postgres comes from `docker-compose.dev.yml`. An init script
  (`backend/docker/initdb/01-e2e.sql`) creates `mtgvault_e2e` on the first start.
- Every test signs up its own user with a random suffix, so tests run in
  parallel without resetting the database.
- Commands: `pnpm e2e` runs headless, `pnpm e2e:ui` opens the Playwright UI.

### AC coverage

| Test file | Covers |
| --- | --- |
| `signup.spec.ts` | AC-1 required fields, AC-2 currency options and PLN note, AC-3 username rules and case-insensitive duplicate, AC-4 duplicate email, AC-5 weak password messages, AC-6 lands on `/` logged in |
| `login.spec.ts` | AC-7 login with username and with email, AC-8 generic error for wrong user and wrong password, AC-11 redirect to login and back |
| `session.spec.ts` | AC-9 still logged in after reload and in a new page of the same context, AC-10 logout ends the session and reload stays logged out |
| `settings.spec.ts` | AC-12 shows username, email, currency, AC-13 currency change persists after reload, AC-14 password change, then login works with the new password and fails with the old |
| `profile.spec.ts` | AC-15 profile visible logged out, AC-16 unknown user page, AC-17 page and API response have no email or currency |

### Gaps

Playwright cannot wait 7 days, so the expiry half of AC-9 relies on the
simplejwt settings above and on a code review.

## Order of work

1. Backend: model changes, migration, auth backend, endpoints, cookie handling.
2. Generate `openapi.yaml`, add `pnpm gen:api` and `scripts/check-api.sh`.
3. Frontend foundation: dependencies, shadcn components, router, pinia, API
   client, layouts.
4. Pages: sign up, login, settings, profile, not found, collection placeholder.
5. Playwright setup and the five test files.
6. Run all tests and `check-api.sh`, then tick off every AC in the spec.

`tasks.md` breaks these steps into small tasks.
