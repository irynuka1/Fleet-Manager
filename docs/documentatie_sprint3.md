# Sprint 3 — Setup & Documentatie

Sprint 3 adauga:
- Telemetrie GPS in timp real (live + istoric)
- Socket.io pentru update-uri instant
- Simulator GPS (Node.js, ruleaza local)
- Harta Live pe web (Leaflet + OpenStreetMap)
- Playback traseu cu animatie

---

## 1. Pull-uire branch

```bash
git checkout main
git pull origin main
```

Sprint 3 a fost deja merge-uit in `main`.

---

## 2. Instalare dependinte noi

Din radacina proiectului:

```bash
npm install
```

Asta instaleaza automat pachetele noi:
- `socket.io` (backend)
- `socket.io-client`, `leaflet`, `react-leaflet`, `@types/leaflet` (web)
- `axios` + `tsx` pentru simulator

---

## 3. Migratie baza de date

Sprint 3 adauga 2 tabele noi: `telemetry_live` si `telemetry_history`.

```bash
cd apps/api
npx prisma migrate dev
cd ../..
```

Cand intreaba "Apply pending migration?" → **y**. Va aplica migratia `add_telemetry`.

**ATENTIE:** Daca esti pe baza de date fresh (fara seed Sprint 1/2), ruleaza si:
```bash
npm run db:seed
```

---

## 4. Verificare ca totul e in regula

```bash
cd apps/api && npx tsc --noEmit
cd ../web && npx tsc --noEmit
```

Ambele trebuie sa ramana fara erori.

---

## 5. Pornire — 3 terminale

### Terminal 1 — Backend API
```bash
cd /path/to/FleetManagement
npm run api
```
Astepti pana vezi:
```
[OmniKinetix API] Server pornit pe http://localhost:3001
[Socket.io] Server initializat pe acelasi port ca API-ul
```

### Terminal 2 — Frontend Web
```bash
cd /path/to/FleetManagement
npm run web
```
Astepti pana vezi `Local: http://localhost:5173/`.

### Terminal 3 — Simulator GPS (OSRM)

Din radacina proiectului:

```bash
npm run simulator
```

**Important:** Seed-ul nu mai creeaza vehicule demo. Adauga vehicule manual din **Flota** inainte de a testa harta. Simulatorul:
- incarca vehiculele existente din API
- genereaza rute random pe strazi (OSRM) in orasul agentiei (Bucuresti / Cluj-Napoca)
- daca flota e goala, asteapta si re-verifica la 60s

Astepti pana vezi:
```
[GPS Simulator] Autentificare reusita
[GPS Simulator] Ruta OSRM: ... — Bucuresti, X.X km
[GPS Simulator] Ping-uri la fiecare 5s
```

Sau, daca nu ai vehicule:
```
[GPS Simulator] Niciun vehicul in flota — astept...
```

---

## 6. Testare in browser

1. Deschide `http://localhost:5173`
2. Login: `admin@omnikininetix.ro` / `admin123`
3. Mergi la **Flota** si adauga cel putin un vehicul (ex: duba la Agentia Bucuresti)
4. Porneste simulatorul: `npm run simulator`
5. Click **"Harta Live"** in sidebar → vehiculele se misca pe strazi
6. Click pe un vehicul din lista stanga → harta zoom-eaza la el
7. Click **"Playback"** → selecteaza vehicul + interval → traseul urmeaza drumurile reale

---

## 7. Variabile de mediu noi

Pentru simulator (toate optionale, au defaults):

| Variabila | Default | Descriere |
|-----------|---------|-----------|
| `API_URL` | `http://localhost:3001/api` | URL-ul API-ului |
| `SIMULATOR_EMAIL` | `admin@omnikininetix.ro` | Cont admin pentru simulator |
| `SIMULATOR_PASSWORD` | `admin123` | Parola admin |
| `OSRM_URL` | `https://router.project-osrm.org` | Server OSRM pentru rute (doar dev) |
| `OSRM_DELAY_MS` | `350` | Pauza intre request-uri OSRM |

**Nota OSRM:** serverul public are limita de rate; pentru productie foloseste o instanta OSRM proprie.

---

## 8. Endpoint-uri noi

### REST
- `POST /api/telemetry/ingest` — ingest GPS (doar SUPER_ADMIN)
- `GET /api/telemetry/live` — toate pozitiile curente (filtrat per agentie)
- `GET /api/telemetry/:vehicleId/history?from=ISO&to=ISO&limit=5000` — istoric pentru playback

### Socket.io
URL: `http://localhost:3001` (acelasi port ca API)
- Handshake: `auth: { token: <accessToken> }`
- Eveniment broadcast: `telemetry:update` cu payload `{ vehicleId, name, plateNumber, lat, lng, speed, heading, updatedAt }`
- Rooms automate: `agency:<id>` (SUPER_ADMIN si COUNTRY_MANAGER auto-join toate; AGENCY_MANAGER doar al sau)

---

## 9. Troubleshooting

**Simulatorul da 401 imediat dupa pornire**
- Verifica ca admin-ul exista in DB: `npm run db:seed`
- Verifica `SIMULATOR_EMAIL` / `SIMULATOR_PASSWORD`

**Harta goala dupa seed**
- Normal: seed-ul nu mai creeaza vehicule. Adauga vehicule din Flota, apoi porneste simulatorul.

**Oras necunoscut la simulator**
- Momentan suportate: Bucuresti, Cluj-Napoca (din campul `city` al agentiei). Alte orase sunt sarite cu warning in log.

**Harta nu se actualizeaza**
- Verifica ca simulatorul ruleaza si nu da erori
- Deschide Network tab → WS → trebuie sa vezi conexiune `socket.io`
- Daca tabela de erori vine cu 403 pe `/telemetry/ingest`: re-login cu admin (NU cu manager) la simulator

**Erori "Cannot find module react-leaflet"**
- Rulat `npm install` din radacina dupa pull

**Migratia esueaza cu "shadow database"**
- Asigura-te ca utilizatorul DB are drepturi CREATE (in Docker: `ssm_user` are deja)

**Vehiculele apar OFFLINE imediat**
- Threshold-ul e 5 min. Daca simulatorul a fost oprit > 5 min, pozitiile sunt valide dar marcate offline. Reporneste simulatorul.

---

## 10. Reset complet baza de date (daca ai probleme)

```bash
cd apps/api
npx prisma migrate reset
```
Confirma cu **y**. Asta sterge TOATE datele + reruleaza toate migratiile + ruleaza seed automat.
