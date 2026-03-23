import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createAgencySchema, updateAgencySchema } from './agencies.schema';
import { agenciesController } from './agencies.controller';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER'),
  agenciesController.list,
);

router.get(
  '/:id',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  (req, res, next) => {
    const user = req.user as { userId: string; email: string; role: string; agencyId: string | null };
    if (user.role === 'AGENCY_MANAGER' && user.agencyId !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Acces interzis' });
    }
    next();
  },
  agenciesController.getById,
);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER'),
  validate(createAgencySchema),
  agenciesController.create,
);

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER'),
  validate(updateAgencySchema),
  agenciesController.update,
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER'),
  agenciesController.delete,
);

export default router;
