import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { notificationsController } from './notifications.controller';

const router = Router();

router.get('/', authenticate, notificationsController.list);

router.get('/count', authenticate, notificationsController.getUnreadCount);

router.put('/read-all', authenticate, notificationsController.markAllAsRead);

router.put('/:id/read', authenticate, notificationsController.markAsRead);

router.post(
  '/check',
  authenticate,
  authorize('SUPER_ADMIN'),
  notificationsController.triggerCheck,
);

export default router;
