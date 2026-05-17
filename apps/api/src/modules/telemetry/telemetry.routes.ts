import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ingestSchema } from './telemetry.schema';
import { telemetryController } from './telemetry.controller';

const router = Router();
router.use(authenticate);

// Ingest restricted to SUPER_ADMIN (simulator uses admin token)
router.post('/ingest', authorize('SUPER_ADMIN'), validate(ingestSchema), telemetryController.ingest);

// List live positions (agency-scoped)
router.get('/live', telemetryController.listLive);

// Get history for a vehicle
router.get('/:vehicleId/history', telemetryController.getHistory);

export default router;
