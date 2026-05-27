import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { syncParcelsInboundBatch, type InboundSource } from "@/lib/parcels/inbound-sync";

export const preferredRegion = "icn1";

/**
 * POST /api/admin/parcels/sync-inbound
 * Body: { source?: 'PICKUP' | 'DIRECT', parcel_id?: string, limit?: number }
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { source?: InboundSource; parcel_id?: string; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok */
  }

  try {
    const summary = await syncParcelsInboundBatch(adminDb, {
      source: body.source,
      parcelId: body.parcel_id,
      limit: body.limit ?? 200,
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "동기화 실패" },
      { status: 500 },
    );
  }
}
