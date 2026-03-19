import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { CreateUserInput, UpdateUserInput } from './users.schema';
import { AppError } from '../../utils/AppError';

interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export class UsersService {
  static async list(query: ListQuery) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const cappedLimit = Math.min(limit, 100);
    const skip = (page - 1) * cappedLimit;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: cappedLimit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          agencyId: true,
          agency: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit: cappedLimit,
      totalPages: Math.ceil(total / cappedLimit),
    };
  }

  static async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        agencyId: true,
        agency: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('Utilizatorul nu a fost gasit', 404);
    }

    return user;
  }

  static async create(data: CreateUserInput) {
    if (data.role === 'AGENCY_MANAGER' && !data.agencyId) {
      throw new AppError('Manager de Agentie trebuie sa aiba o agentie asignata', 400);
    }
    if ((data.role === 'SUPER_ADMIN' || data.role === 'COUNTRY_MANAGER') && data.agencyId) {
      throw new AppError('Super Admin si Country Manager nu pot fi asignati unei agentii', 400);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        agencyId: true,
        agency: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  static async update(id: string, data: UpdateUserInput) {
    // Validate role-agency consistency
    if (data.role === 'AGENCY_MANAGER' && data.agencyId === undefined) {
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing?.agencyId) {
        throw new AppError('Manager de Agentie trebuie sa aiba o agentie asignata', 400);
      }
    }
    if (data.role === 'AGENCY_MANAGER' && data.agencyId === null) {
      throw new AppError('Manager de Agentie trebuie sa aiba o agentie asignata', 400);
    }
    if ((data.role === 'SUPER_ADMIN' || data.role === 'COUNTRY_MANAGER') && data.agencyId) {
      throw new AppError('Super Admin si Country Manager nu pot fi asignati unei agentii', 400);
    }
    // Force-clear agencyId when switching to a non-agency role
    if ((data.role === 'SUPER_ADMIN' || data.role === 'COUNTRY_MANAGER') && data.agencyId === undefined) {
      (data as any).agencyId = null;
    }

    const updateData: any = { ...data };

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        agencyId: true,
        agency: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  static async delete(id: string) {
    const user = await prisma.user.delete({
      where: { id },
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
    });

    return user;
  }
}
