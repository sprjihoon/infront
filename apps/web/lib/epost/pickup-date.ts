/** 우체국 반품소포 retVisitYmd — 매뉴얼: YYYYMMDD, 반품소포 필수, 미입력 시 내일 */

export const EPOST_PICKUP_KR_HOLIDAYS = new Set([
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18',
  '2026-03-01', '2026-05-05', '2026-05-24', '2026-06-06',
  '2026-08-15', '2026-08-16', '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-10-03', '2026-10-09', '2026-12-25',
]);

function toIsoDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
}

/** YYYY-MM-DD — 토·일·공휴일 */
export function isEpostPickupDateUnavailable(isoDate: string): boolean {
  const d = new Date(`${isoDate}T12:00:00`);
  const day = d.getDay();
  if (day === 0 || day === 6) return true;
  return EPOST_PICKUP_KR_HOLIDAYS.has(isoDate);
}

export function getDefaultEpostRetVisitYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (isEpostPickupDateUnavailable(toIsoDate(d))) {
    d.setDate(d.getDate() + 1);
  }
  return toIsoDate(d).replace(/-/g, '');
}

/** date input 기본값 — YYYY-MM-DD */
export function getDefaultEpostRetVisitIso(): string {
  const ymd = getDefaultEpostRetVisitYmd();
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

/**
 * 폼 pickup_date(YYYY-MM-DD) → retVisitYmd(YYYYMMDD)
 * @throws 수거 희망일 검증 실패 메시지
 */
export function normalizeEpostRetVisitYmd(pickupDate: string): string {
  const ymd = pickupDate.replace(/\D/g, '').slice(0, 8);
  if (ymd.length !== 8) {
    throw new Error('수거 희망일 형식이 올바르지 않습니다.');
  }
  const iso = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  if (isEpostPickupDateUnavailable(iso)) {
    throw new Error('토·일·공휴일은 수거 희망일로 선택할 수 없습니다.');
  }

  const todayKst = toIsoDate(new Date()).replace(/-/g, '');
  if (ymd <= todayKst) {
    throw new Error('수거 희망일은 오늘 이후 날짜를 선택해주세요.');
  }

  const max = new Date();
  max.setDate(max.getDate() + 21);
  const maxYmd = toIsoDate(max).replace(/-/g, '');
  if (ymd > maxYmd) {
    throw new Error('수거 희망일은 3주 이내로 선택해주세요.');
  }

  return ymd;
}
