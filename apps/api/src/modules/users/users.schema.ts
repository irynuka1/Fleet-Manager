import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: z.enum(['SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER']),
    agencyId: z.string().optional().nullable(),
  }),
});

export const updateUserSchema = z.object({
  body: createUserSchema.shape.body.partial(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];
