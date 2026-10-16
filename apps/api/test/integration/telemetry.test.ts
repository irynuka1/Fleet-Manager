import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/database';
import {
  bearer, createAgency, createCategory, createUser, createVehicle, login, resetDatabase,
} from '../helpers/factories';

let admin: string;
let managerA: string;
let managerB: string;
let vehicleA: { id: string };

beforeEach(async () => {
  await resetDatabase();
  const a = await createAgency();
  const b = await createAgency();
  const cat = await createCategory();
  admin = (await login((await createUser('SUPER_ADMIN')).email)).token;
  managerA = (await login((await createUser('AGENCY_MANAGER', a.id)).email)).token;
  managerB = (await login((await createUser('AGENCY_MANAGER', b.id)).email)).token;
  vehicleA = await createVehicle(a.id, cat.id);
});

const ping = (over: Record<string, unknown> = {}) => ({
  vehicleId: vehicleA.id, lat: 44.43, lng: 26.1, speed: 40, heading: 90, ...over,
});

describe('POST /api/telemetry/ingest', () => {
  it('is restricted to super admins', async () => {
    expect((await request(app).post('/api/telemetry/ingest').set(bearer(managerA)).send(ping())).status).toBe(403);
    expect((await request(app).post('/api/telemetry/ingest').send(ping())).status).toBe(401);
  });

  it('writes history and upserts a single live row per vehicle', async () => {
    for (const lat of [44.1, 44.2, 44.3]) {
      const res = await request(app).post('/api/telemetry/ingest').set(bearer(admin)).send(ping({ lat }));
      expect(res.status).toBe(201);
    }
    expect(await prisma.telemetryHistory.count()).toBe(3);
    const live = await prisma.telemetryLive.findMany();
    expect(live).toHaveLength(1);
    expect(live[0].lat).toBe(44.3);
  });

  it.each([
    ['latitude out of range', { lat: 91 }],
    ['longitude out of range', { lng: -181 }],
    ['heading >= 360', { heading: 360 }],
    ['non-uuid vehicle', { vehicleId: 'abc' }],
  ])('rejects %s', async (_l, over) => {
    const res = await request(app).post('/api/telemetry/ingest').set(bearer(admin)).send(ping(over));
    expect(res.status).toBe(400);
  });

  it('404s for an unknown vehicle', async () => {
    const res = await request(app)
      .post('/api/telemetry/ingest').set(bearer(admin))
      .send(ping({ vehicleId: '00000000-0000-4000-8000-000000000000' }));
    expect(res.status).toBe(404);
  });
});

describe('telemetry reads', () => {
  beforeEach(async () => {
    await request(app).post('/api/telemetry/ingest').set(bearer(admin)).send(ping());
  });

  it('scopes live positions to the manager’s agency', async () => {
    const mine = await request(app).get('/api/telemetry/live').set(bearer(managerA));
    const theirs = await request(app).get('/api/telemetry/live').set(bearer(managerB));
    expect(mine.body.data).toHaveLength(1);
    expect(theirs.body.data).toHaveLength(0);
  });

  it('protects history per agency', async () => {
    const ok = await request(app).get(`/api/telemetry/${vehicleA.id}/history`).set(bearer(managerA));
    expect(ok.status).toBe(200);
    expect(ok.body.data).toHaveLength(1);
    const denied = await request(app).get(`/api/telemetry/${vehicleA.id}/history`).set(bearer(managerB));
    expect(denied.status).toBe(403);
  });

  it('validates history query params and honours the limit', async () => {
    const url = `/api/telemetry/${vehicleA.id}/history`;
    expect((await request(app).get(`${url}?from=garbage`).set(bearer(admin))).status).toBe(400);
    expect((await request(app).get(`${url}?limit=999999`).set(bearer(admin))).status).toBe(400);

    await request(app).post('/api/telemetry/ingest').set(bearer(admin)).send(ping({ lat: 44.5 }));
    const limited = await request(app).get(`${url}?limit=1`).set(bearer(admin));
    expect(limited.body.data).toHaveLength(1);
    expect(limited.body.truncated).toBe(true);
  });
});
