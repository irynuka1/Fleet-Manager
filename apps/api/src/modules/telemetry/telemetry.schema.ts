import { z } from 'zod';

export const ingestSchema = z.object({
  body: z.object({
    vehicleId: z.string().uuid(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    speed: z.number().optional().nullable(),
    heading: z.number().min(0).lt(360).optional().nullable(),
  }),
});

export const historyQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
});

export type IngestInput = z.infer<typeof ingestSchema>['body'];
