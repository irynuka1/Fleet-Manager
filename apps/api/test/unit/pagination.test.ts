import { describe, expect, it } from 'vitest';
import { parsePagination } from '../../src/utils/pagination';

describe('parsePagination', () => {
  it('uses defaults when nothing is provided', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it('computes skip from page and limit', () => {
    expect(parsePagination({ page: '3', limit: '20' })).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it('caps the limit at 100', () => {
    expect(parsePagination({ limit: '5000' }).limit).toBe(100);
  });

  it.each([['abc'], ['-1'], ['0'], ['1.5'], [''], [NaN], [undefined]])(
    'falls back to defaults for invalid value %j',
    (bad) => {
      expect(parsePagination({ page: bad, limit: bad })).toEqual({ page: 1, limit: 10, skip: 0 });
    },
  );
});
