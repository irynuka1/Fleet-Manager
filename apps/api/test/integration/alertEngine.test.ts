import { beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../src/config/database';
import { runAlertCheck } from '../../src/services/alertEngine';
import { createAgency, createCategory, createDriver, createVehicle, resetDatabase } from '../helpers/factories';

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);

let agencyId: string;
let categoryId: string;

beforeEach(async () => {
  await resetDatabase();
  agencyId = (await createAgency()).id;
  categoryId = (await createCategory()).id;
});

describe('runAlertCheck', () => {
  it('creates ITP and RCA alerts only for documents expiring within 30 days', async () => {
    await createVehicle(agencyId, categoryId, { itpExpiryDate: inDays(10), rcaExpiryDate: inDays(200) });
    expect(await runAlertCheck()).toBe(1);
    const [n] = await prisma.notification.findMany();
    expect(n.type).toBe('ITP_EXPIRING');
    expect(n.agencyId).toBe(agencyId);
  });

  it('flags already-expired documents', async () => {
    await createVehicle(agencyId, categoryId, { rcaExpiryDate: inDays(-5) });
    await runAlertCheck();
    const [n] = await prisma.notification.findMany();
    expect(n.type).toBe('RCA_EXPIRING');
    expect(n.message).toContain('expirat');
  });

  it('is idempotent inside the 7-day de-duplication window', async () => {
    await createVehicle(agencyId, categoryId, { itpExpiryDate: inDays(3) });
    expect(await runAlertCheck()).toBe(1);
    expect(await runAlertCheck()).toBe(0);
    expect(await prisma.notification.count()).toBe(1);
  });

  it('alerts again once the previous notification is older than 7 days', async () => {
    await createVehicle(agencyId, categoryId, { itpExpiryDate: inDays(3) });
    await runAlertCheck();
    await prisma.notification.updateMany({ data: { createdAt: inDays(-8) } });
    expect(await runAlertCheck()).toBe(1);
  });

  it('raises a revision alert within 1000 units of the threshold, per monitoring unit', async () => {
    await createVehicle(agencyId, categoryId, {
      monitoringType: 'HOURS', currentHours: 3_000, revisionThreshold: 5_000,
    });
    await createVehicle(agencyId, categoryId, {
      monitoringType: 'KILOMETERS', currentKm: 1_000, revisionThreshold: 50_000,
    });
    expect(await runAlertCheck()).toBe(0);

    const near = await createVehicle(agencyId, categoryId, {
      monitoringType: 'HOURS', currentHours: 4_500, revisionThreshold: 5_000,
    });
    expect(await runAlertCheck()).toBe(1);
    const [n] = await prisma.notification.findMany();
    expect(n.type).toBe('REVISION_DUE');
    expect(n.vehicleId).toBe(near.id);
    expect(n.message).toContain('h)');
  });

  it('alerts on expiring driver documents with the right type', async () => {
    const driver = await createDriver(agencyId);
    await prisma.driverDocument.createMany({
      data: [
        { driverId: driver.id, type: 'DRIVING_LICENSE', expiryDate: inDays(5) },
        { driverId: driver.id, type: 'MEDICAL_CERTIFICATE', expiryDate: inDays(5) },
      ],
    });
    expect(await runAlertCheck()).toBe(2);
    const types = (await prisma.notification.findMany()).map((n) => n.type).sort();
    expect(types).toEqual(['DRIVER_LICENSE_EXPIRING', 'DRIVER_MEDICAL_EXPIRING']);
  });
});
