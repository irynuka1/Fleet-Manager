import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cn, daysUntil, formatDate } from './utils';

describe('cn', () => {
  it('merges conditional classes and resolves Tailwind conflicts', () => {
    const hidden = false as boolean;
    expect(cn('p-2', hidden && 'hidden', 'p-4')).toBe('p-4');
  });
});

describe('formatDate', () => {
  it('formats in ro-RO and handles empty values', () => {
    expect(formatDate('2030-03-05T12:00:00Z')).toBe('05.03.2030');
    expect(formatDate(null)).toBe('-');
    expect(formatDate(undefined)).toBe('-');
  });
});

describe('daysUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('counts whole days, negative when past, null when empty', () => {
    expect(daysUntil('2026-01-11T00:00:00Z')).toBe(10);
    expect(daysUntil('2025-12-30T00:00:00Z')).toBe(-2);
    expect(daysUntil(null)).toBeNull();
  });
});
