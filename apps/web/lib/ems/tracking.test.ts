import { describe, expect, it } from 'vitest';
import { isEmsDelivered, resolveOrderRegino } from './tracking';

describe('isEmsDelivered', () => {
  it('detects Korean delivery complete status', () => {
    expect(
      isEmsDelivered([{ regino: 'EG123KR', processDe: '20260101', processSttus: '배달완료' }]),
    ).toBe(true);
  });

  it('detects English delivered status in detail', () => {
    expect(
      isEmsDelivered([
        {
          regino: 'EG123KR',
          processDe: '20260101',
          processSttus: 'Delivered',
          detailDc: 'Successfully delivered',
        },
      ]),
    ).toBe(true);
  });

  it('returns false for in-transit events', () => {
    expect(
      isEmsDelivered([
        { regino: 'EG123KR', processDe: '20260101', processSttus: '발송' },
        { regino: 'EG123KR', processDe: '20260102', processSttus: '통관중' },
      ]),
    ).toBe(false);
  });
});

describe('resolveOrderRegino', () => {
  it('prefers ems_regino', () => {
    expect(
      resolveOrderRegino({
        ems_regino: 'EG111KR',
        intl_tracking_no: 'EG222KR',
      }),
    ).toBe('EG111KR');
  });

  it('falls back to box intl_tracking_no', () => {
    expect(
      resolveOrderRegino({
        shipping_boxes: [{ intl_tracking_no: 'EG333KR' }],
      }),
    ).toBe('EG333KR');
  });
});
