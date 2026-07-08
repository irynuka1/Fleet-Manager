// Note: ensure Prisma Client is generated (e.g. npx prisma generate) to resolve IDE linting issues.
import prisma from '../../config/database';
import { CreateVehicleInput, UpdateVehicleInput } from './vehicles.schema';
import { AppError } from '../../utils/AppError';
import fs from 'fs';

export const vehiclesService = {
  async list(query: {
    page?: number;
    limit?: number;
    search?: string;
    agencyId?: string;
    categoryId?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const cappedLimit = Math.min(limit, 100);
    const skip = (page - 1) * cappedLimit;

    const where: any = {};

    if (query.agencyId) {
      where.agencyId = query.agencyId;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { plateNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take: cappedLimit,
        include: {
          category: true,
          agency: true,
          drivers: {
            include: {
              driver: {
                include: {
                  agency: true,
                },
              },
            },
          },
          // @ts-ignore (force IDE to ignore cache error)
          documents: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vehicle.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit: cappedLimit,
      totalPages: Math.ceil(total / cappedLimit),
    };
  },

  async getById(id: string) {
    return prisma.vehicle.findUnique({
      where: { id },
      include: {
        category: true,
        agency: true,
        drivers: {
          include: {
            driver: {
              include: {
                agency: true,
              },
            },
          },
        },
        // @ts-ignore (force IDE to ignore cache error)
        documents: true,
      },
    });
  },

  async create(data: CreateVehicleInput) {
    const agency = await prisma.agency.findUnique({ where: { id: data.agencyId } });
    if (!agency) throw new AppError('Agentia nu a fost gasita', 404);

    const createData: any = { ...data };

    return prisma.vehicle.create({
      data: createData,
      include: {
        category: true,
        agency: true,
      },
    });
  },

  async update(id: string, data: UpdateVehicleInput) {
    const updateData: any = { ...data };

    return prisma.vehicle.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        agency: true,
      },
    });
  },

  async delete(id: string) {
    return prisma.vehicle.delete({ where: { id } });
  },

  async assignDriver(vehicleId: string, driverId: string) {
    const existing = await prisma.driverVehicle.findUnique({
      where: {
        driverId_vehicleId: {
          driverId,
          vehicleId,
        },
      },
    });

    if (existing) {
      throw new AppError('Soferul este deja asignat', 409);
    }

    return prisma.driverVehicle.create({
      data: {
        driverId,
        vehicleId,
      },
      include: {
        driver: true,
        vehicle: true,
      },
    });
  },

  async unassignDriver(vehicleId: string, driverId: string) {
    return prisma.driverVehicle.delete({
      where: {
        driverId_vehicleId: {
          driverId,
          vehicleId,
        },
      },
    });
  },

  async listByCategory(agencyId?: string) {
    const where: any = {};
    if (agencyId) {
      where.agencyId = agencyId;
    }

    const categories = await prisma.vehicleCategory.findMany({
      include: {
        vehicles: {
          where,
          include: {
            agency: true,
            drivers: {
              include: {
                driver: {
                  include: {
                    agency: true,
                  },
                },
              },
            },
            // @ts-ignore (force IDE to ignore cache error)
            documents: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return categories.map((category) => ({
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
      },
      // @ts-ignore (force IDE to ignore cache error)
      vehicles: category.vehicles,
    }));
  },

  async getDocument(docId: string) {
    // @ts-ignore (force IDE to ignore cache error)
    return prisma.vehicleDocument.findUnique({
      where: { id: docId },
    });
  },

  async addDocument(
    vehicleId: string,
    data: {
      type: 'ITP' | 'RCA' | 'REGISTRATION' | 'INSURANCE' | 'OTHER';
      expiryDate: string | null;
      filePath?: string;
      fileName?: string;
    },
  ) {
    const createData: any = {
      vehicleId,
      type: data.type,
      filePath: data.filePath,
      fileName: data.fileName,
    };

    if (data.expiryDate) {
      createData.expiryDate = new Date(data.expiryDate);
    }

    // Wrap in transaction to keep vehicle dates and document in sync
    return prisma.$transaction(async (tx) => {
      // @ts-ignore
      const doc = await tx.vehicleDocument.create({ data: createData });

      // Auto-update vehicle ITP / RCA dates if applicable
      if (createData.expiryDate && (data.type === 'ITP' || data.type === 'RCA')) {
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: data.type === 'ITP'
            ? { itpExpiryDate: createData.expiryDate }
            : { rcaExpiryDate: createData.expiryDate },
        });
      }

      return doc;
    });
  },

  async deleteDocument(docId: string) {
    // @ts-ignore (force IDE to ignore cache error)
    const document = await prisma.vehicleDocument.delete({
      where: { id: docId },
    });

    if (document.filePath) {
      try {
        fs.unlinkSync(document.filePath);
      } catch (err) {
        console.error('Eroare la stergerea fisierului:', err);
      }
    }

    if (document.type === 'ITP' || document.type === 'RCA') {
      // @ts-ignore (force IDE to ignore cache error)
      const latestDoc = await prisma.vehicleDocument.findFirst({
        where: { vehicleId: document.vehicleId, type: document.type },
        orderBy: { expiryDate: 'desc' },
      });

      const newExpiry = latestDoc?.expiryDate || null;

      if (document.type === 'ITP') {
        await prisma.vehicle.update({
          where: { id: document.vehicleId },
          data: { itpExpiryDate: newExpiry },
        });
      } else if (document.type === 'RCA') {
        await prisma.vehicle.update({
          where: { id: document.vehicleId },
          data: { rcaExpiryDate: newExpiry },
        });
      }
    }

    return document;
  },
};
