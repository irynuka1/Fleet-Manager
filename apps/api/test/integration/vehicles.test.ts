import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../../src/app';
import prisma from '../../src/config/database';
import {
  bearer, createAgency, createCategory, createUser, createVehicle, login, resetDatabase,
} from '../helpers/factories';

let token: string;
let agencyId: string;
let categoryId: string;

const PDF = Buffer.from('%PDF-1.4 test');

beforeEach(async () => {
  await resetDatabase();
  const agency = await createAgency();
  agencyId = agency.id;
  categoryId = (await createCategory()).id;
  token = (await login((await createUser('AGENCY_MANAGER', agencyId)).email)).token;
});

const payload = (over: Record<string, unknown> = {}) => ({
  name: 'Excavator', plateNumber: 'CJ-01-ABC', categoryId, agencyId,
  monitoringType: 'HOURS', ...over,
});

describe('vehicle CRUD & validation', () => {
  it('accepts plain YYYY-MM-DD dates', async () => {
    const res = await request(app)
      .post('/api/vehicles')
      .set(bearer(token))
      .send(payload({ itpExpiryDate: '2030-06-01', rcaExpiryDate: '' }));
    expect(res.status).toBe(201);
    expect(new Date(res.body.data.itpExpiryDate).toISOString().slice(0, 10)).toBe('2030-06-01');
    expect(res.body.data.rcaExpiryDate).toBeNull();
  });

  it.each([
    ['invalid date', { itpExpiryDate: 'tomorrow-ish' }],
    ['negative km', { currentKm: -5 }],
    ['missing name', { name: '' }],
    ['bad category id', { categoryId: 'xyz' }],
  ])('returns 400 for %s', async (_label, over) => {
    const res = await request(app).post('/api/vehicles').set(bearer(token)).send(payload(over));
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate plate number', async () => {
    await request(app).post('/api/vehicles').set(bearer(token)).send(payload());
    const dup = await request(app).post('/api/vehicles').set(bearer(token)).send(payload());
    expect(dup.status).toBe(409);
  });

  it('survives garbage pagination parameters', async () => {
    const res = await request(app).get('/api/vehicles?page=abc&limit=-3').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 10 });
  });
});

describe('vehicle documents', () => {
  it('uploads a PDF, syncs ITP expiry onto the vehicle and serves it back to the owner', async () => {
    const vehicle = await createVehicle(agencyId, categoryId);
    const up = await request(app)
      .post(`/api/vehicles/${vehicle.id}/documents`)
      .set(bearer(token))
      .field('type', 'ITP')
      .field('expiryDate', '2031-02-03')
      .attach('file', PDF, { filename: 'itp.pdf', contentType: 'application/pdf' });
    expect(up.status).toBe(201);

    const updated = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    expect(updated.itpExpiryDate?.toISOString().slice(0, 10)).toBe('2031-02-03');

    const file = await request(app)
      .get(`/api/uploads/${path.basename(up.body.data.filePath)}`)
      .set(bearer(token));
    expect(file.status).toBe(200);
  });

  it('rejects a disguised file (image MIME, .html extension) with 400', async () => {
    const vehicle = await createVehicle(agencyId, categoryId);
    const res = await request(app)
      .post(`/api/vehicles/${vehicle.id}/documents`)
      .set(bearer(token))
      .field('type', 'OTHER')
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'x.html', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });

  it('rejects files over MAX_FILE_SIZE with 413', async () => {
    const vehicle = await createVehicle(agencyId, categoryId);
    const res = await request(app)
      .post(`/api/vehicles/${vehicle.id}/documents`)
      .set(bearer(token))
      .field('type', 'OTHER')
      .attach('file', Buffer.alloc(1_048_576 + 10), { filename: 'big.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(413);
  });

  it('removes document files from disk when the vehicle is deleted', async () => {
    const vehicle = await createVehicle(agencyId, categoryId);
    const up = await request(app)
      .post(`/api/vehicles/${vehicle.id}/documents`)
      .set(bearer(token))
      .field('type', 'RCA')
      .attach('file', PDF, { filename: 'rca.pdf', contentType: 'application/pdf' });
    const filePath = path.resolve(up.body.data.filePath);
    expect(fs.existsSync(filePath)).toBe(true);

    const del = await request(app).delete(`/api/vehicles/${vehicle.id}`).set(bearer(token));
    expect(del.status).toBe(200);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

describe('uploads access control', () => {
  it('denies anonymous and cross-agency access, blocks traversal', async () => {
    const vehicle = await createVehicle(agencyId, categoryId);
    const up = await request(app)
      .post(`/api/vehicles/${vehicle.id}/documents`)
      .set(bearer(token))
      .field('type', 'ITP')
      .attach('file', PDF, { filename: 'a.pdf', contentType: 'application/pdf' });
    const name = path.basename(up.body.data.filePath);

    expect((await request(app).get(`/api/uploads/${name}`)).status).toBe(401);

    const other = await createAgency();
    const otherToken = (await login((await createUser('AGENCY_MANAGER', other.id)).email)).token;
    expect((await request(app).get(`/api/uploads/${name}`).set(bearer(otherToken))).status).toBe(403);

    const traversal = await request(app).get('/api/uploads/..%2f..%2fpackage.json').set(bearer(token));
    expect([400, 404]).toContain(traversal.status);
  });
});
