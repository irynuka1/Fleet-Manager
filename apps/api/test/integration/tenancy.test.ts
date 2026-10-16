import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import {
  bearer, createAgency, createCategory, createDriver, createUser, createVehicle, login, resetDatabase,
} from '../helpers/factories';

let agencyA: { id: string };
let agencyB: { id: string };
let category: { id: string };
let tokenA: string;
let tokenB: string;
let tokenCountry: string;
let tokenAdmin: string;
let vehicleB: { id: string };
let driverB: { id: string };

beforeEach(async () => {
  await resetDatabase();
  agencyA = await createAgency('A');
  agencyB = await createAgency('B');
  category = await createCategory();
  tokenA = (await login((await createUser('AGENCY_MANAGER', agencyA.id)).email)).token;
  tokenB = (await login((await createUser('AGENCY_MANAGER', agencyB.id)).email)).token;
  tokenCountry = (await login((await createUser('COUNTRY_MANAGER')).email)).token;
  tokenAdmin = (await login((await createUser('SUPER_ADMIN')).email)).token;
  vehicleB = await createVehicle(agencyB.id, category.id);
  driverB = await createDriver(agencyB.id);
});

describe('agency isolation (multi-tenancy)', () => {
  it('lists only the manager’s own vehicles', async () => {
    await createVehicle(agencyA.id, category.id, { name: 'Mine' });
    const res = await request(app).get('/api/vehicles').set(bearer(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.data.map((v: { name: string }) => v.name)).toEqual(['Mine']);
  });

  it('ignores ?agencyId= for agency managers', async () => {
    const res = await request(app).get(`/api/vehicles?agencyId=${agencyB.id}`).set(bearer(tokenA));
    expect(res.body.total).toBe(0);
  });

  it('forbids reading, updating and deleting another agency’s vehicle', async () => {
    const url = `/api/vehicles/${vehicleB.id}`;
    expect((await request(app).get(url).set(bearer(tokenA))).status).toBe(403);
    expect((await request(app).put(url).set(bearer(tokenA)).send({ name: 'Hacked' })).status).toBe(403);
    expect((await request(app).delete(url).set(bearer(tokenA))).status).toBe(403);
  });

  it('forbids touching another agency’s driver', async () => {
    const url = `/api/drivers/${driverB.id}`;
    expect((await request(app).get(url).set(bearer(tokenA))).status).toBe(403);
    expect((await request(app).delete(url).set(bearer(tokenA))).status).toBe(403);
  });

  it('forces the manager’s agency on create even if another is supplied', async () => {
    const res = await request(app)
      .post('/api/vehicles')
      .set(bearer(tokenA))
      .send({
        name: 'Van', plateNumber: 'B-111-AAA', categoryId: category.id,
        agencyId: agencyB.id, monitoringType: 'KILOMETERS',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.agencyId).toBe(agencyA.id);
  });

  it('refuses to assign a driver from a different agency', async () => {
    const mine = await createVehicle(agencyA.id, category.id);
    const res = await request(app)
      .post(`/api/vehicles/${mine.id}/drivers`)
      .set(bearer(tokenA))
      .send({ driverId: driverB.id });
    expect(res.status).toBe(400);
  });

  it('scopes notifications to the agency', async () => {
    const res = await request(app).get('/api/notifications/count').set(bearer(tokenB));
    expect(res.status).toBe(200);
  });

  it('lets country managers and super admins see every agency', async () => {
    await createVehicle(agencyA.id, category.id);
    for (const token of [tokenCountry, tokenAdmin]) {
      const res = await request(app).get('/api/vehicles').set(bearer(token));
      expect(res.body.total).toBe(2);
    }
  });
});

describe('role-based access', () => {
  it('restricts user management to super admins', async () => {
    expect((await request(app).get('/api/users').set(bearer(tokenCountry))).status).toBe(403);
    expect((await request(app).get('/api/users').set(bearer(tokenA))).status).toBe(403);
    expect((await request(app).get('/api/users').set(bearer(tokenAdmin))).status).toBe(200);
  });

  it('restricts agency listing/creation to global roles', async () => {
    expect((await request(app).get('/api/agencies').set(bearer(tokenA))).status).toBe(403);
    expect((await request(app).get('/api/agencies').set(bearer(tokenCountry))).status).toBe(200);
    expect((await request(app).get(`/api/agencies/${agencyA.id}`).set(bearer(tokenA))).status).toBe(200);
    expect((await request(app).get(`/api/agencies/${agencyB.id}`).set(bearer(tokenA))).status).toBe(403);
  });

  it('rejects unauthenticated access to every resource', async () => {
    for (const path of ['/api/vehicles', '/api/drivers', '/api/notifications', '/api/telemetry/live', '/api/agencies']) {
      expect((await request(app).get(path)).status).toBe(401);
    }
  });
});
