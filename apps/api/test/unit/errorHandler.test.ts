import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { errorHandler } from '../../src/middleware/errorHandler';
import { AppError } from '../../src/utils/AppError';

function run(err: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
  errorHandler(err as Error, {} as Request, res, vi.fn());
  return {
    status: (res.status as ReturnType<typeof vi.fn>).mock.calls[0][0] as number,
    body: (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>,
  };
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('maps AppError to its status', () => {
    expect(run(new AppError('nope', 418))).toEqual({ status: 418, body: { success: false, error: 'nope' } });
  });

  it('maps Prisma unique violation to 409 and not-found to 404', () => {
    const make = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: 'test' });
    expect(run(make('P2002')).status).toBe(409);
    expect(run(make('P2025')).status).toBe(404);
    expect(run(make('P2003')).status).toBe(400);
  });

  it('maps ZodError to 400 with field details', () => {
    const parsed = z.object({ email: z.string().email() }).safeParse({ email: 'x' });
    const { status, body } = run((parsed as { error: z.ZodError }).error);
    expect(status).toBe(400);
    expect(body.details).toEqual([expect.objectContaining({ field: 'email' })]);
  });

  it('maps Multer size errors to 413 and other Multer errors to 400', () => {
    expect(run(new multer.MulterError('LIMIT_FILE_SIZE')).status).toBe(413);
    expect(run(new multer.MulterError('LIMIT_UNEXPECTED_FILE')).status).toBe(400);
  });

  it('maps malformed JSON bodies to 400', () => {
    const err = Object.assign(new Error('bad json'), { type: 'entity.parse.failed' });
    expect(run(err)).toEqual({ status: 400, body: { success: false, error: 'JSON invalid' } });
  });

  it('keeps unexpected 500 details outside development', () => {
    const { status, body } = run(new Error('secret db password leaked'));
    expect(status).toBe(500);
    expect(body.error).toBe('Eroare interna a serverului');
  });
});
