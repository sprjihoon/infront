import { describe, expect, it } from 'vitest';
import { getOrderInsuranceParams, usdToBoprcKrw, MAX_BOPRC_KRW, appendInsuranceQuoteParams } from './insurance';

describe('usdToBoprcKrw', () => {
  it('converts USD to KRW with default rate', () => {
    expect(usdToBoprcKrw(100)).toBe(140_000);
  });

  it('caps at EMS max insurance amount', () => {
    expect(usdToBoprcKrw(10_000)).toBe(MAX_BOPRC_KRW);
  });
});

describe('getOrderInsuranceParams', () => {
  it('returns N when insurance disabled', () => {
    expect(getOrderInsuranceParams({ insurance_enabled: false, customs_value: 50 })).toEqual({
      boyn: 'N',
      boprc: 0,
    });
  });

  it('uses insurance_amount USD and converts to boprc KRW', () => {
    expect(getOrderInsuranceParams({
      insurance_enabled: true,
      insurance_amount: 100,
      customs_value: 50,
    })).toEqual({ boyn: 'Y', boprc: 140_000 });
  });

  it('falls back to customs_value when insurance_amount missing', () => {
    expect(getOrderInsuranceParams({
      insurance_enabled: true,
      customs_value: 25,
    })).toEqual({ boyn: 'Y', boprc: 35_000 });
  });
});

describe('appendInsuranceQuoteParams', () => {
  it('adds boyn and boprc when enabled with USD amount', () => {
    const p = new URLSearchParams();
    appendInsuranceQuoteParams(p, true, 100);
    expect(p.get('boyn')).toBe('Y');
    expect(p.get('boprc')).toBe('140000');
  });

  it('leaves params empty when disabled', () => {
    const p = new URLSearchParams();
    appendInsuranceQuoteParams(p, false, 100);
    expect(p.has('boyn')).toBe(false);
    expect(p.has('boprc')).toBe(false);
  });
});
