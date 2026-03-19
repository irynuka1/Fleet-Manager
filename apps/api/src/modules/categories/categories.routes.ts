import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createCategorySchema, updateCategorySchema } from './categories.schema';
import { categoriesController } from './categories.controller';

const router = Router();

router.use(authenticate);

router.get('/', categoriesController.list);

router.get('/:id', categoriesController.getById);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER'),
  validate(createCategorySchema),
  categoriesController.create,
);

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER'),
  validate(updateCategorySchema),
  categoriesController.update,
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER'),
  categoriesController.delete,
);

export default router;
