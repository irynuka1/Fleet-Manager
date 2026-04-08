import { Request, Response, NextFunction } from 'express';
import { notificationsService } from './notifications.service';
import { enforceAgency, getEffectiveAgencyId } from '../../middleware/agencyScope';
import { AppError } from '../../utils/AppError';
import prisma from '../../config/database';
import { runAlertCheck } from '../../services/alertEngine';

export const notificationsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, isRead } = req.query;

      const effectiveAgencyId = getEffectiveAgencyId(req);

      const result = await notificationsService.list({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        agencyId: effectiveAgencyId,
        isRead: isRead !== undefined ? isRead === 'true' : undefined,
      });

      res.json({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  },

  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const effectiveAgencyId = getEffectiveAgencyId(req);
      const count = await notificationsService.getUnreadCount(effectiveAgencyId);

      res.json({ success: true, data: { count } });
    } catch (error) {
      next(error);
    }
  },

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const notification = await prisma.notification.findUnique({
        where: { id: req.params.id as string },
      });

      if (!notification) {
        throw new AppError('Notificarea nu a fost gasita', 404);
      }

      enforceAgency(req, notification.agencyId);

      const updated = await notificationsService.markAsRead(req.params.id as string);
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const effectiveAgencyId = getEffectiveAgencyId(req);
      const result = await notificationsService.markAllAsRead(effectiveAgencyId);

      res.json({ success: true, data: { updated: result.count } });
    } catch (error) {
      next(error);
    }
  },

  async triggerCheck(req: Request, res: Response, next: NextFunction) {
    try {
      const created = await runAlertCheck();
      res.json({ success: true, data: { created } });
    } catch (error) {
      next(error);
    }
  },
};
