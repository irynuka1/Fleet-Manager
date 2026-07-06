import axios from 'axios';
import type { LatLng } from './types';

const DEFAULT_OSRM_URL = 'https://router.project-osrm.org';

export function getOsrmBaseUrl(): string {
  return (process.env.OSRM_URL || DEFAULT_OSRM_URL).replace(/\/$/, '');
}

interface OsrmRouteResponse {
  code: string;
  routes?: Array<{
    geometry: {
      coordinates: [number, number][];
    };
  }>;
}

/**
 * Fetches a driving route through OSRM. Coordinates in the response are
 * GeoJSON order [lng, lat]; we convert to { lat, lng }.
 */
export async function fetchOsrmRoute(stops: LatLng[]): Promise<LatLng[]> {
  if (stops.length < 2) {
    throw new Error('OSRM route needs at least 2 stops');
  }

  const coordStr = stops.map((s) => `${s.lng},${s.lat}`).join(';');
  const url = `${getOsrmBaseUrl()}/route/v1/driving/${coordStr}`;

  const { data } = await axios.get<OsrmRouteResponse>(url, {
    params: { overview: 'full', geometries: 'geojson', steps: false },
    timeout: 30_000,
  });

  if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates?.length) {
    throw new Error(`OSRM returned no route (code: ${data.code})`);
  }

  return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
}
