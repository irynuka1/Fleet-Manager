import { z } from 'zod';

export const createVehicleSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    plateNumber: z.string().min(1),
    categoryId: z.string().uuid(),
    agencyId: z.string().uuid(),
    monitoringType: z.enum(['KILOMETERS', 'HOURS']),
    currentKm: z.number().optional().nullable(),
    currentHours: z.number().optional().nullable(),
    revisionThreshold: z.number().optional().nullable(),
    itpExpiryDate: z.string().optional().nullable(),
    rcaExpiryDate: z.string().optional().nullable(),
  }),
});

export const updateVehicleSchema = z.object({
  body: createVehicleSchema.shape.body.partial(),
});

export const assignDriverSchema = z.object({
  body: z.object({
    driverId: z.string().uuid(),
  }),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>['body'];
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>['body'];
export type AssignDriverInput = z.infer<typeof assignDriverSchema>['body'];
