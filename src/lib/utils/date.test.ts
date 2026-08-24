import { afterEach, describe, expect, it, vi } from 'vitest';
import { dateKeyFromDate, formatDate, getHappinessLabel, todayDateKey } from './date';

afterEach(() => {
  vi.useRealTimers();
});

// Midday UTC keeps the calendar day stable across timezones (container runs UTC+8)
const NOON = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12));

describe('formatDate', () => {
  it('returns an em dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('formats as "Mon D, YYYY" in en-US', () => {
    expect(formatDate(NOON(2026, 7, 15))).toBe('Jul 15, 2026');
    expect(formatDate(NOON(2026, 1, 3))).toBe('Jan 3, 2026');
  });
});

describe('todayDateKey / dateKeyFromDate', () => {
  it('todayDateKey returns an en-CA YYYY-MM-DD key for now', () => {
    vi.setSystemTime(NOON(2026, 8, 9));
    expect(todayDateKey()).toMatch(/^2026-08-09$/);
  });

  it('dateKeyFromDate formats a provided date', () => {
    expect(dateKeyFromDate(NOON(2024, 12, 31))).toBe('2024-12-31');
  });

  it('dateKeyFromDate falls back to today when given nothing', () => {
    vi.setSystemTime(NOON(2025, 2, 1));
    expect(dateKeyFromDate(null)).toBe(todayDateKey());
    expect(dateKeyFromDate(undefined)).toBe(todayDateKey());
  });
});

describe('getHappinessLabel', () => {
  it('maps ratings to labels across the scale', () => {
    expect(getHappinessLabel(0)).toBe('Very low');
    expect(getHappinessLabel(1)).toBe('Very low');
    expect(getHappinessLabel(2)).toBe('Low');
    expect(getHappinessLabel(3)).toBe('Steady');
    expect(getHappinessLabel(4)).toBe('Good');
    expect(getHappinessLabel(5)).toBe('Great');
  });

  it('treats anything above 4 as Great', () => {
    expect(getHappinessLabel(99)).toBe('Great');
  });
});
