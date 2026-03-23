import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createVehicleSchema, updateVehicleSchema, assignDriverSchema, createVehicleDocumentSchema } from './vehicles.schema';
import { vehiclesController } from './vehicles.controller';
import { env } from '../../config/env';

// Ensure upload directory exists on module load
fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, env.UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tip de fisier nepermis. Sunt acceptate doar: PDF, JPEG, PNG'));
    }
  },
});

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
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
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

router.post(
  '/:id/documents',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  upload.single('file'),
  validate(createVehicleDocumentSchema),
  vehiclesController.addDocument,
);

router.delete(
  '/:id/documents/:docId',
  authorize('SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'),
  vehiclesController.deleteDocument,
);

export default router;
