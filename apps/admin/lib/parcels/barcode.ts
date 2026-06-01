import type { SupabaseClient } from "@supabase/supabase-js";

export interface InvoiceItem {
  name_en?: string;
  name_ko?: string;
  quantity?: number;
  [key: string]: unknown;
}

/**
 * pre_invoice_items 배열에서 [순번 → 품목명] 맵 생성
 * 예: [{name_en:"T-shirt", quantity:2}, {name_en:"Pants", quantity:1}]
 *   → { 1:"T-shirt", 2:"T-shirt", 3:"Pants" }
 */
export function buildItemNameMap(items: InvoiceItem[]): Map<number, string> {
  const map = new Map<number, string>();
  let seq = 1;
  for (const item of items) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const name = (item.name_ko || item.name_en || "").slice(0, 30);
    for (let i = 0; i < qty; i++) {
      map.set(seq++, name || null!);
    }
  }
  return map;
}

/**
 * 바코드 번호 생성: {tracking_no}-{seq:02d}
 * tracking_no가 없으면 parcel id 앞 8자 사용
 */
export function buildBarcodeNo(trackingNo: string | null, parcelId: string, seq: number): string {
  const base = trackingNo?.trim() || parcelId.replace(/-/g, "").slice(0, 12);
  return `${base}-${String(seq).padStart(2, "0")}`;
}

export interface GenerateBarcodesOptions {
  parcelId: string;
  trackingNo: string | null;
  itemCount: number;
  invoiceItems?: InvoiceItem[];
}

export interface BarcodeRow {
  parcel_id: string;
  barcode_no: string;
  seq: number;
  item_name: string | null;
}

/**
 * parcel_barcodes 레코드 INSERT
 * 이미 존재하면 무시 (upsert ignoreDuplicates)
 */
export async function generateBarcodes(
  db: SupabaseClient,
  opts: GenerateBarcodesOptions,
): Promise<{ rows: BarcodeRow[]; error: string | null }> {
  const { parcelId, trackingNo, itemCount, invoiceItems = [] } = opts;
  const nameMap = buildItemNameMap(invoiceItems);

  const rows: BarcodeRow[] = Array.from({ length: itemCount }, (_, i) => {
    const seq = i + 1;
    return {
      parcel_id: parcelId,
      barcode_no: buildBarcodeNo(trackingNo, parcelId, seq),
      seq,
      item_name: nameMap.get(seq) ?? null,
    };
  });

  const { data, error } = await db
    .from("parcel_barcodes")
    .upsert(rows, { onConflict: "barcode_no", ignoreDuplicates: true })
    .select();

  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? rows) as BarcodeRow[], error: null };
}

/**
 * parcel_barcodes printed_at 일괄 갱신
 */
export async function markBarcodesAsPrinted(db: SupabaseClient, parcelId: string) {
  return db
    .from("parcel_barcodes")
    .update({ printed_at: new Date().toISOString() })
    .eq("parcel_id", parcelId)
    .is("printed_at", null);
}
