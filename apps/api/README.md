# `@omnikinetix/api`

REST + WebSocket backend for OmniKinetix. Express 5, TypeScript, Prisma 7 (PostgreSQL), Zod, Socket.io.

> Prisma 7 reads its connection from `prisma.config.ts` (which loads `apps/api/.env`) and the app connects through the `@prisma/adapter-pg` driver adapter. Real environment variables take precedence over `.env`.

## Run

```bash
cp ../../.env.example .env
npm run db:migrate && npm run db:seed   # from the repo root, or with -w apps/api
npm run dev                             # tsx watch → http://localhost:3001
npm run build && npm start              # production
```

## Layout

```
prisma/
  schema.prisma        Data model (users, agencies, vehicles, drivers, documents, notifications, telemetry)
  migrations/          SQL migrations
  seed.ts              Demo accounts, agencies, categories
src/
  index.ts             App bootstrap: security middleware, routes, file serving, graceful shutdown
  config/              env.ts (typed env), database.ts (Prisma client)
  middleware/
    auth.ts            JWT authentication + role authorization
    agencyScope.ts     Agency isolation helpers (enforceAgency, getEffectiveAgencyId, forceAgencyId)
    validate.ts        Zod request validation
    upload.ts          Multer uploaders (size + MIME + extension allow-list)
    errorHandler.ts    Central error → JSON mapping (AppError, Prisma, Zod, Multer)
  modules/<domain>/    routes → controller → service (+ zod schema) per domain
  services/
    alertEngine.ts     Expiry / revision checks with 7-day de-duplication
    cronJobs.ts        Daily alert job + e-mail dispatch
    emailService.ts    Nodemailer HTML alert e-mails
    socketServer.ts    Authenticated Socket.io, per-agency rooms
  utils/               AppError, pagination, shared zod helpers
```

## Conventions

- **Layering:** `routes` declare auth/validation, `controller` handles HTTP, `service` holds Prisma logic.
- **Multi-tenancy:** every agency-owned resource goes through `enforceAgency` (single resource) or `getEffectiveAgencyId` (lists). Agency managers cannot override `agencyId`.
- **Validation:** Zod schemas wrap `{ body, query, params }`; dates accept `YYYY-MM-DD` or ISO and are rejected with 400 when invalid.
- **Errors:** throw `AppError(message, status)`; unexpected errors become a generic 500 outside development.
- **Pagination:** `?page=&limit=` (limit capped at 100) via `utils/pagination.ts`.

## Telemetry flow

1. A client (the simulator, authenticated as Super Admin) `POST`s `/api/telemetry/ingest`.
2. The service writes an append-only `TelemetryHistory` row and upserts the single `TelemetryLive` row in one transaction.
3. The controller emits `telemetry:update` to room `agency:<id>`; Super Admins and Country Managers join every agency room, Agency Managers only their own.

## Scheduled alerts

`node-cron` runs daily at 11:00 (`CRON_TIMEZONE`). `alertEngine` creates notifications for ITP/RCA/driver documents expiring within 30 days and revisions within 1000 km/h of the threshold, then e-mails managers if SMTP is configured. Super Admins can trigger it via `POST /api/notifications/check`.

## Testing

Vitest with two projects defined in [`vitest.config.ts`](vitest.config.ts):

| Project | Location | Needs DB | Purpose |
|---------|----------|----------|---------|
| `unit` | `test/unit/**` | no | Fast, isolated logic tests |
| `integration` | `test/integration/**` | yes | HTTP-level tests against the real app (`src/app.ts`) and a real PostgreSQL |

```bash
docker compose up -d db          # from the repo root
npm test                         # unit + integration
npm run test:unit                # no database needed
npm run test:integration
npm run test:watch               # TDD loop
npm run test:coverage            # coverage report in ./coverage
```

### How it works

- **App vs. server:** `src/app.ts` builds and exports the Express app; `src/index.ts` only starts the HTTP server, Socket.io and cron. Tests import the app directly, so no port is opened.
- **Database:** `test/helpers/globalSetup.ts` creates `omnikinetix_test` if missing and runs `prisma migrate deploy` once per run. Override the connection with `TEST_DATABASE_URL`. The suite aborts if the database name does not contain `test`.
- **Isolation:** every integration test starts from a `TRUNCATE ... CASCADE` (`resetDatabase()`), and files run sequentially because they share one database.
- **Factories:** `test/helpers/factories.ts` creates agencies, users, vehicles and drivers, and `login()` goes through the real `/auth/login` endpoint so auth middleware is exercised end to end.
- **Environment:** `NODE_ENV=test`, throw-away JWT secrets, relaxed cookie `Secure` flag, a 1 MB upload limit and `./uploads-test` (git-ignored). Rate limiting is disabled in `test`/`development`.

### What is covered

| File | Verifies |
|------|----------|
| `unit/pagination` | Defaults, clamping, rejection of `NaN`/negative/fractional input |
| `unit/optionalDate` | `YYYY-MM-DD`, ISO, `null`, `""` and invalid dates |
| `unit/agencyScope` | `enforceAgency`, `getEffectiveAgencyId`, `forceAgencyId` per role |
| `unit/errorHandler` | AppError / Prisma / Zod / Multer / bad JSON mapping, no leak of 500 details |
| `unit/emailTemplate` | HTML escaping in alert e-mails |
| `integration/auth` | Login, httpOnly + SameSite cookie, no refresh token in body, rotation & replay protection, logout, `/me`, health, JSON 404, security headers |
| `integration/tenancy` | Agency isolation on read/update/delete/list/create, cross-agency driver assignment, role guards, 401 on every resource |
| `integration/vehicles` | Validation matrix, duplicate plates, document upload + ITP/RCA sync, disguised-file and oversize rejection, file clean-up on delete, authenticated & agency-scoped downloads, path traversal |
| `integration/telemetry` | Ingest permissions & validation, history + single live row, per-agency reads, query validation, truncation flag |
| `integration/alertEngine` | 30-day window, expired docs, 7-day de-duplication, revision margin, driver documents |

### Conventions

- Test behaviour through HTTP, not through internals; assert on status code **and** body shape.
- One behaviour per `it`; table-driven (`it.each`) for validation matrices.
- Never share state between tests: create what you need with the factories.
- A bug fix lands with a test that fails without the fix (the refresh-token `jti` regression test is an example).
- Mock only the network boundary (SMTP, OSRM); the database is always real.

### Not covered yet

Socket.io broadcasts, the e-mail transport and the cron schedule itself (the alert logic they call **is** tested).
