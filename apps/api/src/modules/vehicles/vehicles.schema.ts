import { z } from 'zod';
import { optionalDate } from '../../utils/zod';

export const createVehicleSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    plateNumber: z.string().min(1),
    categoryId: z.string().uuid(),
    agencyId: z.string().uuid(),
    monitoringType: z.enum(['KILOMETERS', 'HOURS']),
    currentKm: z.number().min(0).optional().nullable(),
    currentHours: z.number().min(0).optional().nullable(),
    revisionThreshold: z.number().min(0).optional().nullable(),
    itpExpiryDate: optionalDate,
    rcaExpiryDate: optionalDate,
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

export const createVehicleDocumentSchema = z.object({
  body: z.object({
    type: z.enum(['ITP', 'RCA', 'REGISTRATION', 'INSURANCE', 'OTHER']),
    expiryDate: optionalDate,
  }),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>['body'];
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>['body'];
export type AssignDriverInput = z.infer<typeof assignDriverSchema>['body'];
export type CreateVehicleDocumentInput = z.infer<typeof createVehicleDocumentSchema>['body'];
