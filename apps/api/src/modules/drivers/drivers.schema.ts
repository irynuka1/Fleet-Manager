import { z } from 'zod';
import { optionalDate } from '../../utils/zod';

export const createDriverSchema = z.object({
  body: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    agencyId: z.string().uuid(),
  }),
});

export const updateDriverSchema = z.object({
  body: createDriverSchema.shape.body.partial(),
});

export const createDocumentSchema = z.object({
  body: z.object({
    type: z.enum(['DRIVING_LICENSE', 'MEDICAL_CERTIFICATE']),
    expiryDate: optionalDate,
  }),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>['body'];
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>['body'];
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>['body'];
