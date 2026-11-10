/** 입고 후 무료로 두는 기간. 장기보관은 이 기간이 끝난 뒤 시작하고, 배송전용은 이 기간이 무료다. */
export const FREE_HOLDING_DAYS = 7;

const DAY_MS = 86_400_000;

/** 보관료를 한 달(30일) 단위로 올림. 경과 0일이면 0달. */
export function billableMonths(fromIso: string | null | undefined, now = new Date()): number {
  if (!fromIso) return 0;
  const start = new Date(fromIso);
  if (Number.isNaN(start.getTime())) return 0;
  const days = Math.floor((now.getTime() - start.getTime()) / DAY_MS);
  if (days <= 0) return 0;
  return Math.ceil(days / 30);
}

/** 배송전용. 입고 후 7일은 크기와 관계없이 0달. 그 다음날부터 30일 단위. */
export function shippingBillableMonths(fromIso: string | null | undefined, now = new Date()): number {
  if (!fromIso) return 0;
  const start = new Date(fromIso);
  if (Number.isNaN(start.getTime())) return 0;
  const days = Math.floor((now.getTime() - start.getTime()) / DAY_MS);
  if (days <= FREE_HOLDING_DAYS) return 0;
  return Math.ceil((days - FREE_HOLDING_DAYS) / 30);
}

/** 장기보관 시작 시각. 입고 시각에서 7일 뒤. */
export function longTermStartsAt(fromIso: string | null | undefined): string | null {
  if (!fromIso) return null;
  const start = new Date(fromIso);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + FREE_HOLDING_DAYS * DAY_MS).toISOString();
}

/**
 * 선결제가 없는 장기보관. 시작 전이면 0달.
 * 시작일 당일부터 한 달이다. 30일이 더 지나면 다음 달.
 */
export function unpaidMonthsSince(startIso: string | null | undefined, now = new Date()): number {
  if (!startIso) return 0;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime()) || now.getTime() < start.getTime()) return 0;
  const days = Math.floor((now.getTime() - start.getTime()) / DAY_MS);
  if (days <= 0) return 1;
  return Math.max(1, Math.ceil(days / 30));
}

export function monthlyRate(storage: {
  monthly_amount?: number | null;
  storage_types?: { price_per_month?: number | null } | null;
}): number {
  const direct = storage.monthly_amount != null ? Number(storage.monthly_amount) : 0;
  if (direct > 0) return direct;
  const typed = storage.storage_types?.price_per_month;
  return typed != null ? Number(typed) : 0;
}

/** 장기보관: 선결제된 paid_until 다음날부터 남은 달. 이미 낸 기간은 0. */
export function remainingStorageMonths(
  paidUntil: string | null | undefined,
  fallbackStart: string | null | undefined,
  now = new Date(),
): number {
  if (paidUntil) {
    const until = new Date(`${paidUntil}T00:00:00`);
    if (!Number.isNaN(until.getTime()) && until.getTime() >= startOfDay(now)) return 0;
    return billableMonths(paidUntil, now);
  }
  return unpaidMonthsSince(fallbackStart, now);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
