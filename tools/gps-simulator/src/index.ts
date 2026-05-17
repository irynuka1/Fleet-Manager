import axios from 'axios';
import { bucharestRoute, clujRoute, positionOnRoute, heading, Route } from './routes';

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const ADMIN_EMAIL = process.env.SIMULATOR_EMAIL || 'admin@omnikininetix.ro';
const ADMIN_PASSWORD = process.env.SIMULATOR_PASSWORD || 'admin123';
const PING_INTERVAL_MS = 5000;
const VEHICLE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const PROGRESS_STEP = 0.005; // ~0.5% of route per ping

interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
  agencyId: string;
  agency?: { name: string };
}

interface SimulatedVehicle {
  vehicle: Vehicle;
  route: Route;
  progress: number;
}

async function login(): Promise<string> {
  const { data } = await axios.post(`${API_URL}/auth/login`, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  return data.data.accessToken;
}

// Serialize concurrent login attempts so a 401 storm doesn't trigger
// a thundering herd of /auth/login requests.
let refreshPromise: Promise<string> | null = null;

async function refreshToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = login().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function fetchVehicles(token: string): Promise<Vehicle[]> {
  const { data } = await axios.get(`${API_URL}/vehicles`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 100 },
  });
  return data.data;
}

async function sendPing(token: string, payload: {
  vehicleId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
}): Promise<void> {
  await axios.post(`${API_URL}/telemetry/ingest`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function pickRoute(vehicle: Vehicle): Route {
  // Heuristic: name of agency contains "Cluj" -> Cluj route, else Bucuresti.
  const agencyName = (vehicle.agency?.name ?? '').toLowerCase();
  if (agencyName.includes('cluj')) return clujRoute;
  return bucharestRoute;
}

async function main() {
  console.log('[GPS Simulator] Pornire...');
  console.log(`[GPS Simulator] API: ${API_URL}`);

  let token: string;
  try {
    token = await login();
    console.log('[GPS Simulator] Autentificare reusita');
  } catch (err: any) {
    console.error('[GPS Simulator] Esec autentificare:', err.response?.data?.error || err.message);
    process.exit(1);
  }

  let vehicles: Vehicle[];
  try {
    vehicles = await fetchVehicles(token);
    console.log(`[GPS Simulator] ${vehicles.length} vehicule incarcate`);
  } catch (err: any) {
    console.error('[GPS Simulator] Esec incarcare vehicule:', err.response?.data?.error || err.message);
    process.exit(1);
  }

  if (vehicles.length === 0) {
    console.log('[GPS Simulator] Niciun vehicul de simulat. Iesire.');
    return;
  }

  // Initialize simulated vehicles with random starting progress
  const simulated: SimulatedVehicle[] = vehicles.map((v) => ({
    vehicle: v,
    route: pickRoute(v),
    progress: Math.random(),
  }));

  let tickCount = 0;
  const tick = async () => {
    tickCount++;
    const promises = simulated.map(async (sim) => {
      const prevPos = positionOnRoute(sim.route, sim.progress);
      sim.progress += PROGRESS_STEP;
      const nextPos = positionOnRoute(sim.route, sim.progress);
      const dir = heading(prevPos, nextPos);
      // Random realistic speed: 20-70 km/h with small variation
      const speed = 30 + Math.random() * 35;

      try {
        await sendPing(token, {
          vehicleId: sim.vehicle.id,
          lat: nextPos.lat,
          lng: nextPos.lng,
          speed: Math.round(speed * 10) / 10,
          heading: Math.round(dir),
        });
      } catch (err: any) {
        // Retry login if 401 — serialized so concurrent failures share one login.
        if (err.response?.status === 401) {
          try {
            token = await refreshToken();
            console.log('[GPS Simulator] Token refresh');
          } catch {
            // ignore
          }
        }
      }
    });
    await Promise.allSettled(promises);
    if (tickCount % 6 === 0) {
      // log every ~30s
      console.log(`[GPS Simulator] Tick ${tickCount}: ${simulated.length} vehicule actualizate`);
    }
  };

  // Initial tick + interval
  await tick();
  setInterval(tick, PING_INTERVAL_MS);

  // Periodically refresh the vehicle list so newly-created vehicles get
  // simulated automatically and deleted ones stop being pinged.
  setInterval(async () => {
    try {
      const fresh = await fetchVehicles(token);

      // Add new vehicles
      for (const v of fresh) {
        if (!simulated.find((s) => s.vehicle.id === v.id)) {
          simulated.push({ vehicle: v, route: pickRoute(v), progress: Math.random() });
        }
      }

      // Remove deleted vehicles
      const freshIds = new Set(fresh.map((v) => v.id));
      for (let i = simulated.length - 1; i >= 0; i--) {
        if (!freshIds.has(simulated[i].vehicle.id)) {
          simulated.splice(i, 1);
        }
      }
    } catch (err: any) {
      // If the refresh failed because of 401, refresh the token serialized.
      if (err.response?.status === 401) {
        try {
          token = await refreshToken();
        } catch {
          // ignore
        }
      } else {
        console.error('[GPS Simulator] Failed to refresh vehicle list:', err.message || err);
      }
    }
  }, VEHICLE_REFRESH_INTERVAL_MS);

  console.log(`[GPS Simulator] Ruleaza ping-uri la fiecare ${PING_INTERVAL_MS / 1000}s. Ctrl+C pentru oprire.`);
}

main().catch((err) => {
  console.error('[GPS Simulator] Eroare neasteptata:', err);
  process.exit(1);
});
