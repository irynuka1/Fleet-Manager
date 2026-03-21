import { Request, Response, NextFunction } from 'express';
import { vehiclesService } from './vehicles.service';
import { enforceAgency, getEffectiveAgencyId, forceAgencyId } from '../../middleware/agencyScope';
import { AppError } from '../../utils/AppError';
import prisma from '../../config/database';
import fs from 'fs';

export const vehiclesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, categoryId } = req.query;

      const effectiveAgencyId = getEffectiveAgencyId(req);

      const result = await vehiclesService.list({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string | undefined,
        agencyId: effectiveAgencyId,
        categoryId: categoryId as string | undefined,
      });

      res.json({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  },

  async listByCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const effectiveAgencyId = getEffectiveAgencyId(req);

      const result = await vehiclesService.listByCategory(effectiveAgencyId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehiclesService.getById(req.params.id as string);

      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehiculul nu a fost gasit' });
      }

      enforceAgency(req, vehicle.agencyId);

      res.json({ success: true, data: vehicle });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      forceAgencyId(req, req.body);
      const vehicle = await vehiclesService.create(req.body);
      res.status(201).json({ success: true, data: vehicle });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehiclesService.getById(req.params.id as string);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehiculul nu a fost gasit' });
      }
      enforceAgency(req, vehicle.agencyId);
      forceAgencyId(req, req.body);

      const updated = await vehiclesService.update(req.params.id as string, req.body);
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehiclesService.getById(req.params.id as string);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehiculul nu a fost gasit' });
      }
      enforceAgency(req, vehicle.agencyId);

      await vehiclesService.delete(req.params.id as string);
      res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  },

  async assignDriver(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehiclesService.getById(req.params.id as string);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehiculul nu a fost gasit' });
      }
      enforceAgency(req, vehicle.agencyId);

      // Validate driver belongs to same agency
      const driver = await prisma.driver.findUnique({ where: { id: req.body.driverId } });
      if (!driver) {
        return res.status(404).json({ success: false, error: 'Soferul nu a fost gasit' });
      }
      if (vehicle.agencyId !== driver.agencyId) {
        throw new AppError('Soferul nu apartine aceleiasi agentii ca vehiculul', 400);
      }

      const result = await vehiclesService.assignDriver(req.params.id as string, req.body.driverId);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async unassignDriver(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehiclesService.getById(req.params.id as string);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehiculul nu a fost gasit' });
      }
      enforceAgency(req, vehicle.agencyId);

      await vehiclesService.unassignDriver(req.params.id as string, req.params.driverId as string);
      res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  },

  async addDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehiclesService.getById(req.params.id as string);
      if (!vehicle) {
        if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(404).json({ success: false, error: 'Vehiculul nu a fost gasit' });
      }

      try {
        enforceAgency(req, vehicle.agencyId);

        const file = req.file;
        const { type, expiryDate } = req.body;

        const document = await vehiclesService.addDocument(req.params.id as string, {
          type,
          expiryDate: expiryDate || null,
          filePath: file ? file.path : undefined,
          fileName: file ? file.originalname : undefined,
        });

        res.status(201).json({ success: true, data: document });
      } catch (innerError) {
        if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
        throw innerError;
      }
    } catch (error) {
      next(error);
    }
  },

  async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const document = await vehiclesService.getDocument(req.params.docId as string);
      if (!document) {
        return res.status(404).json({ success: false, error: 'Documentul nu a fost gasit' });
      }

      if (document.vehicleId !== (req.params.id as string)) {
        return res.status(404).json({ success: false, error: 'Documentul nu apartine acestui vehicul' });
      }

      const vehicle = await vehiclesService.getById(document.vehicleId);
      if (!vehicle) {
        return res.status(404).json({ success: false, error: 'Vehiculul nu a fost gasit' });
      }
      enforceAgency(req, vehicle.agencyId);

      await vehiclesService.deleteDocument(req.params.docId as string);
      res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  },
};
