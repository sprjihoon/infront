export function krwToUsd(amountKrw: number, usdKrwRate: number): number {
  const rate = usdKrwRate > 0 ? usdKrwRate : 1400;
  const usd = amountKrw / rate;
  return Math.round(usd * 100) / 100;
}

export function formatUsd(amountUsd: number): string {
  return `$${amountUsd.toFixed(2)}`;
}

export function usdValueString(amountUsd: number): string {
  return amountUsd.toFixed(2);
}
