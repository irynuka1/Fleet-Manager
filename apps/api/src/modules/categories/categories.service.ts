import prisma from '../../config/database';
import { CreateCategoryInput, UpdateCategoryInput } from './categories.schema';
import { AppError } from '../../utils/AppError';

export const categoriesService = {
  async list() {
    return prisma.vehicleCategory.findMany({
      include: {
        _count: {
          select: {
            vehicles: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  },

  async getById(id: string) {
    return prisma.vehicleCategory.findUnique({
      where: { id },
      include: {
        vehicles: true,
      },
    });
  },

  async create(data: CreateCategoryInput) {
    return prisma.vehicleCategory.create({ data });
  },

  async update(id: string, data: UpdateCategoryInput) {
    return prisma.vehicleCategory.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    const vehicleCount = await prisma.vehicle.count({
      where: { categoryId: id },
    });

    if (vehicleCount > 0) {
      throw new AppError('Nu se poate sterge categoria - are vehicule asociate', 409);
    }

    return prisma.vehicleCategory.delete({ where: { id } });
  },
};
