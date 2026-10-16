import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createDriverSchema, updateDriverSchema, createDocumentSchema } from './drivers.schema';
import { driversController } from './drivers.controller';
import { documentUpload, imageUpload } from '../../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/', driversController.list);

router.get('/:id', driversController.getById);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  validate(createDriverSchema),
  driversController.create,
);

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  validate(updateDriverSchema),
  driversController.update,
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  driversController.delete,
);

router.post(
  '/:id/documents',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  documentUpload.single('file'),
  validate(createDocumentSchema),
  driversController.addDocument,
);

router.delete(
  '/:id/documents/:docId',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  driversController.deleteDocument,
);

router.post(
  '/:id/photo',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  imageUpload.single('file'),
  driversController.uploadProfilePhoto,
);

router.delete(
  '/:id/photo',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  driversController.deleteProfilePhoto,
);

export default router;
