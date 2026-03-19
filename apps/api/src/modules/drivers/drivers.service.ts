import prisma from '../../config/database';
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
    const page = query.page || 1;
    const limit = query.limit || 10;
    const cappedLimit = Math.min(limit, 100);
    const skip = (page - 1) * cappedLimit;

    const where: any = {};

    if (query.agencyId) {
      where.agencyId = query.agencyId;
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
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
    // Fetch documents before deletion so we can clean up files after
    const documents = await prisma.driverDocument.findMany({
      where: { driverId: id },
    });

    // Delete DB first (cascade deletes documents), then clean up files
    const result = await prisma.driver.delete({ where: { id } });

    // Best-effort file cleanup after successful DB delete
    for (const doc of documents) {
      if (doc.filePath) {
        try {
          const resolvedPath = path.resolve(doc.filePath);
          fs.unlinkSync(resolvedPath);
        } catch {
          // File may already be deleted, ignore
        }
      }
    }

    return result;
  },

  async addDocument(
    driverId: string,
    data: { type: string; expiryDate?: string | null; filePath?: string; fileName?: string },
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
};
