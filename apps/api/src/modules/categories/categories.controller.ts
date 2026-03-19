import { Request, Response, NextFunction } from 'express';
import { categoriesService } from './categories.service';

export const categoriesController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await categoriesService.list();
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await categoriesService.getById(req.params.id as string);

      if (!category) {
        return res.status(404).json({ success: false, error: 'Categoria nu a fost gasita' });
      }

      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await categoriesService.create(req.body);
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await categoriesService.update(req.params.id as string, req.body);
      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await categoriesService.delete(req.params.id as string);
      res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  },
};
