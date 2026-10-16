import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { optionalDate } from '../../src/utils/zod';

const schema = z.object({ d: optionalDate });

describe('optionalDate', () => {
  it('parses YYYY-MM-DD and ISO strings into Date', () => {
    expect(schema.parse({ d: '2030-01-15' }).d).toEqual(new Date('2030-01-15'));
    expect(schema.parse({ d: '2030-01-15T10:00:00.000Z' }).d).toBeInstanceOf(Date);
  });

  it('keeps undefined and null, and treats empty string as null', () => {
    expect(schema.parse({}).d).toBeUndefined();
    expect(schema.parse({ d: null }).d).toBeNull();
    expect(schema.parse({ d: '' }).d).toBeNull();
  });

  it('rejects unparseable dates', () => {
    expect(schema.safeParse({ d: 'not-a-date' }).success).toBe(false);
  });
});
