import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { driversService } from './drivers.service';
import { enforceAgency, getEffectiveAgencyId, forceAgencyId } from '../../middleware/agencyScope';
import { AppError } from '../../utils/AppError';

export const driversController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search } = req.query;

      const effectiveAgencyId = getEffectiveAgencyId(req);

      const result = await driversService.list({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string | undefined,
        agencyId: effectiveAgencyId,
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

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driversService.getById(req.params.id as string);

      if (!driver) {
        return res.status(404).json({ success: false, error: 'Soferul nu a fost gasit' });
      }

      enforceAgency(req, driver.agencyId);

      res.json({ success: true, data: driver });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      forceAgencyId(req, req.body);
      const driver = await driversService.create(req.body);
      res.status(201).json({ success: true, data: driver });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driversService.getById(req.params.id as string);
      if (!driver) {
        return res.status(404).json({ success: false, error: 'Soferul nu a fost gasit' });
      }
      enforceAgency(req, driver.agencyId);
      forceAgencyId(req, req.body);

      const updated = await driversService.update(req.params.id as string, req.body);
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driversService.getById(req.params.id as string);
      if (!driver) {
        return res.status(404).json({ success: false, error: 'Soferul nu a fost gasit' });
      }
      enforceAgency(req, driver.agencyId);

      await driversService.delete(req.params.id as string);
      res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  },

  async addDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driversService.getById(req.params.id as string);
      if (!driver) {
        if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(404).json({ success: false, error: 'Soferul nu a fost gasit' });
      }

      try {
        enforceAgency(req, driver.agencyId);

        const file = req.file;
        const { type, expiryDate } = req.body;

        const document = await driversService.addDocument(req.params.id as string, {
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
      const document = await driversService.getDocument(req.params.docId as string);
      if (!document) {
        return res.status(404).json({ success: false, error: 'Documentul nu a fost gasit' });
      }

      // Verify document belongs to the driver in the URL
      if (document.driverId !== (req.params.id as string)) {
        return res.status(404).json({ success: false, error: 'Documentul nu apartine acestui sofer' });
      }

      const driver = await driversService.getById(document.driverId);
      if (!driver) {
        return res.status(404).json({ success: false, error: 'Soferul nu a fost gasit' });
      }
      enforceAgency(req, driver.agencyId);

      await driversService.deleteDocument(req.params.docId as string);
      res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  },

  async uploadProfilePhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driversService.getById(req.params.id as string);
      if (!driver) {
        if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(404).json({ success: false, error: 'Soferul nu a fost gasit' });
      }

      try {
        enforceAgency(req, driver.agencyId);

        const file = req.file;
        if (!file) {
          throw new AppError('Fisierul este obligatoriu', 400);
        }

        const updated = await driversService.updateProfilePhoto(req.params.id as string, {
          filePath: file.path,
          fileName: file.originalname,
        });

        res.json({ success: true, data: updated });
      } catch (innerError) {
        if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
        throw innerError;
      }
    } catch (error) {
      next(error);
    }
  },

  async deleteProfilePhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driversService.getById(req.params.id as string);
      if (!driver) {
        return res.status(404).json({ success: false, error: 'Soferul nu a fost gasit' });
      }
      enforceAgency(req, driver.agencyId);

      const updated = await driversService.deleteProfilePhoto(req.params.id as string);
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },
};
