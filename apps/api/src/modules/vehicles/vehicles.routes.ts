import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createVehicleSchema, updateVehicleSchema, assignDriverSchema } from './vehicles.schema';
import { vehiclesController } from './vehicles.controller';

const router = Router();

router.use(authenticate);

router.get('/', vehiclesController.list);

router.get('/by-category', vehiclesController.listByCategory);

router.get('/:id', vehiclesController.getById);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  validate(createVehicleSchema),
  vehiclesController.create,
);

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  validate(updateVehicleSchema),
  vehiclesController.update,
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER'),
  vehiclesController.delete,
);

router.post(
  '/:id/drivers',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  validate(assignDriverSchema),
  vehiclesController.assignDriver,
);

router.delete(
  '/:id/drivers/:driverId',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  vehiclesController.unassignDriver,
);

export default router;
