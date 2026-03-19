import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (env.NODE_ENV === 'development') {
    console.error('[Error]', err);
  } else {
    console.error('[Error]', err.message);
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        res.status(409).json({
          success: false,
          error: 'Inregistrare duplicata',
        });
        return;
      case 'P2025':
        res.status(404).json({
          success: false,
          error: 'Inregistrarea nu a fost gasita',
        });
        return;
      default:
        res.status(400).json({
          success: false,
          error: 'Eroare baza de date',
        });
        return;
    }
  }

  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      error: 'Eroare de validare',
      details: formattedErrors,
    });
    return;
  }

  const statusCode = (err as any).statusCode || 500;
  const message = err.message || 'Eroare interna a serverului';

  res.status(statusCode).json({
    success: false,
    error: message,
  });
};
