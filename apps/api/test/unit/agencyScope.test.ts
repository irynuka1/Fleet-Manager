import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { enforceAgency, forceAgencyId, getEffectiveAgencyId } from '../../src/middleware/agencyScope';
import { AppError } from '../../src/utils/AppError';

const reqFor = (role: string, agencyId: string | null, query: Record<string, string> = {}) =>
  ({ user: { userId: 'u', email: 'u@t.ro', role, agencyId }, query }) as unknown as Request;

describe('enforceAgency', () => {
  it('lets an agency manager touch their own agency', () => {
    expect(() => enforceAgency(reqFor('AGENCY_MANAGER', 'a1'), 'a1')).not.toThrow();
  });

  it('forbids an agency manager from another agency (403)', () => {
    try {
      enforceAgency(reqFor('AGENCY_MANAGER', 'a1'), 'a2');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(403);
    }
  });

  it.each(['SUPER_ADMIN', 'COUNTRY_MANAGER'])('lets %s access any agency', (role) => {
    expect(() => enforceAgency(reqFor(role, null), 'any')).not.toThrow();
  });
});

describe('getEffectiveAgencyId', () => {
  it('pins agency managers to their agency and ignores ?agencyId=', () => {
    expect(getEffectiveAgencyId(reqFor('AGENCY_MANAGER', 'a1', { agencyId: 'other' }))).toBe('a1');
  });

  it('lets global roles filter by query, or see everything', () => {
    expect(getEffectiveAgencyId(reqFor('COUNTRY_MANAGER', null, { agencyId: 'a9' }))).toBe('a9');
    expect(getEffectiveAgencyId(reqFor('SUPER_ADMIN', null))).toBeUndefined();
  });
});

describe('forceAgencyId', () => {
  it('overrides a spoofed agencyId for agency managers only', () => {
    const body: Record<string, unknown> = { agencyId: 'spoofed' };
    forceAgencyId(reqFor('AGENCY_MANAGER', 'a1'), body);
    expect(body.agencyId).toBe('a1');

    const adminBody: Record<string, unknown> = { agencyId: 'chosen' };
    forceAgencyId(reqFor('SUPER_ADMIN', null), adminBody);
    expect(adminBody.agencyId).toBe('chosen');
  });
});
