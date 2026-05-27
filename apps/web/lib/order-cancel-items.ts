import {
  normalizeParcelItems,
  parcelItemDisplayName,
  type ParcelInvoiceItem,
} from "@/lib/parcel-item-display";

export type OrderItemRow = {
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  origin_country: string;
};

export function buildItemListFromParcels(
  parcels: Array<{ pre_invoice_items: unknown }>,
): OrderItemRow[] {
  const items: OrderItemRow[] = [];
  for (const p of parcels) {
    const list = normalizeParcelItems(
      p.pre_invoice_items as ParcelInvoiceItem[] | string | null,
    );
    for (const it of list) {
      const name = (it.name_en || parcelItemDisplayName(it)).trim();
      if (!name) continue;
      items.push({
        name_en: name,
        quantity: Math.max(1, Number(it.quantity) || 1),
        unit_price_usd: Math.max(0, Number(it.unit_price_usd) || 0),
        origin_country: (it as { origin_country?: string }).origin_country || "KR",
      });
    }
  }
  return items;
}

export function sumCustomsValueUsd(items: OrderItemRow[]): number {
  return items.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0);
}
