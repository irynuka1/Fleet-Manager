import prisma from '../../config/database';

export const notificationsService = {
  async list(query: {
    page?: number;
    limit?: number;
    agencyId?: string;
    isRead?: boolean;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const cappedLimit = Math.min(limit, 100);
    const skip = (page - 1) * cappedLimit;

    const where: any = {};

    if (query.agencyId) {
      where.agencyId = query.agencyId;
    }

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: cappedLimit,
        include: {
          vehicle: { select: { name: true, plateNumber: true } },
          driver: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit: cappedLimit,
      totalPages: Math.ceil(total / cappedLimit),
    };
  },

  async getUnreadCount(agencyId?: string) {
    const where: any = { isRead: false };

    if (agencyId) {
      where.agencyId = agencyId;
    }

    return prisma.notification.count({ where });
  },

  async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  },

  async markAllAsRead(agencyId?: string) {
    const where: any = { isRead: false };

    if (agencyId) {
      where.agencyId = agencyId;
    }

    return prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });
  },
};
