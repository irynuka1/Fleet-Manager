import { z } from 'zod';

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
    expiryDate: z.string().optional().nullable(),
  }),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>['body'];
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>['body'];
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>['body'];
