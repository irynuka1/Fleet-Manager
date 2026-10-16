import { z } from 'zod';

/**
 * Optional date accepted as "YYYY-MM-DD", a full ISO string or null/"" (cleared).
 * Rejects unparseable values with a 400 instead of letting Prisma throw a 500.
 */
export const optionalDate = z.preprocess(
  (v) => (v === '' ? null : v),
  z.coerce.date().nullable().optional(),
);
