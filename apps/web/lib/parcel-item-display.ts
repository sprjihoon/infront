export interface ParcelInvoiceItem {
  name_en?: string;
  product_name?: string;
  quantity?: number;
  unit_price_usd?: number;
  origin_country?: string;
}

export function parcelItemDisplayName(item: ParcelInvoiceItem): string {
  return (item.product_name || item.name_en || "").trim();
}

/** JSONB·문자열 등 Supabase 응답을 배열로 정규화 */
export function normalizeParcelItems(raw: unknown): ParcelInvoiceItem[] {
  if (raw == null) return [];
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object") return Object.values(parsed as Record<string, ParcelInvoiceItem>);
  return [];
}

/** 홈·창고 카드용 한 줄 제목 (예: 나이스운동화 외1, 나이스운동화 외2, 나이스운동화 ×3) */
export function formatParcelItemTitle(items: ParcelInvoiceItem[] | null | undefined): string {
  const list = normalizeParcelItems(items).filter((i) => parcelItemDisplayName(i));
  if (list.length === 0) return "";

  const primary = parcelItemDisplayName(list[0]);
  const totalQty = list.reduce(
    (sum, i) => sum + Math.max(1, Number(i.quantity) || 1),
    0,
  );

  if (list.length === 1) {
    return totalQty > 1 ? `${primary} ×${totalQty}` : primary;
  }
  return `${primary} 외${list.length - 1}`;
}
