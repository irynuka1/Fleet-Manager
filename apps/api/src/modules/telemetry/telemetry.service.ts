import prisma from '../../config/database';
import { AppError } from '../../utils/AppError';
import type { IngestInput } from './telemetry.schema';

export const telemetryService = {
  /**
   * Records a new GPS ping: writes to history + upserts live position.
   * Returns the live record with vehicle agency info (used by Socket.io broadcast).
   */
  async ingest(data: IngestInput) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: data.vehicleId },
      select: { id: true, agencyId: true, name: true, plateNumber: true },
    });
    if (!vehicle) {
      throw new AppError('Vehiculul nu a fost gasit', 404);
    }

    // Atomic: history insert (append-only) + live upsert (1 row per vehicle)
    const [, live] = await prisma.$transaction([
      prisma.telemetryHistory.create({
        data: {
          vehicleId: data.vehicleId,
          lat: data.lat,
          lng: data.lng,
          speed: data.speed ?? null,
          heading: data.heading ?? null,
        },
      }),
      prisma.telemetryLive.upsert({
        where: { vehicleId: data.vehicleId },
        create: {
          vehicleId: data.vehicleId,
          lat: data.lat,
          lng: data.lng,
          speed: data.speed ?? null,
          heading: data.heading ?? null,
        },
        update: {
          lat: data.lat,
          lng: data.lng,
          speed: data.speed ?? null,
          heading: data.heading ?? null,
        },
      }),
    ]);

    return { live, vehicle };
  },

  /**
   * Returns all live positions for given agency (or all if undefined).
   */
  async getLive(agencyId?: string) {
    const where = agencyId ? { vehicle: { agencyId } } : {};
    return prisma.telemetryLive.findMany({
      where,
      include: {
        vehicle: {
          select: {
            id: true,
            name: true,
            plateNumber: true,
            agencyId: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });
  },

  /**
   * History for a single vehicle, optionally filtered by time range.
   * Returns { data, truncated } so callers can warn when the limit was hit.
   */
  async getHistory(
    vehicleId: string,
    options: { from?: Date; to?: Date; limit?: number } = {},
  ) {
    const limit = Math.min(options.limit ?? 1000, 5000);
    const data = await prisma.telemetryHistory.findMany({
      where: {
        vehicleId,
        ...(options.from || options.to
          ? {
              createdAt: {
                ...(options.from ? { gte: options.from } : {}),
                ...(options.to ? { lte: options.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return { data, truncated: data.length === limit };
  },
};
