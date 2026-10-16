import prisma from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { CreateDriverInput, UpdateDriverInput } from './drivers.schema';
import { AppError } from '../../utils/AppError';
import fs from 'fs';
import path from 'path';

export const driversService = {
  async list(query: {
    page?: number;
    limit?: number;
    search?: string;
    agencyId?: string;
  }) {
    const { page, limit: cappedLimit, skip } = parsePagination(query);

    const where: any = {};

    if (query.agencyId) {
      where.agencyId = query.agencyId;
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        skip,
        take: cappedLimit,
        include: {
          agency: true,
          documents: true,
          vehicles: {
            include: {
              vehicle: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.driver.count({ where }),
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
    return prisma.driver.findUnique({
      where: { id },
      include: {
        agency: true,
        documents: true,
        vehicles: {
          include: {
            vehicle: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });
  },

  async create(data: CreateDriverInput) {
    const agency = await prisma.agency.findUnique({ where: { id: data.agencyId } });
    if (!agency) throw new AppError('Agentia nu a fost gasita', 404);

    return prisma.driver.create({
      data,
      include: {
        agency: true,
      },
    });
  },

  async update(id: string, data: UpdateDriverInput) {
    return prisma.driver.update({
      where: { id },
      data,
      include: {
        agency: true,
      },
    });
  },

  async delete(id: string) {
    const driver = await prisma.driver.findUnique({ where: { id } });
    const documents = await prisma.driverDocument.findMany({
      where: { driverId: id },
    });

    const result = await prisma.driver.delete({ where: { id } });

    const pathsToDelete = [
      driver?.profilePhotoPath,
      ...documents.map((doc) => doc.filePath),
    ].filter(Boolean) as string[];

    for (const filePath of pathsToDelete) {
      try {
        fs.unlinkSync(path.resolve(filePath));
      } catch {
        // File may already be deleted, ignore
      }
    }

    return result;
  },

  async addDocument(
    driverId: string,
    data: { type: string; expiryDate?: string | Date | null; filePath?: string; fileName?: string },
  ) {
    const createData: any = {
      driverId,
      type: data.type,
      filePath: data.filePath || null,
      fileName: data.fileName || null,
    };

    if (data.expiryDate) {
      createData.expiryDate = new Date(data.expiryDate);
    }

    return prisma.driverDocument.create({
      data: createData,
    });
  },

  async deleteDocument(documentId: string) {
    const document = await prisma.driverDocument.findUnique({ where: { id: documentId } });
    // Delete DB record first, then clean up file
    const result = await prisma.driverDocument.delete({ where: { id: documentId } });

    if (document && document.filePath) {
      try {
        const resolvedPath = path.resolve(document.filePath);
        fs.unlinkSync(resolvedPath);
      } catch {
        // File may already be deleted, ignore
      }
    }

    return result;
  },

  async getDocument(documentId: string) {
    return prisma.driverDocument.findUnique({ where: { id: documentId } });
  },

  async updateProfilePhoto(
    driverId: string,
    data: { filePath: string; fileName: string },
  ) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new AppError('Soferul nu a fost gasit', 404);

    const oldPath = driver.profilePhotoPath;

    const updated = await prisma.driver.update({
      where: { id: driverId },
      data: {
        profilePhotoPath: data.filePath,
        profilePhotoName: data.fileName,
      },
      include: {
        agency: true,
        documents: true,
        vehicles: {
          include: {
            vehicle: true,
          },
        },
      },
    });

    if (oldPath) {
      try {
        fs.unlinkSync(path.resolve(oldPath));
      } catch {
        // ignore
      }
    }

    return updated;
  },

  async deleteProfilePhoto(driverId: string) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new AppError('Soferul nu a fost gasit', 404);

    const updated = await prisma.driver.update({
      where: { id: driverId },
      data: {
        profilePhotoPath: null,
        profilePhotoName: null,
      },
      include: {
        agency: true,
        documents: true,
        vehicles: {
          include: {
            vehicle: true,
          },
        },
      },
    });

    if (driver.profilePhotoPath) {
      try {
        fs.unlinkSync(path.resolve(driver.profilePhotoPath));
      } catch {
        // ignore
      }
    }

    return updated;
  },
};
