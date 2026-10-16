# GPS Simulator

Drives the live map with realistic traffic: it loads the fleet from the API, builds real street routes through [OSRM](https://project-osrm.org/), and posts a position for every vehicle every 5 seconds.

```bash
npm run simulator        # from the repo root
```

## Behaviour

- Only vehicles **with an assigned driver** are moved; others are reported parked at their agency's depot.
- Routes stay within the bounds of the agency's city (`src/cities.ts`: București, Cluj-Napoca, …).
- The fleet is re-polled every 60 s, so new vehicles appear without a restart.
- Re-authenticates automatically when the access token expires.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:3001/api` | API base URL |
| `SIMULATOR_EMAIL` | `admin@omnikinetix.ro` | Must be a **Super Admin** (ingest is restricted) |
| `SIMULATOR_PASSWORD` | `admin123` | |
| `OSRM_URL` | `https://router.project-osrm.org` | Use a self-hosted OSRM for large fleets |
| `OSRM_DELAY_MS` | `350` | Delay between OSRM requests (be polite to the demo server) |

> For development only — do not run against a production deployment with the demo credentials.
