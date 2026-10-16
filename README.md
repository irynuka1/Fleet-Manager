<div align="center">

# OmniKinetix

**Multi-tenant fleet management and real-time GPS telemetry platform for vehicles and heavy equipment.**

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express_5-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma_7-4169E1?logo=postgresql&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socketdotio&logoColor=white)

</div>

OmniKinetix replaces spreadsheets and manual reminders with a single web dashboard: it tracks vehicles, equipment, drivers and their documents across agencies, warns before ITP / RCA / licences expire, and shows the whole fleet moving on a live map.

> University project — built in three sprints

## Features

| Area | What it does |
|------|--------------|
| **Fleet** | CRUD for vehicles and equipment, grouped by global categories; monitoring by kilometres or engine hours; revision thresholds. |
| **Drivers** | Driver profiles with photo, many-to-many assignment to vehicles, driving licence and medical certificate with expiry dates. |
| **Documents** | Upload PDFs/images for vehicles (ITP, RCA, registration, insurance) and drivers. Files are served only to authenticated users of the owning agency. |
| **Alerts** | A daily cron job creates de-duplicated notifications (ITP, RCA, revision, driver documents) and emails the relevant managers. |
| **Live map** | Leaflet + OpenStreetMap view; positions pushed over Socket.io, scoped per agency. |
| **Playback** | Replay any vehicle's route for a chosen time range with an animated marker. |
| **Dashboard** | Fleet status donut, critical alerts panel, stat cards with sparklines, quick actions. |
| **Access control** | Three roles with strict agency isolation (see below), JWT access + rotating refresh tokens. |
| **Admin** | Agency and user management (Super Admin). |
| **UX** | Light / dark theme, responsive layout, shadcn/ui components. |

### Roles

| Role | Scope |
|------|-------|
| **Super Admin** | Everything, plus user management and telemetry ingestion. |
| **Country Manager** | Read/write across all agencies; manages agencies and vehicle categories. |
| **Agency Manager** | Own agency only — enforced server-side on every resource. |

## Architecture

```
┌────────────────┐   REST (JWT)    ┌──────────────────────┐        ┌────────────┐
│  apps/web      │ ──────────────► │  apps/api            │ ─────► │ PostgreSQL │
│  React + Vite  │ ◄── Socket.io ──│  Express + Prisma    │        └────────────┘
└────────────────┘  live positions │  cron · SMTP · files │
                                   └──────────▲───────────┘
                                              │ POST /api/telemetry/ingest
                                   ┌──────────┴───────────┐     ┌──────────┐
                                   │ tools/gps-simulator  │ ──► │   OSRM   │
                                   └──────────────────────┘     └──────────┘
```

An npm-workspaces monorepo:

```
.
├── apps/
│   ├── api/              Express + TypeScript + Prisma backend      → apps/api/README.md
│   └── web/              React + Vite + Tailwind frontend           → apps/web/README.md
├── tools/
│   └── gps-simulator/    Realistic GPS traffic over OSRM routes     → tools/gps-simulator/README.md
├── docs/                 Specification, architecture (ADD), sprint notes (RO)
└── .env.example          Template for apps/api/.env
```

## Tech stack

- **Backend:** Node.js, Express 5, TypeScript, Prisma 7 ORM, Zod validation, Socket.io, node-cron, Nodemailer, Multer, helmet, express-rate-limit
- **Frontend:** React 19, Vite, Tailwind CSS 4, shadcn/ui (Radix), TanStack Query, Zustand, React Hook Form, Leaflet
- **Data:** PostgreSQL
- **Routing data:** OSRM (public demo server by default)

## Getting started

### Prerequisites

- Node.js 20+ and npm 10+
- PostgreSQL 14+ (local install, or Docker: see below)

### 1. Install

```bash
git clone <repo-url> && cd Fleet-Management
npm install
```

### 2. Database

```bash
docker compose up -d db            # PostgreSQL 16 on :5432 (user/password/db: postgres/postgres/omnikinetix)
```

### 3. Configure

```bash
cp .env.example apps/api/.env      # then edit secrets (see Configuration)
```

### 4. Migrate and seed

```bash
npm run db:migrate                 # apply migrations (prisma migrate dev)
npm run db:seed                    # demo accounts, 2 agencies, 3 categories (non-destructive)
npm run db:seed -- --reset         # same, but first wipes vehicles, drivers and notifications
```

The seed is idempotent and refuses to run with `NODE_ENV=production` unless `SEED_FORCE=true`.

### 5. Run

```bash
npm run api          # http://localhost:3001  (REST + Socket.io)
npm run web          # http://localhost:5173
npm run simulator    # optional: feed the live map with moving vehicles
```

Add a few vehicles from **Flota** first (and assign a driver — the simulator only moves vehicles that have one), then start the simulator.

### Run everything with Docker

```bash
printf 'JWT_ACCESS_SECRET=%s\nJWT_REFRESH_SECRET=%s\n' $(openssl rand -hex 32) $(openssl rand -hex 32) > .env
docker compose --profile app up -d --build     # web → http://localhost:8080
```

Migrations are applied automatically when the API container starts. Seed demo accounts once with
`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/omnikinetix SEED_FORCE=true npm run db:seed`.
Nginx serves the SPA and proxies `/api` and `/socket.io`; uploads and database data live in named volumes.
Behind HTTPS set `COOKIE_SECURE=true` and `CORS_ORIGIN` to your public URL.

### Demo accounts

Created by the seed, password `admin123` for all. **Change them before exposing the app anywhere.**

| Email | Role |
|-------|------|
| `admin@omnikinetix.ro` | Super Admin |
| `manager@omnikinetix.ro` | Country Manager |
| `bucuresti@omnikinetix.ro` | Agency Manager (București) |
| `cluj@omnikinetix.ro` | Agency Manager (Cluj) |

## Configuration

All variables live in `apps/api/.env` (template: [`.env.example`](.env.example)).

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | — | PostgreSQL connection string. **Required** outside development. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | dev-only fallbacks | **Required** outside development; use long random values (`openssl rand -hex 48`). |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `15m` / `7d` | |
| `PORT` / `HOST` | `3001` / `0.0.0.0` | |
| `COOKIE_SECURE` | `true` outside development | `Secure` flag of the refresh cookie. |
| `NODE_ENV` | `development` | Anything else enforces required secrets, CORS allow-list and rate limiting. |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed browser origin outside development. |
| `TRUST_PROXY` | `false` | Set `true` behind a reverse proxy so rate limiting sees client IPs. |
| `UPLOAD_DIR` / `MAX_FILE_SIZE` | `./uploads` / `5242880` | Document and photo storage, max bytes. |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` | empty | Alert emails are skipped when `SMTP_HOST` is empty. |
| `CRON_TIMEZONE` | `Europe/Bucharest` | Timezone of the daily 11:00 alert job. |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run api` / `web` / `simulator` | Start a workspace in dev mode |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Create/apply migrations (dev) |
| `npm run db:seed` | Seed demo accounts (`-- --reset` also wipes fleet data) |
| `npm run db:studio` | Open Prisma Studio |
| `npm test` | Run every test suite (API needs the DB container up) |
| `npm run test:coverage` | Same, with coverage reports |
| `npm run typecheck` | Type-check all workspaces (sources **and** tests) |
| `npm run build` | Build API and web for production |

## API at a glance

All responses use `{ success, data, ... }`; errors use `{ success: false, error }`. Everything except `/auth/login`, `/auth/refresh` and `/health` requires `Authorization: Bearer <accessToken>`.

| Prefix | Purpose |
|--------|---------|
| `/api/auth` | login, refresh (cookie, rotating), logout, me |
| `/api/users` | users (Super Admin) |
| `/api/agencies` | agencies |
| `/api/categories` | vehicle categories |
| `/api/vehicles` | vehicles, driver assignment, documents |
| `/api/drivers` | drivers, documents, profile photo |
| `/api/notifications` | list, unread count, mark read, manual check |
| `/api/telemetry` | `POST /ingest`, `GET /live`, `GET /:vehicleId/history` |
| `/api/uploads/:filename` | authenticated, agency-scoped file download |
| `/api/health` | liveness + database check |

Socket.io (same port) authenticates with the access token and emits `telemetry:update` to the agency room.

## Testing

| Suite | Tooling | Count | What it covers |
|-------|---------|-------|----------------|
| **API unit** | Vitest | 28 | Pure logic: pagination, date parsing, agency-scope rules, error mapping, e-mail escaping |
| **API integration** | Vitest + Supertest + real PostgreSQL | 50 | The full Express app: auth & cookies, multi-tenancy, role guards, validation, uploads, telemetry, alert engine |
| **Web unit / component** | Vitest + Testing Library + jsdom | 34 | Geo maths, fleet-status rules, API client token refresh, route guard, components |

```bash
docker compose up -d db      # PostgreSQL for the API integration tests
npm test                     # everything (API + web)
npm run test:api             # API only          (npm run test:unit -w apps/api for unit only)
npm run test:web             # web only
npm run test:coverage        # + coverage (text summary, lcov in <app>/coverage)
```

Integration tests use a dedicated `omnikinetix_test` database that is created and migrated automatically; the harness refuses to run against a database whose name does not contain `test`. CI runs type-check, build and the full suite against a Postgres service container on every push and pull request.

Details, conventions and the list of what each file covers: [`apps/api`](apps/api/README.md#testing) · [`apps/web`](apps/web/README.md#testing).

## Security notes

- Passwords hashed with bcrypt (cost 12); login is timing-equalised and rate limited.
- Access token is kept in memory only; the refresh token is an `httpOnly`, `SameSite=Strict` cookie scoped to `/api/auth`, verified, stored server-side and rotated atomically. Nothing sensitive is in `localStorage`.
- Agency isolation is enforced in the API, never only in the UI.
- Uploads are limited by size, MIME type **and** extension, renamed to random names, and only served through an authenticated, agency-checked endpoint with a path-traversal guard.
- `helmet` security headers, strict CORS outside development, error details hidden in production.

## Documentation

- [`docs/specificatii.md`](docs/specificatii.md) — requirements specification
- [`docs/proiectare-arhitecturala.md`](docs/proiectare-arhitecturala.md) — architecture design document (diagrams, ERD, flows)
- [`docs/documentatie_sprint3.md`](docs/documentatie_sprint3.md) — telemetry / live map sprint notes
