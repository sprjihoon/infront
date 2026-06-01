import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const [{ data: location }, { data: parcels }] = await Promise.all([
    adminDb
      .from("storage_locations")
      .select("*, customers(id, name, customer_code, email)")
      .eq("id", id)
      .single(),
    adminDb
      .from("parcels")
      .select("id, tracking_no, status, is_shippable, inbound_at, weight_actual, pre_invoice_items, sender_name")
      .eq("storage_location_id", id)
      .not("status", "in", '("DONE")')
      .order("inbound_at", { ascending: false }),
  ]);

  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ location, parcels: parcels ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { action } = body;

  // ── 고객 할당 ──────────────────────────────────────────────────
  if (action === "assign") {
    const { customer_id } = body;
    if (!customer_id) return NextResponse.json({ error: "customer_id 필수" }, { status: 400 });

    // 해당 고객이 이미 다른 로케이션을 점유 중인지 확인
    const { data: existing } = await adminDb
      .from("storage_locations")
      .select("id, code")
      .eq("customer_id", customer_id)
      .eq("status", "OCCUPIED")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `이미 ${existing.code} 로케이션을 사용 중입니다.` },
        { status: 409 }
      );
    }

    const { data, error } = await adminDb
      .from("storage_locations")
      .update({ customer_id, status: "OCCUPIED", assigned_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, location: data });
  }

  // ── 고객 해제 (빈 공간으로) ────────────────────────────────────
  if (action === "release") {
    // 보관 중인 소포 있으면 해제 불가
    const { count } = await adminDb
      .from("parcels")
      .select("id", { count: "exact", head: true })
      .eq("storage_location_id", id)
      .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")');

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `보관 중인 소포 ${count}개가 있어 해제할 수 없습니다.` },
        { status: 409 }
      );
    }

    const { data, error } = await adminDb
      .from("storage_locations")
      .update({ customer_id: null, status: "AVAILABLE", assigned_at: null })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, location: data });
  }

  // ── 상태 변경 (DISABLED ↔ AVAILABLE) ───────────────────────────
  if (action === "set_status") {
    const { status, notes } = body;
    if (!["AVAILABLE", "DISABLED"].includes(status)) {
      return NextResponse.json({ error: "status는 AVAILABLE 또는 DISABLED" }, { status: 400 });
    }
    const updates: Record<string, unknown> = { status };
    if (notes !== undefined) updates.notes = notes || null;
    if (status === "AVAILABLE") updates.customer_id = null;

    const { data, error } = await adminDb
      .from("storage_locations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, location: data });
  }

  // ── 타입 변경 ──────────────────────────────────────────────────
  if (action === "set_type") {
    const { type_id } = body; // null 허용 (미지정)
    const { data, error } = await adminDb
      .from("storage_locations")
      .update({ storage_type_id: type_id ?? null })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, location: data });
  }

  // ── 노트 수정 ──────────────────────────────────────────────────
  if (action === "update_notes") {
    const { notes } = body;
    const { data, error } = await adminDb
      .from("storage_locations")
      .update({ notes: notes || null })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, location: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // 소포가 연결된 경우 삭제 불가
  const { count } = await adminDb
    .from("parcels")
    .select("id", { count: "exact", head: true })
    .eq("storage_location_id", id);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `연결된 소포 ${count}개가 있어 삭제할 수 없습니다.` },
      { status: 409 }
    );
  }

  const { error } = await adminDb.from("storage_locations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
