import { z } from 'zod';

export const createAgencySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    address: z.string().optional(),
    city: z.string().optional(),
  }),
});

export const updateAgencySchema = z.object({
  body: createAgencySchema.shape.body.partial(),
});

export type CreateAgencyInput = z.infer<typeof createAgencySchema>['body'];
export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>['body'];
