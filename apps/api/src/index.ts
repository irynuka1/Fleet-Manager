import express from 'express';
import cors from 'cors';
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
import { setupCronJobs } from './services/cronJobs';
import { setupSocketServer } from './services/socketServer';

const app = express();

// Middleware global
app.use(cors({ origin: env.NODE_ENV === 'development' ? true : (process.env.CORS_ORIGIN || 'http://localhost:5173'), credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/agencies', agencyRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/telemetry', telemetryRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
    const driverDoc = await prisma.driverDocument.findFirst({
      where: { filePath: { endsWith: filename } },
      include: { driver: true },
    });
    if (driverDoc) {
      enforceAgency(req, driverDoc.driver.agencyId);
    } else {
      // Check vehicle documents
      const vehicleDoc = await prisma.vehicleDocument.findFirst({
        where: { filePath: { endsWith: filename } },
        include: { vehicle: true },
      });
      if (!vehicleDoc) {
        return res.status(404).json({ success: false, error: 'Fisier negasit' });
      }
      enforceAgency(req, vehicleDoc.vehicle.agencyId);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Fisier negasit' });
    }
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

// Error handler (must be last)
app.use(errorHandler);

// Create HTTP server so we can attach Socket.io on the same port
const httpServer = http.createServer(app);
setupSocketServer(httpServer);

const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(env.PORT, HOST, () => {
  console.log(`[OmniKinetix API] Server pornit pe http://${HOST}:${env.PORT}`);
  console.log(`[OmniKinetix API] Mediu: ${env.NODE_ENV}`);
  setupCronJobs();
});

export default app;
