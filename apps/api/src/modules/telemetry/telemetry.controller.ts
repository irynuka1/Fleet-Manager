import { Request, Response, NextFunction } from 'express';
import { telemetryService } from './telemetry.service';
import { enforceAgency, getEffectiveAgencyId } from '../../middleware/agencyScope';
import { getIO } from '../../services/socketServer';
import prisma from '../../config/database';
import { historyQuerySchema } from './telemetry.schema';

export const telemetryController = {
  async ingest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await telemetryService.ingest(req.body);

      // Broadcast to agency room via Socket.io
      const io = getIO();
      if (io) {
        io.to(`agency:${result.vehicle.agencyId}`).emit('telemetry:update', {
          vehicleId: result.vehicle.id,
          name: result.vehicle.name,
          plateNumber: result.vehicle.plateNumber,
          lat: result.live.lat,
          lng: result.live.lng,
          speed: result.live.speed,
          heading: result.live.heading,
          updatedAt: result.live.updatedAt,
        });
      }

      res.status(201).json({ success: true, data: result.live });
    } catch (error) {
      next(error);
    }
  },

  async listLive(req: Request, res: Response, next: NextFunction) {
    try {
      const agencyId = getEffectiveAgencyId(req);
      const data = await telemetryService.getLive(agencyId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicleId = req.params.vehicleId as string;

      // Authorization: AGENCY_MANAGER only sees their vehicles
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: { agencyId: true },
      });
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehiculul nu a fost gasit' });
      }
      enforceAgency(req, vehicle.agencyId);

      const { from, to, limit } = historyQuerySchema.parse(req.query);

      const result = await telemetryService.getHistory(vehicleId, { from, to, limit });
      return res.json({ success: true, data: result.data, truncated: result.truncated });
    } catch (error) {
      return next(error);
    }
  },
};
