import { fetchOsrmRoute } from './osrm';
import { createRoutePath } from './movement';
import {
  resolveCity,
  generateRandomStops,
  getStopProfile,
} from './cities';
import type { FleetVehicle, RoutePath } from './types';

const OSRM_DELAY_MS = Number(process.env.OSRM_DELAY_MS || 350);
const routeCache = new Map<string, RoutePath>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKey(city: string, category: string, stops: { lat: number; lng: number }[]): string {
  const stopsKey = stops.map((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`).join('|');
  return `${city}|${category}|${stopsKey}`;
}

let lastOsrmCall = 0;

async function throttledOsrmFetch(stops: { lat: number; lng: number }[]) {
  const elapsed = Date.now() - lastOsrmCall;
  if (elapsed < OSRM_DELAY_MS) {
    await sleep(OSRM_DELAY_MS - elapsed);
  }
  lastOsrmCall = Date.now();
  return fetchOsrmRoute(stops);
}

export interface GeneratedRoute {
  path: RoutePath;
  speedKmh: number;
  cityName: string;
}

export async function generateRouteForVehicle(
  vehicle: FleetVehicle,
): Promise<GeneratedRoute | null> {
  const cityField = vehicle.agency?.city ?? vehicle.agency?.name ?? '';
  const city = resolveCity(cityField);

  if (!city) {
    console.warn(
      `[GPS Simulator] Oras necunoscut pentru ${vehicle.name} (${vehicle.plateNumber}): "${cityField}" — sarit`,
    );
    return null;
  }

  const profile = getStopProfile(vehicle.category?.name);
  const stops = generateRandomStops(city, profile.stopCount);
  const key = cacheKey(city.name, vehicle.category?.name ?? 'default', stops);

  let path = routeCache.get(key);
  if (!path) {
    try {
      const osrmPoints = await throttledOsrmFetch(stops);
      path = createRoutePath(osrmPoints);
      routeCache.set(key, path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[GPS Simulator] OSRM esec pentru ${vehicle.plateNumber}: ${msg}`,
      );
      return null;
    }
  }

  const speedKmh =
    profile.speedKmh.min +
    Math.random() * (profile.speedKmh.max - profile.speedKmh.min);

  return {
    path,
    speedKmh: Math.round(speedKmh * 10) / 10,
    cityName: city.name,
  };
}
