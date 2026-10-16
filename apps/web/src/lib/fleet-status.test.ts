import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCriticalAlerts, countOnlineOffline, getRevisionRemaining, isRevisionUrgent, isVehicleOnline,
  type DashboardDriver, type DashboardVehicle,
} from './fleet-status';

const NOW = new Date('2026-06-01T12:00:00Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

const vehicle = (over: Partial<DashboardVehicle> = {}): DashboardVehicle => ({
  id: 'v1', name: 'Truck', plateNumber: 'B-1', agencyId: 'a1', monitoringType: 'KILOMETERS',
  currentKm: 0, currentHours: null, revisionThreshold: null, itpExpiryDate: null, rcaExpiryDate: null,
  drivers: [], documents: [
    { type: 'ITP', expiryDate: inDays(365) },
    { type: 'RCA', expiryDate: inDays(365) },
    { type: 'REGISTRATION', expiryDate: null },
  ],
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('revision tracking', () => {
  it('computes the distance to the next multiple of the threshold', () => {
    expect(getRevisionRemaining(vehicle({ currentKm: 12_000, revisionThreshold: 5_000 }))).toBe(3_000);
    expect(getRevisionRemaining(vehicle({ currentKm: 0, revisionThreshold: 5_000 }))).toBe(5_000);
  });

  it('uses hours for HOURS vehicles and returns null without data', () => {
    const v = vehicle({ monitoringType: 'HOURS', currentHours: 480, revisionThreshold: 500 });
    expect(getRevisionRemaining(v)).toBe(20);
    expect(getRevisionRemaining(vehicle({ revisionThreshold: null }))).toBeNull();
    expect(getRevisionRemaining(vehicle({ currentKm: null, revisionThreshold: 5_000 }))).toBeNull();
  });

  it('flags urgency below 1000 units remaining', () => {
    expect(isRevisionUrgent(vehicle({ currentKm: 4_500, revisionThreshold: 5_000 }))).toBe(true);
    expect(isRevisionUrgent(vehicle({ currentKm: 1_000, revisionThreshold: 5_000 }))).toBe(false);
  });
});

describe('online status', () => {
  const fresh = { v1: { updatedAt: new Date(NOW.getTime() - 60_000).toISOString() } };
  const stale = { v1: { updatedAt: new Date(NOW.getTime() - 10 * 60_000).toISOString() } };

  it('is online only with a driver and a recent ping', () => {
    expect(isVehicleOnline('v1', true, fresh)).toBe(true);
    expect(isVehicleOnline('v1', true, stale)).toBe(false);
    expect(isVehicleOnline('v1', false, fresh)).toBe(false);
    expect(isVehicleOnline('v1', true, {})).toBe(false);
  });

  it('counts online/offline and respects the agency filter', () => {
    const vs = [
      vehicle({ id: 'v1', drivers: [{ driver: { id: 'd' } }] }),
      vehicle({ id: 'v2', agencyId: 'a2' }),
    ];
    expect(countOnlineOffline(vs, fresh)).toEqual({ online: 1, offline: 1, total: 2 });
    expect(countOnlineOffline(vs, fresh, 'a2')).toEqual({ online: 0, offline: 1, total: 1 });
  });
});

describe('buildCriticalAlerts', () => {
  const driver = (over: Partial<DashboardDriver> = {}): DashboardDriver => ({
    id: 'd1', firstName: 'Ion', lastName: 'Pop', agencyId: 'a1',
    documents: [
      { type: 'DRIVING_LICENSE', expiryDate: inDays(365) },
      { type: 'MEDICAL_CERTIFICATE', expiryDate: inDays(365) },
    ],
    ...over,
  });

  it('is empty for a fully compliant fleet', () => {
    expect(buildCriticalAlerts([vehicle()], [driver()])).toEqual([]);
  });

  it('reports missing required vehicle and driver documents as critical', () => {
    const alerts = buildCriticalAlerts([vehicle({ documents: [] })], [driver({ documents: [] })]);
    expect(alerts.filter((a) => a.title === 'Document lipsa')).toHaveLength(3);
    expect(alerts.filter((a) => a.title === 'Document sofer lipsa')).toHaveLength(2);
    expect(alerts.every((a) => a.severity === 'critical')).toBe(true);
  });

  it('distinguishes expiring (warning) from expired (critical) and sorts critical first', () => {
    const v = vehicle({
      documents: [
        { type: 'ITP', expiryDate: inDays(10) },
        { type: 'RCA', expiryDate: inDays(-3) },
        { type: 'REGISTRATION', expiryDate: null },
      ],
    });
    const alerts = buildCriticalAlerts([v], []);
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toMatchObject({ severity: 'critical', title: 'Document expirat' });
    expect(alerts[1]).toMatchObject({ severity: 'warning', title: 'Document expira curand' });
    expect(alerts[1].message).toContain('10 zile');
  });
});
