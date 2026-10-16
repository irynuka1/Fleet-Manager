import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';
import { enforceAgency } from './middleware/agencyScope';
import prisma from './config/database';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import agencyRoutes from './modules/agencies/agencies.routes';
import categoryRoutes from './modules/categories/categories.routes';
import vehicleRoutes from './modules/vehicles/vehicles.routes';
import driverRoutes from './modules/drivers/drivers.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import telemetryRoutes from './modules/telemetry/telemetry.routes';

const app = express();

// Behind a reverse proxy (nginx, load balancer) set TRUST_PROXY=true so rate
// limiting sees the real client IP.
if (env.TRUST_PROXY) app.set('trust proxy', 1);
app.disable('x-powered-by');

// Middleware global
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin: env.NODE_ENV === 'development' ? true : env.CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({
  limit: '1mb',
  type: (req) => {
    const contentType = req.headers['content-type'] ?? '';
    return contentType.includes('application/json') || contentType.includes('+json');
  },
}));

// Brute-force protection on credential endpoints (dev and test are exempt)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'development' || env.NODE_ENV === 'test',
  message: { success: false, error: 'Prea multe incercari. Reincearca peste cateva minute.' },
});

// Routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/agencies', agencyRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/telemetry', telemetryRoutes);

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'down', timestamp: new Date().toISOString() });
  }
});

// Authenticated + agency-scoped file serving
app.get('/api/uploads/:filename', authenticate, async (req, res, next) => {
  try {
    const filename = req.params.filename as string;
    const resolvedUploadDir = path.resolve(env.UPLOAD_DIR);
    const filePath = path.resolve(resolvedUploadDir, filename);

    // Path traversal guard
    if (!filePath.startsWith(resolvedUploadDir + path.sep) && filePath !== resolvedUploadDir) {
      return res.status(400).json({ success: false, error: 'Cale invalida' });
    }

    // Verify the file belongs to a document the user has access to
    // Stored paths are "<UPLOAD_DIR>/<filename>"; match both separators (Windows hosts).
    const byName = (field: 'filePath' | 'profilePhotoPath') => ({
      OR: [
        { [field]: { endsWith: `/${filename}` } },
        { [field]: { endsWith: `\\${filename}` } },
      ],
    });

    const driverDoc = await prisma.driverDocument.findFirst({
      where: byName('filePath'),
      include: { driver: true },
    });
    if (driverDoc) {
      enforceAgency(req, driverDoc.driver.agencyId);
    } else {
      const driverWithPhoto = await prisma.driver.findFirst({
        where: byName('profilePhotoPath'),
      });
      if (driverWithPhoto) {
        enforceAgency(req, driverWithPhoto.agencyId);
      } else {
        // Check vehicle documents
        const vehicleDoc = await prisma.vehicleDocument.findFirst({
          where: byName('filePath'),
          include: { vehicle: true },
        });
        if (!vehicleDoc) {
          return res.status(404).json({ success: false, error: 'Fisier negasit' });
        }
        enforceAgency(req, vehicleDoc.vehicle.agencyId);
      }
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Fisier negasit' });
    }
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

// Unknown API routes -> JSON 404 (instead of Express' HTML page)
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'Ruta inexistenta' });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
