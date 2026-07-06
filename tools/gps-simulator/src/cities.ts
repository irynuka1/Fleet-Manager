import type { LatLng } from './types';

export interface CityConfig {
  name: string;
  aliases: string[];
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  hotspots: LatLng[];
}

const CITIES: CityConfig[] = [
  {
    name: 'Bucuresti',
    aliases: ['bucuresti', 'bucharest', 'bucurești'],
    bounds: { minLat: 44.33, maxLat: 44.55, minLng: 25.95, maxLng: 26.25 },
    hotspots: [
      { lat: 44.4275, lng: 26.1025 }, // Piata Unirii
      { lat: 44.4517, lng: 26.0863 }, // Piata Victoriei
      { lat: 44.4378, lng: 26.0976 }, // Universitate
      { lat: 44.4095, lng: 26.1245 }, // Titan
      { lat: 44.4782, lng: 26.1028 }, // Baneasa
      { lat: 44.3852, lng: 26.1189 }, // Sun Plaza / Berceni
      { lat: 44.4425, lng: 26.1523 }, // Pipera
      { lat: 44.4156, lng: 26.0432 }, // Militari
      { lat: 44.4567, lng: 26.0712 }, // Floreasca
      { lat: 44.3998, lng: 26.0876 }, // Rahova
      { lat: 44.4634, lng: 26.1289 }, // Otopeni area
      { lat: 44.4312, lng: 26.0543 }, // Drumul Taberei
    ],
  },
  {
    name: 'Cluj-Napoca',
    aliases: ['cluj-napoca', 'cluj', 'cluj napoca'],
    bounds: { minLat: 46.72, maxLat: 46.82, minLng: 23.52, maxLng: 23.65 },
    hotspots: [
      { lat: 46.7700, lng: 23.5900 }, // Piata Unirii
      { lat: 46.7711, lng: 23.5950 }, // Piata Avram Iancu
      { lat: 46.7693, lng: 23.5847 }, // Memorandumului
      { lat: 46.7625, lng: 23.5680 }, // Manastur
      { lat: 46.7789, lng: 23.6012 }, // Marasti
      { lat: 46.7543, lng: 23.5921 }, // Gheorgheni
      { lat: 46.7834, lng: 23.6234 }, // Iulius Mall area
      { lat: 46.7456, lng: 23.5512 }, // Baciu / industrial
      { lat: 46.7654, lng: 23.6102 }, // Zorilor
      { lat: 46.7589, lng: 23.5789 }, // Grigorescu
    ],
  },
];

function normalizeCity(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function resolveCity(cityOrAgencyName: string | undefined): CityConfig | null {
  if (!cityOrAgencyName) return null;
  const normalized = normalizeCity(cityOrAgencyName);

  for (const city of CITIES) {
    if (city.aliases.some((a) => normalized.includes(a) || a.includes(normalized))) {
      return city;
    }
    if (normalized.includes(normalizeCity(city.name))) {
      return city;
    }
  }
  return null;
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickRandomHotspots(city: CityConfig, count: number): LatLng[] {
  const pool = [...city.hotspots];
  const stops: LatLng[] = [];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    stops.push(pool.splice(idx, 1)[0]);
  }

  // If we need more stops than hotspots, add jittered points inside bounds
  while (stops.length < count) {
    stops.push({
      lat: randomInRange(city.bounds.minLat, city.bounds.maxLat),
      lng: randomInRange(city.bounds.minLng, city.bounds.maxLng),
    });
  }

  return stops;
}

export interface StopProfile {
  stopCount: number;
  speedKmh: { min: number; max: number };
}

export function getStopProfile(categoryName: string | undefined): StopProfile {
  const cat = (categoryName ?? '').toLowerCase();

  if (cat.includes('dube') || cat.includes('transport')) {
    return { stopCount: 5 + Math.floor(Math.random() * 3), speedKmh: { min: 25, max: 55 } };
  }
  if (cat.includes('masini') || cat.includes('angajat')) {
    return { stopCount: 3 + Math.floor(Math.random() * 2), speedKmh: { min: 20, max: 45 } };
  }
  if (cat.includes('utilaj')) {
    return { stopCount: 2 + Math.floor(Math.random() * 2), speedKmh: { min: 8, max: 25 } };
  }
  return { stopCount: 4 + Math.floor(Math.random() * 2), speedKmh: { min: 25, max: 50 } };
}

export function getDepotPosition(cityOrAgencyName: string | undefined): LatLng | null {
  const city = resolveCity(cityOrAgencyName ?? '');
  if (!city || city.hotspots.length === 0) return null;
  return city.hotspots[0];
}

export function generateRandomStops(city: CityConfig, stopCount: number): LatLng[] {
  const stops = pickRandomHotspots(city, stopCount);
  // Loop back to depot (first stop) for continuous delivery simulation
  return [...stops, stops[0]];
}
