import axios from 'axios';
import { getDepotPosition } from './cities';
import { metersPerTick, sampleAtDistance } from './movement';
import { generateRouteForVehicle } from './routeGenerator';
import type { FleetVehicle, RoutePath } from './types';
import { hasAssignedDriver } from './types';

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const ADMIN_EMAIL = process.env.SIMULATOR_EMAIL || 'admin@omnikininetix.ro';
const ADMIN_PASSWORD = process.env.SIMULATOR_PASSWORD || 'admin123';
const PING_INTERVAL_MS = 5000;
const VEHICLE_POLL_INTERVAL_MS = 60_000;

interface SimulatedVehicle {
  vehicle: FleetVehicle;
  path: RoutePath;
  distanceAlong: number;
  speedKmh: number;
  cityName: string;
}

const parkedVehicleIds = new Set<string>();

async function login(): Promise<string> {
  const { data } = await axios.post(`${API_URL}/auth/login`, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  return data.data.accessToken;
}

let refreshPromise: Promise<string> | null = null;

async function refreshToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = login().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function fetchVehicles(token: string): Promise<FleetVehicle[]> {
  const { data } = await axios.get(`${API_URL}/vehicles`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 100 },
  });
  return data.data;
}

async function sendPing(
  token: string,
  payload: {
    vehicleId: string;
    lat: number;
    lng: number;
    speed: number;
    heading: number;
  },
): Promise<void> {
  await axios.post(`${API_URL}/telemetry/ingest`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function sendParkedPing(token: string, vehicle: FleetVehicle): Promise<void> {
  const depot = getDepotPosition(vehicle.agency?.city ?? vehicle.agency?.name);
  if (!depot) {
    console.warn(
      `[GPS Simulator] Nu pot parca ${vehicle.plateNumber}: oras necunoscut`,
    );
    return;
  }

  try {
    await sendPing(token, {
      vehicleId: vehicle.id,
      lat: depot.lat,
      lng: depot.lng,
      speed: 0,
      heading: 0,
    });
    parkedVehicleIds.add(vehicle.id);
    console.log(
      `[GPS Simulator] ${vehicle.plateNumber} parcat (fara sofer) — ${depot.lat.toFixed(4)}, ${depot.lng.toFixed(4)}`,
    );
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      throw err;
    }
  }
}

async function initSimulatedVehicle(vehicle: FleetVehicle): Promise<SimulatedVehicle | null> {
  if (!hasAssignedDriver(vehicle)) {
    return null;
  }

  parkedVehicleIds.delete(vehicle.id);
  const route = await generateRouteForVehicle(vehicle);
  if (!route) return null;

  const startOffset = Math.random() * route.path.totalDistance * 0.8;
  console.log(
    `[GPS Simulator] Ruta OSRM: ${vehicle.name} (${vehicle.plateNumber}) — ${route.cityName}, ${(route.path.totalDistance / 1000).toFixed(1)} km`,
  );

  return {
    vehicle,
    path: route.path,
    distanceAlong: startOffset,
    speedKmh: route.speedKmh,
    cityName: route.cityName,
  };
}

async function regenerateRoute(sim: SimulatedVehicle): Promise<boolean> {
  const route = await generateRouteForVehicle(sim.vehicle);
  if (!route) return false;

  sim.path = route.path;
  sim.distanceAlong = 0;
  sim.speedKmh = route.speedKmh;
  sim.cityName = route.cityName;
  return true;
}

async function syncFleet(
  token: string,
  simulated: SimulatedVehicle[],
): Promise<void> {
  const fresh = await fetchVehicles(token);
  const freshIds = new Set(fresh.map((v) => v.id));

  for (const v of fresh) {
    const existing = simulated.find((s) => s.vehicle.id === v.id);

    if (!hasAssignedDriver(v)) {
      if (existing) {
        const idx = simulated.indexOf(existing);
        simulated.splice(idx, 1);
        console.log(
          `[GPS Simulator] Oprit traseu: ${v.plateNumber} (fara sofer asignat)`,
        );
      }
      if (!parkedVehicleIds.has(v.id)) {
        await sendParkedPing(token, v);
      }
      continue;
    }

    if (!existing) {
      const entry = await initSimulatedVehicle(v);
      if (entry) simulated.push(entry);
    } else {
      existing.vehicle = v;
    }
  }

  for (let i = simulated.length - 1; i >= 0; i--) {
    const sim = simulated[i];
    if (!freshIds.has(sim.vehicle.id)) {
      console.log(
        `[GPS Simulator] Vehicul scos din flota: ${sim.vehicle.plateNumber}`,
      );
      parkedVehicleIds.delete(sim.vehicle.id);
      simulated.splice(i, 1);
    }
  }

  for (const id of [...parkedVehicleIds]) {
    if (!freshIds.has(id)) parkedVehicleIds.delete(id);
  }
}

async function main() {
  console.log('[GPS Simulator] Pornire (OSRM + flota cu soferi)...');
  console.log(`[GPS Simulator] API: ${API_URL}`);

  let token: string;
  try {
    token = await login();
    console.log('[GPS Simulator] Autentificare reusita');
  } catch (err: unknown) {
    const message =
      axios.isAxiosError(err) && err.response?.data?.error
        ? String(err.response.data.error)
        : err instanceof Error
          ? err.message
          : String(err);
    console.error('[GPS Simulator] Esec autentificare:', message);
    process.exit(1);
  }

  const simulated: SimulatedVehicle[] = [];
  let tickCount = 0;
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  const startTicking = () => {
    if (tickTimer) return;
    tickTimer = setInterval(() => void tick(), PING_INTERVAL_MS);
  };

  const stopTicking = () => {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };

  const tick = async () => {
    if (simulated.length === 0) return;

    tickCount++;
    const stepMeters = (sim: SimulatedVehicle) =>
      metersPerTick(sim.speedKmh + (Math.random() - 0.5) * 4, PING_INTERVAL_MS);

    const promises = simulated.map(async (sim) => {
      if (!hasAssignedDriver(sim.vehicle)) return;

      sim.distanceAlong += stepMeters(sim);
      let sample = sampleAtDistance(sim.path, sim.distanceAlong);

      if (sample.atEnd) {
        const ok = await regenerateRoute(sim);
        if (!ok) return;
        sample = sampleAtDistance(sim.path, 0);
        sim.distanceAlong = stepMeters(sim);
        sample = sampleAtDistance(sim.path, sim.distanceAlong);
      }

      try {
        await sendPing(token, {
          vehicleId: sim.vehicle.id,
          lat: sample.position.lat,
          lng: sample.position.lng,
          speed: sim.speedKmh,
          heading: Math.round(sample.heading),
        });
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
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
      console.log(
        `[GPS Simulator] Tick ${tickCount}: ${simulated.length} vehicule active (cu sofer)`,
      );
    }
  };

  const pollFleet = async () => {
    try {
      const activeBefore = simulated.length;
      await syncFleet(token, simulated);

      if (simulated.length === 0) {
        stopTicking();
        const fleet = await fetchVehicles(token);
        if (fleet.length === 0) {
          console.log('[GPS Simulator] Niciun vehicul in flota — astept...');
        } else {
          console.log(
            `[GPS Simulator] ${fleet.length} vehicule in flota, 0 cu soferi activi — astept...`,
          );
        }
        return;
      }

      if (activeBefore === 0 && simulated.length > 0) {
        console.log(`[GPS Simulator] ${simulated.length} vehicule cu soferi pe traseu`);
        await tick();
        startTicking();
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        try {
          token = await refreshToken();
        } catch {
          // ignore
        }
      } else {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[GPS Simulator] Esec refresh flota:', message);
      }
    }
  };

  await pollFleet();

  if (simulated.length > 0) {
    await tick();
    startTicking();
    console.log(
      `[GPS Simulator] Ping-uri la fiecare ${PING_INTERVAL_MS / 1000}s. Ctrl+C pentru oprire.`,
    );
  } else {
    console.log(
      `[GPS Simulator] Verificare flota la fiecare ${VEHICLE_POLL_INTERVAL_MS / 1000}s. Ctrl+C pentru oprire.`,
    );
  }

  setInterval(() => void pollFleet(), VEHICLE_POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error('[GPS Simulator] Eroare neasteptata:', err);
  process.exit(1);
});
