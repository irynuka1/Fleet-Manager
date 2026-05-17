/**
 * Realistic GPS routes through major Romanian cities.
 * Each route is a list of waypoints; the simulator interpolates between them.
 */

export interface Waypoint {
  lat: number;
  lng: number;
}

export interface Route {
  name: string;
  waypoints: Waypoint[];
}

// Bucuresti: Piata Unirii -> Piata Victoriei -> Universitate -> Piata Unirii (loop)
export const bucharestRoute: Route = {
  name: 'Bucuresti centru',
  waypoints: [
    { lat: 44.4275, lng: 26.1025 }, // Piata Unirii
    { lat: 44.4321, lng: 26.0974 }, // Bd. Brătianu
    { lat: 44.4378, lng: 26.0976 }, // Piata Universitatii
    { lat: 44.4444, lng: 26.0921 }, // Piata Romana
    { lat: 44.4517, lng: 26.0863 }, // Piata Victoriei
    { lat: 44.4470, lng: 26.0905 }, // back
    { lat: 44.4400, lng: 26.0950 },
    { lat: 44.4350, lng: 26.0990 },
    { lat: 44.4275, lng: 26.1025 }, // close loop
  ],
};

// Cluj-Napoca: Piata Unirii -> Strada Memorandumului -> Manastur -> Piata Avram Iancu (loop)
export const clujRoute: Route = {
  name: 'Cluj centru',
  waypoints: [
    { lat: 46.7700, lng: 23.5900 }, // Piata Unirii
    { lat: 46.7693, lng: 23.5847 }, // Memorandumului
    { lat: 46.7669, lng: 23.5780 }, // Bd. Eroilor
    { lat: 46.7625, lng: 23.5680 }, // Manastur direction
    { lat: 46.7654, lng: 23.5800 },
    { lat: 46.7711, lng: 23.5950 }, // Avram Iancu
    { lat: 46.7720, lng: 23.5930 },
    { lat: 46.7700, lng: 23.5900 }, // close loop
  ],
};

/**
 * Linear interpolation between two waypoints.
 */
export function interpolate(a: Waypoint, b: Waypoint, t: number): Waypoint {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

/**
 * Calculates the position along a route at a given progress (0..1).
 * Wraps around if progress > 1.
 */
export function positionOnRoute(route: Route, progress: number): Waypoint {
  const wp = route.waypoints;
  const total = wp.length - 1;
  const p = (progress % 1) * total;
  const idx = Math.floor(p);
  const t = p - idx;
  return interpolate(wp[idx], wp[idx + 1] ?? wp[0], t);
}

/**
 * Approximate compass bearing between two points (0-360 degrees).
 */
export function heading(a: Waypoint, b: Waypoint): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = Math.atan2(y, x);
  return (((brng * 180) / Math.PI) + 360) % 360;
}
