import prisma from '../../config/database';
import { parsePagination } from '../../utils/pagination';
import { CreateAgencyInput, UpdateAgencyInput } from './agencies.schema';
import { AppError } from '../../utils/AppError';

export const agenciesService = {
  async list(query: { page?: number; limit?: number; search?: string }) {
    const { page, limit: cappedLimit, skip } = parsePagination(query);

    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.agency.findMany({
        where,
        skip,
        take: cappedLimit,
        include: {
          _count: {
            select: {
              vehicles: true,
              users: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agency.count({ where }),
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
    const agency = await prisma.agency.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            agencyId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        vehicles: true,
        _count: {
          select: {
            vehicles: true,
            users: true,
          },
        },
      },
    });

    return agency;
  },

  async create(data: CreateAgencyInput) {
    return prisma.agency.create({ data });
  },

  async update(id: string, data: UpdateAgencyInput) {
    return prisma.agency.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    const [vehicleCount, driverCount, userCount] = await Promise.all([
      prisma.vehicle.count({ where: { agencyId: id } }),
      prisma.driver.count({ where: { agencyId: id } }),
      prisma.user.count({ where: { agencyId: id } }),
    ]);

    if (vehicleCount > 0 || driverCount > 0 || userCount > 0) {
      throw new AppError('Nu se poate sterge agentia - are vehicule, soferi sau utilizatori asociati', 409);
    }

    return prisma.agency.delete({ where: { id } });
  },
};
