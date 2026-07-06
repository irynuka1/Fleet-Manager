import type { LatLng, RoutePath } from './types';

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function bearing(a: LatLng, b: LatLng): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export function createRoutePath(points: LatLng[]): RoutePath {
  if (points.length < 2) {
    throw new Error('Route path needs at least 2 points');
  }

  const cumulativeDistances = [0];
  for (let i = 1; i < points.length; i++) {
    cumulativeDistances.push(
      cumulativeDistances[i - 1] + haversineMeters(points[i - 1], points[i]),
    );
  }

  return {
    points,
    cumulativeDistances,
    totalDistance: cumulativeDistances[cumulativeDistances.length - 1],
  };
}

/**
 * Returns position and heading at a given distance (meters) along the path.
 */
export function sampleAtDistance(
  path: RoutePath,
  distanceMeters: number,
): { position: LatLng; heading: number; atEnd: boolean } {
  if (distanceMeters >= path.totalDistance) {
    const last = path.points[path.points.length - 1];
    const prev = path.points[path.points.length - 2];
    return { position: last, heading: bearing(prev, last), atEnd: true };
  }

  if (distanceMeters <= 0) {
    const first = path.points[0];
    const next = path.points[1];
    return { position: first, heading: bearing(first, next), atEnd: false };
  }

  let lo = 0;
  let hi = path.cumulativeDistances.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (path.cumulativeDistances[mid] <= distanceMeters) lo = mid;
    else hi = mid;
  }

  const segStart = path.points[lo];
  const segEnd = path.points[lo + 1];
  const segLen = path.cumulativeDistances[lo + 1] - path.cumulativeDistances[lo];
  const t = segLen > 0 ? (distanceMeters - path.cumulativeDistances[lo]) / segLen : 0;

  const position: LatLng = {
    lat: segStart.lat + (segEnd.lat - segStart.lat) * t,
    lng: segStart.lng + (segEnd.lng - segStart.lng) * t,
  };

  return {
    position,
    heading: bearing(segStart, segEnd),
    atEnd: false,
  };
}

/** Distance travelled in one tick at given speed (km/h) and interval (ms). */
export function metersPerTick(speedKmh: number, intervalMs: number): number {
  return (speedKmh * 1000 * intervalMs) / 3_600_000;
}
