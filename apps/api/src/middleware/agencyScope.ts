import { Request } from 'express';
import { AppError } from '../utils/AppError';

export function enforceAgency(req: Request, resourceAgencyId: string | null) {
  const user = req.user as { userId: string; email: string; role: string; agencyId: string | null };
  if (user.role === 'AGENCY_MANAGER' && user.agencyId !== resourceAgencyId) {
    throw new AppError('Acces interzis - resursa nu apartine agentiei tale', 403);
  }
}

export function getEffectiveAgencyId(req: Request): string | undefined {
  const user = req.user as { userId: string; email: string; role: string; agencyId: string | null };
  if (user.role === 'AGENCY_MANAGER') {
    return user.agencyId!;
  }
  return (req.query.agencyId as string) || undefined;
}

export function forceAgencyId(req: Request, body: any) {
  const user = req.user as { userId: string; email: string; role: string; agencyId: string | null };
  if (user.role === 'AGENCY_MANAGER') {
    body.agencyId = user.agencyId;
  }
}
