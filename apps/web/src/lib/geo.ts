/** Depot coordinates for vehicles without live GPS (parked / no driver). */
const DEPOT_COORDS: { match: string[]; lat: number; lng: number }[] = [
  { match: ['bucuresti', 'bucharest'], lat: 44.4275, lng: 26.1025 },
  { match: ['cluj'], lat: 46.77, lng: 23.59 },
];

const DEFAULT_DEPOT = { lat: 44.4275, lng: 26.1025 };

export function depotForCity(cityOrAgency?: string | null): { lat: number; lng: number } {
  const normalized = (cityOrAgency ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const depot of DEPOT_COORDS) {
    if (depot.match.some((m) => normalized.includes(m))) {
      return { lat: depot.lat, lng: depot.lng };
    }
  }
  return DEFAULT_DEPOT;
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function buildCumulativeDistances(
  points: { lat: number; lng: number }[],
): number[] {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineMeters(points[i - 1], points[i]));
  }
  return cumulative;
}

export function samplePointAtProgress<T extends { lat: number; lng: number }>(
  points: T[],
  cumulativeDistances: number[],
  progress: number,
): { point: T; next: T; fraction: number } {
  if (points.length === 0) {
    throw new Error('No points');
  }
  if (points.length === 1) {
    return { point: points[0], next: points[0], fraction: 0 };
  }

  const total = cumulativeDistances[cumulativeDistances.length - 1];
  const clamped = Math.max(0, Math.min(1, progress));
  const target = total * clamped;

  if (target <= 0) {
    return { point: points[0], next: points[1], fraction: 0 };
  }
  if (target >= total) {
    const last = points.length - 1;
    return { point: points[last], next: points[last], fraction: 1 };
  }

  let lo = 0;
  let hi = cumulativeDistances.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (cumulativeDistances[mid] <= target) lo = mid;
    else hi = mid;
  }

  const segLen = cumulativeDistances[lo + 1] - cumulativeDistances[lo];
  const fraction = segLen > 0 ? (target - cumulativeDistances[lo]) / segLen : 0;
  return { point: points[lo], next: points[lo + 1], fraction };
}

export function bearing(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}
