/** 보관료를 한 달(30일) 단위로 올림. 경과 0일이면 0달. */

export function billableMonths(fromIso: string | null | undefined, now = new Date()): number {
  if (!fromIso) return 0;
  const start = new Date(fromIso);
  if (Number.isNaN(start.getTime())) return 0;
  const days = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  if (days <= 0) return 0;
  return Math.ceil(days / 30);
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
  return billableMonths(fallbackStart, now);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
