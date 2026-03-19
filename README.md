# OmniKinetix — Platforma de Management Flota Auto

## Quick Start

```bash
# 1. Instaleaza dependentele
npm install

# 2. Configureaza baza de date
#    Copiaza .env.example -> apps/api/.env si seteaza DATABASE_URL
#    Exemplu: postgresql://user:pass@localhost:5432/omnikininetix

# 3. Creeaza tabelele + seed date demo
cd apps/api
npx prisma migrate dev --name init
cd ../..
npm run db:seed

# 4. Porneste (2 terminale separate)
npm run api    # Backend  -> http://localhost:3001
npm run web    # Frontend -> http://localhost:5173
```

**Login demo:** `admin@omnikininetix.ro` / `admin123`

---

## Structura Proiect

```
omnikininetix/
├── apps/
│   ├── api/                    # Backend Express + TypeScript
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Modele DB (User, Agency, Vehicle, Driver, etc.)
│   │   │   └── seed.ts         # Date demo (admin, agentii, vehicule, soferi)
│   │   └── src/
│   │       ├── index.ts        # Entry point Express + routes
│   │       ├── config/         # env.ts (variabile mediu), database.ts (Prisma client)
│   │       ├── middleware/     # auth.ts (JWT), agencyScope.ts (izolare agentii),
│   │       │                   # validate.ts (Zod), errorHandler.ts
│   │       ├── utils/          # AppError.ts (clase erori custom)
│   │       └── modules/        # Logica pe domenii
│   │           ├── auth/       # Login, refresh, logout, getMe
│   │           ├── users/      # CRUD utilizatori (SuperAdmin only)
│   │           ├── agencies/   # CRUD agentii
│   │           ├── categories/ # CRUD categorii vehicule (globale)
│   │           ├── vehicles/   # CRUD vehicule + assign/unassign soferi
│   │           └── drivers/    # CRUD soferi + documente (upload fisiere)
│   │
│   └── web/                    # Frontend React + Vite + Tailwind
│       └── src/
│           ├── App.tsx         # Router + QueryClient + tema
│           ├── index.css       # Tema CSS (light/dark, animatii)
│           ├── lib/            # api.ts (Axios + JWT refresh), utils.ts
│           ├── stores/         # auth.store.ts, theme.store.ts (Zustand)
│           ├── components/
│           │   ├── ui/         # Shadcn/ui (Button, Dialog, Table, etc.)
│           │   ├── layout/     # Sidebar, Header, AppLayout, RequireRole
│           │   └── shared/     # PageHeader, StatsCard, EmptyState,
│           │                   # LoadingSkeleton, ConfirmDialog
│           └── pages/
│               ├── auth/       # LoginPage
│               ├── dashboard/  # DashboardPage (stats, actiuni rapide)
│               ├── fleet/      # FleetPage (categorii + vehicule)
│               ├── drivers/    # DriversPage (soferi + documente + asignari)
│               └── admin/      # AgenciesPage, UsersPage (SuperAdmin)
│
├── packages/
│   └── shared/                 # Tipuri TypeScript comune (auth, models, api)
│
├── tools/
│   └── gps-simulator/          # Simulator GPS (Sprint 3)
│
└── docs/
    └── specificatii.md         # Specificatia completa a proiectului
```

## Stack

| Layer | Tehnologie |
|-------|-----------|
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Frontend | React, Vite, Tailwind CSS, Shadcn/ui |
| DB | PostgreSQL |
| Auth | JWT (access 15min + refresh 7d) |
| State | Zustand + TanStack React Query |

## Roluri

| Rol | Acces |
|-----|-------|
| **Super Admin** | Tot + panel admin (agentii, utilizatori) |
| **Country Manager** | Toate agentiile (vizualizare + editare) |
| **Agency Manager** | Doar agentia proprie |
