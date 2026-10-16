# `@omnikinetix/web`

Single-page dashboard for OmniKinetix. React 19, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, Zustand, Leaflet.

## Run

```bash
npm run web            # from the repo root → http://localhost:5173
npm run build -w apps/web
npm run lint -w apps/web
```

Vite proxies `/api` and `/socket.io` to `http://localhost:3001` in development. For a build served from another origin, set `VITE_SOCKET_URL` (WebSocket) and put a reverse proxy in front of `/api`.

## Layout

```
src/
  App.tsx, main.tsx        Router, QueryClient, theme bootstrap
  lib/
    api.ts                 Axios instance, token injection, single-flight refresh on 401
    socket.ts              Socket.io client with token refresh on connect errors
    fleet-status.ts, geo.ts, utils.ts
  stores/                  Zustand: auth.store.ts, theme.store.ts
  hooks/                   useAuthenticatedImageUrl (blob fetch for protected uploads)
  components/
    ui/                    shadcn/ui primitives
    layout/                AppLayout, Sidebar, Header, NotificationPanel, RequireRole
    dashboard/             VehicleStatusDonut, CriticalAlertsPanel
    shared/                StatsCard, PageHeader, EmptyState, ConfirmDialog, DriverAvatar, …
  pages/
    auth/ dashboard/ fleet/ drivers/ notifications/ live-map/ playback/ admin/
```

## Notes

- Route guards (`RequireRole`) are UX only — authorization is enforced by the API.
- Protected files (documents, photos) cannot be used as plain `<img src>`; they are fetched with the bearer token and shown through object URLs.
- Path alias `@/` → `src/`.

## Testing

Vitest + jsdom + React Testing Library (`vitest.config.ts`, setup in `src/test/setup.ts`). Tests live next to the code as `*.test.ts(x)`.

```bash
npm run test -w apps/web              # or `npm run test:web` from the root
npm run test:watch -w apps/web
npm run test:coverage -w apps/web     # lib / stores / components (shadcn primitives excluded)
```

| File | Verifies |
|------|----------|
| `lib/geo.test.ts` | Haversine distance, bearing, route sampling/interpolation, depot lookup (diacritics, fallback) |
| `lib/fleet-status.test.ts` | Revision remaining/urgency, online/offline rules, critical-alert generation and ordering (fake timers) |
| `lib/utils.test.ts` | `cn`, `formatDate`, `daysUntil` |
| `lib/api.test.ts` | Bearer injection, in-memory-only token, refresh-on-401 with retry, single-flight refresh for concurrent requests, failure handling |
| `components/layout/RequireRole.test.tsx` | Role guard renders / redirects |
| `components/shared/StatsCard.test.tsx` | String and numeric values, count-up, value-type switching |

### Conventions

- Query by role/text the way a user would; avoid test IDs and implementation details.
- Control time with `vi.useFakeTimers()` for anything date-dependent.
- The HTTP layer is replaced by a scripted axios adapter so the real interceptors run.
- `npm run typecheck` (`tsc -b`) also type-checks the tests.

### Not covered yet

Page-level flows (Fleet, Drivers, Live Map) and real-browser end-to-end tests. The natural next step is Playwright against `docker compose --profile app up`.
