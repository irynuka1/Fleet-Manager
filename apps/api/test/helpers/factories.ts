import bcrypt from 'bcryptjs';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import prisma from '../../src/config/database';
import app from '../../src/app';

export const PASSWORD = 'Passw0rd!test';
const HASH = bcrypt.hashSync(PASSWORD, 4); // low cost: tests only

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE notifications, telemetry_history, telemetry_live, driver_vehicles,
      driver_documents, vehicle_documents, refresh_tokens, drivers, vehicles,
      vehicle_categories, users, agencies RESTART IDENTITY CASCADE
  `);
}

export function createAgency(name = `Agency ${randomUUID().slice(0, 6)}`) {
  return prisma.agency.create({ data: { name, city: 'Bucuresti', address: 'Str. Test 1' } });
}

export function createCategory(name = `Cat ${randomUUID().slice(0, 6)}`) {
  return prisma.vehicleCategory.create({ data: { name } });
}

export function createUser(role: Role, agencyId: string | null = null) {
  return prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@test.ro`,
      password: HASH,
      firstName: 'Test',
      lastName: role,
      role,
      agencyId,
    },
  });
}

export function createVehicle(agencyId: string, categoryId: string, overrides: Record<string, unknown> = {}) {
  return prisma.vehicle.create({
    data: {
      name: 'Truck',
      plateNumber: `B-${randomUUID().slice(0, 6).toUpperCase()}`,
      agencyId,
      categoryId,
      monitoringType: 'KILOMETERS',
      ...overrides,
    },
  });
}

export function createDriver(agencyId: string, overrides: Record<string, unknown> = {}) {
  return prisma.driver.create({
    data: { firstName: 'Ion', lastName: 'Popescu', agencyId, ...overrides },
  });
}

/** Logs in through the real endpoint; returns the bearer token and refresh cookie. */
export async function login(email: string, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  return { token: res.body.data.accessToken as string, cookie, user: res.body.data.user };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
