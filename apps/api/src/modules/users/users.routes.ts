import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createUserSchema, updateUserSchema } from './users.schema';

const router = Router();

router.use(authenticate, authorize('SUPER_ADMIN'));

router.get('/', UsersController.list);
router.get('/:id', UsersController.getById);
router.post('/', validate(createUserSchema), UsersController.create);
router.put('/:id', validate(updateUserSchema), UsersController.update);
router.delete('/:id', UsersController.delete);

export default router;
