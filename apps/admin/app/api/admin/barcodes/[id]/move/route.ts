import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import {
  moveBarcodeToLocation,
  resolveMoveReason,
} from "@/lib/storage/location-move";

/**
 * POST /api/admin/barcodes/[id]/move
 *
 * 내품(parcel_barcodes) 단위 위치 이동.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: barcodeId } = await params;
  const body = await req.json();
  const { to_location_id, reason, notes } = body as {
    to_location_id: string;
    reason?: string;
    notes?: string;
  };

  if (!to_location_id) {
    return NextResponse.json({ error: "to_location_id 필수" }, { status: 400 });
  }

  const { data: barcode } = await adminDb
    .from("parcel_barcodes")
    .select("storage_location_id")
    .eq("id", barcodeId)
    .single();

  let fromIsTemp = false;
  if (barcode?.storage_location_id) {
    const { data: fromLoc } = await adminDb
      .from("storage_locations")
      .select("is_temp")
      .eq("id", barcode.storage_location_id)
      .single();
    fromIsTemp = !!fromLoc?.is_temp;
  }

  const { data: toLoc } = await adminDb
    .from("storage_locations")
    .select("is_temp")
    .eq("id", to_location_id)
    .single();

  const resolvedReason = resolveMoveReason(fromIsTemp, !!toLoc?.is_temp, reason);

  try {
    const result = await moveBarcodeToLocation(adminDb, {
      barcodeId,
      toLocationId: to_location_id,
      reason: resolvedReason,
      notes,
      createdBy: admin.email ?? admin.id,
    });

    return NextResponse.json({
      ok: true,
      event_id: result.eventId,
      reason: resolvedReason,
      barcode_no: result.barcodeNo,
      item_name: result.itemName,
      from_location_id: result.fromLocationId,
      to_location_id,
      to_location_code: result.toLocationCode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "이동 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
