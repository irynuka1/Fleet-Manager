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
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export type IngestInput = z.infer<typeof ingestSchema>['body'];
