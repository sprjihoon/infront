import { describe, expect, it } from 'vitest';
import {
  getDefaultEpostRetVisitYmd,
  isEpostPickupDateUnavailable,
  normalizeEpostRetVisitYmd,
} from './pickup-date';

describe('normalizeEpostRetVisitYmd', () => {
  it('accepts YYYY-MM-DD and returns YYYYMMDD', () => {
    expect(normalizeEpostRetVisitYmd('2026-05-28')).toBe('20260528');
  });

  it('rejects weekends', () => {
    expect(() => normalizeEpostRetVisitYmd('2026-05-30')).toThrow(/토·일/);
  });
});

describe('getDefaultEpostRetVisitYmd', () => {
  it('returns 8-digit tomorrow-or-next weekday', () => {
    const ymd = getDefaultEpostRetVisitYmd();
    expect(ymd).toMatch(/^\d{8}$/);
    const iso = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
    expect(isEpostPickupDateUnavailable(iso)).toBe(false);
  });
});
