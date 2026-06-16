import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import {
  LOCATION_MOVE_REASONS,
  moveParcelToLocation,
  resolveMoveReason,
} from "@/lib/storage/location-move";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: parcelId } = await params;
  const body = await req.json();
  const { to_location_id, reason, notes } = body as {
    to_location_id: string;
    reason?: string;
    notes?: string;
  };

  if (!to_location_id) {
    return NextResponse.json({ error: "to_location_id 필수" }, { status: 400 });
  }

  const { data: parcel } = await adminDb
    .from("parcels")
    .select("storage_location_id")
    .eq("id", parcelId)
    .single();

  let fromIsTemp = false;
  if (parcel?.storage_location_id) {
    const { data: fromLoc } = await adminDb
      .from("storage_locations")
      .select("is_temp")
      .eq("id", parcel.storage_location_id)
      .single();
    fromIsTemp = !!fromLoc?.is_temp;
  }

  const { data: toLoc } = await adminDb
    .from("storage_locations")
    .select("is_temp")
    .eq("id", to_location_id)
    .single();

  const resolvedReason = resolveMoveReason(fromIsTemp, !!toLoc?.is_temp, reason);

  if (reason && !LOCATION_MOVE_REASONS.includes(reason as typeof LOCATION_MOVE_REASONS[number])) {
    return NextResponse.json(
      { error: `reason은 ${LOCATION_MOVE_REASONS.join(", ")} 중 하나` },
      { status: 400 },
    );
  }

  try {
    const { eventId } = await moveParcelToLocation(adminDb, {
      parcelId,
      toLocationId: to_location_id,
      reason: resolvedReason,
      notes,
      createdBy: admin.email ?? admin.id,
    });

    return NextResponse.json({ ok: true, event_id: eventId, reason: resolvedReason });
  } catch (err) {
    const message = err instanceof Error ? err.message : "이동 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
