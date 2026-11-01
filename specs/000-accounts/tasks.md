# Tasks 000: Accounts

Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

Work top to bottom. Each task lists the ACs it serves and a done check. Tick a
task only when its done check passes.

Prerequisite: Docker installed, and `docker compose -f docker-compose.dev.yml up -d db`
running.

## Phase 1: Backend

- [x] **T1 User model fields** (AC-1, AC-2, AC-3, AC-4)
  - `users/models.py`: `username` max 30 with the `^[A-Za-z0-9_-]{3,30}$`
    validator, required `email`, `currency` with choices USD/EUR/PLN and no
    default, unique constraints on `Lower(username)` and `Lower(email)`,
    `REQUIRED_FIELDS = ['email', 'currency']`.
  - Create migration `0002`.
  - Done: `manage.py migrate` succeeds on Postgres. `createsuperuser` asks for
    email and currency.

- [x] **T2 Username-or-email login backend** (AC-7)
  - `users/backends.py` with `UsernameOrEmailBackend`, registered in
    `AUTHENTICATION_BACKENDS`.
  - Done: `authenticate(login=..., password=...)` returns the user in a
    `manage.py shell` check for both username and email, in any letter case.

- [ ] **T3 JWT and cookie settings** (AC-9, AC-10)
  - Add `token_blacklist` app and migrate.
  - simplejwt: refresh lifetime 7 days, rotation, blacklist after rotation.
  - `AUTH_COOKIE_SECURE` env var in settings, `.env.example` and both compose
    files (off in dev, on in prod).
  - `users/cookies.py`: `set_refresh_cookie(response, token)` and
    `clear_refresh_cookie(response)`.
  - Done: `manage.py check` passes.

- [ ] **T4 Register endpoint** (AC-1 to AC-6)
  - `POST /api/auth/register/`, `RegisterSerializer` with
    `validate_password` and case-insensitive duplicate checks.
  - Returns `{access, user}` and sets the refresh cookie.
  - Done: curl through the Vite proxy creates a user. A duplicate `Bob`/`bob`
    returns 400 with a username error, and a weak password returns one message
    per rule.

- [ ] **T5 Login, refresh, logout endpoints** (AC-7 to AC-10)
  - `POST /api/auth/login/`: the same 401 body for every failure.
  - `POST /api/auth/refresh/`: reads the cookie, returns `{access}`, sets a
    rotated cookie.
  - `POST /api/auth/logout/`: blacklists the token, clears the cookie,
    returns 204.
  - Remove the old `/api/auth/token/*` routes.
  - Done: curl with a cookie jar: login → refresh works → logout → refresh
    returns 401.

- [ ] **T6 Me and password endpoints** (AC-12 to AC-14)
  - `GET/PATCH /api/me/` (PATCH accepts `currency` only).
  - `POST /api/me/password/`: checks the current password and validates the
    new one.
  - Done: curl with a bearer token reads me, changes currency, changes the
    password, and a wrong current password returns 400.

- [ ] **T7 Public profile endpoint** (AC-15 to AC-17)
  - `GET /api/users/<username>/`: case-insensitive lookup, returns
    `{username, date_joined}` only.
  - Done: works without a token, unknown user returns 404, and the response
    has no `email` or `currency`.

## Phase 2: API contract

- [ ] **T8 OpenAPI schema and typed client generation**
  - Commit `backend/openapi.yaml` (`manage.py spectacular --validate`).
  - Frontend: add `openapi-typescript`, script `gen:api` writing
    `src/api/schema.d.ts`.
  - `scripts/check-api.sh`: regenerate both, then `git diff --exit-code`.
  - Done: `scripts/check-api.sh` passes with zero spectacular warnings.

## Phase 3: Frontend foundation

- [ ] **T9 Dependencies and shadcn components**
  - Add `vue-router`, `pinia`, `openapi-fetch`, `vee-validate`,
    `@vee-validate/zod`, `zod`.
  - shadcn-vue: `form`, `input`, `label`, `select`, `card`, `sonner`,
    `dropdown-menu`, `alert`.
  - Done: `pnpm build` passes.

- [ ] **T10 API client** (AC-9)
  - `src/api/client.ts`: openapi-fetch client. Middleware adds the bearer
    token, and on a 401 refreshes once (one shared refresh for parallel
    requests) and retries.
  - Done: `pnpm build` passes (type-checked against `schema.d.ts`).

- [ ] **T11 Auth store** (AC-6, AC-9, AC-10, AC-13)
  - `src/stores/auth.ts`: `user`, `accessToken`, `init`, `register`, `login`,
    `logout`, `updateCurrency`.
  - `src/lib/currency.ts`: currency list and labels.
  - Done: `pnpm build` passes.

- [ ] **T12 Router, guard and layouts** (AC-11)
  - Routes from the plan. The guard waits for `auth.init()`, sends guests to
    `/login?next=...`, sends logged-in users away from `/login` and `/signup`,
    and only accepts local `next` paths.
  - `AppLayout` (top bar + user menu), `AuthLayout` (centered card), Sonner
    toaster.
  - Done: the app runs, `/` redirects to `/login?next=/`.

## Phase 4: Pages

- [ ] **T13 Sign-up page** (AC-1 to AC-6)
  - Username, email, password, currency select with no default and a PLN
    note. Server errors appear under their fields. On success, go to `/`.
- [ ] **T14 Login page** (AC-7, AC-8, AC-11)
  - "Username or email" + password. One generic error alert. Redirect to
    `next`.
- [ ] **T15 Settings page** (AC-12 to AC-14)
  - Read-only username and email, currency select that saves on change with
    a toast, and a password change form.
- [ ] **T16 Profile, not found and collection placeholder** (AC-6, AC-15 to AC-17)
  - `/u/:username` shows username and join date, or a "User not found" state
    on 404.
  - Catch-all `NotFoundPage`. `CollectionPage` is an empty state that names
    spec 001.

Done for T13 to T16: each flow works by hand in the browser.

## Phase 5: End-to-end tests

- [ ] **T17 Playwright setup**
  - `@playwright/test`, `playwright.config.ts` with `webServer` for Django
    (`:8100`, DB `mtgvault_e2e`, migrate first) and Vite (`:5180`).
  - `backend/docker/initdb/01-e2e.sql` creates `mtgvault_e2e`. Mount it in
    the dev compose `db` service.
  - `e2e/helpers.ts`: `uniqueUser()` and `signUp(page, user)`.
  - Scripts `e2e` and `e2e:ui`.
  - Done: a smoke test that opens `/login` passes.

- [ ] **T18 `signup.spec.ts`** (AC-1 to AC-6)
- [ ] **T19 `login.spec.ts`** (AC-7, AC-8, AC-11)
- [ ] **T20 `session.spec.ts`** (AC-9, AC-10)
- [ ] **T21 `settings.spec.ts`** (AC-12 to AC-14)
- [ ] **T22 `profile.spec.ts`** (AC-15 to AC-17)

Done for T18 to T22: `pnpm e2e` passes.

## Phase 6: Wrap up

- [ ] **T23 Verify and close the spec**
  - `pnpm e2e` and `scripts/check-api.sh` both pass.
  - Update READMEs (new endpoints, `pnpm e2e`, `pnpm gen:api`).
  - Set spec status to "Done".
