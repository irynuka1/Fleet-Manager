import { Request, Response, NextFunction } from 'express';
import { agenciesService } from './agencies.service';

export const agenciesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search } = req.query;
      const result = await agenciesService.list({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string | undefined,
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
      const agency = await agenciesService.getById(req.params.id as string);

      if (!agency) {
        return res.status(404).json({ success: false, error: 'Agentia nu a fost gasita' });
      }

      res.json({ success: true, data: agency });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const agency = await agenciesService.create(req.body);
      res.status(201).json({ success: true, data: agency });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const agency = await agenciesService.update(req.params.id as string, req.body);
      res.json({ success: true, data: agency });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await agenciesService.delete(req.params.id as string);
      res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  },
};
