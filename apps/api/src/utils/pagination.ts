const MAX_LIMIT = 100;

/**
 * Parses `page` / `limit` query params defensively: non-numeric, zero or
 * negative values fall back to defaults instead of reaching Prisma as NaN.
 */
export function parsePagination(query: { page?: unknown; limit?: unknown }) {
  const toPositiveInt = (value: unknown, fallback: number) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  };
  const page = toPositiveInt(query.page, 1);
  const limit = Math.min(toPositiveInt(query.limit, 10), MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}
