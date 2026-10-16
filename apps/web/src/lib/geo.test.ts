import { describe, expect, it } from 'vitest';
import {
  bearing, buildCumulativeDistances, depotForCity, haversineMeters, samplePointAtProgress,
} from './geo';

const A = { lat: 44.4275, lng: 26.1025 }; // Bucuresti
const B = { lat: 46.77, lng: 23.59 }; // Cluj

describe('haversineMeters', () => {
  it('is 0 for identical points and symmetric', () => {
    expect(haversineMeters(A, A)).toBe(0);
    expect(haversineMeters(A, B)).toBeCloseTo(haversineMeters(B, A), 6);
  });

  it('matches the known Bucuresti–Cluj distance (~325 km) within 2%', () => {
    const km = haversineMeters(A, B) / 1000;
    expect(km).toBeGreaterThan(318);
    expect(km).toBeLessThan(332);
  });
});

describe('bearing', () => {
  it.each([
    ['north', { lat: 1, lng: 0 }, 0],
    ['east', { lat: 0, lng: 1 }, 90],
    ['south', { lat: -1, lng: 0 }, 180],
    ['west', { lat: 0, lng: -1 }, 270],
  ])('points %s', (_n, to, expected) => {
    expect(bearing({ lat: 0, lng: 0 }, to)).toBeCloseTo(expected, 3);
  });
});

describe('route sampling', () => {
  const pts = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 1 },
    { lat: 0, lng: 2 },
  ];
  const cumulative = buildCumulativeDistances(pts);

  it('builds monotonically increasing cumulative distances starting at 0', () => {
    expect(cumulative[0]).toBe(0);
    expect(cumulative[1]).toBeGreaterThan(0);
    expect(cumulative[2]).toBeGreaterThan(cumulative[1]);
  });

  it('returns the first/last point at progress 0 / 1 and clamps out-of-range', () => {
    expect(samplePointAtProgress(pts, cumulative, 0).point).toBe(pts[0]);
    expect(samplePointAtProgress(pts, cumulative, 1).point).toBe(pts[2]);
    expect(samplePointAtProgress(pts, cumulative, 5).point).toBe(pts[2]);
    expect(samplePointAtProgress(pts, cumulative, -1).point).toBe(pts[0]);
  });

  it('interpolates inside a segment', () => {
    const { point, next, fraction } = samplePointAtProgress(pts, cumulative, 0.75);
    expect(point).toBe(pts[1]);
    expect(next).toBe(pts[2]);
    expect(fraction).toBeCloseTo(0.5, 2);
  });

  it('handles single point and rejects empty input', () => {
    const one = [{ lat: 1, lng: 1 }];
    expect(samplePointAtProgress(one, buildCumulativeDistances(one), 0.5).fraction).toBe(0);
    expect(() => samplePointAtProgress([], [], 0)).toThrow();
  });
});

describe('depotForCity', () => {
  it('matches cities ignoring case and diacritics, with a default fallback', () => {
    expect(depotForCity('CLUJ-Napoca').lat).toBeCloseTo(46.77);
    expect(depotForCity('București').lat).toBeCloseTo(44.4275);
    expect(depotForCity('Atlantis')).toEqual(depotForCity(null));
  });
});
