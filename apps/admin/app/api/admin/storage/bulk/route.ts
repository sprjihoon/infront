import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

// 일괄 변경: 타입 / 상태
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { ids, action } = body as { ids: string[]; action: string };

  if (!ids?.length) return NextResponse.json({ error: "ids 필수" }, { status: 400 });

  // ── 타입 일괄 변경 ─────────────────────────────────────
  if (action === "set_type") {
    const { type_id } = body; // null 허용 (미지정)
    const { error, count } = await adminDb
      .from("storage_locations")
      .update({ storage_type_id: type_id ?? null })
      .in("id", ids);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: count });
  }

  // ── 상태 일괄 변경 ─────────────────────────────────────
  if (action === "set_status") {
    const { status } = body as { status: string };
    if (!["AVAILABLE", "DISABLED"].includes(status)) {
      return NextResponse.json({ error: "status는 AVAILABLE 또는 DISABLED만 가능" }, { status: 400 });
    }

    // OCCUPIED / RESERVED / PENDING_OUT 은 자동 제외 (보관중 슬롯은 상태 강제변경 불가)
    const updates: Record<string, unknown> = { status };
    if (status === "AVAILABLE") updates.customer_id = null;

    const { error, count } = await adminDb
      .from("storage_locations")
      .update(updates)
      .in("id", ids)
      .not("status", "in", '("OCCUPIED","RESERVED","PENDING_OUT")');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: count });
  }

  // ── 일괄 삭제 ─────────────────────────────────────────
  if (action === "delete") {
    // 소포 연결된 슬롯은 제외
    const { data: safe } = await adminDb
      .from("storage_locations")
      .select("id")
      .in("id", ids)
      .not("status", "in", '("OCCUPIED","RESERVED","PENDING_OUT")');

    const safeIds = (safe ?? []).map((l) => l.id);
    if (!safeIds.length) {
      return NextResponse.json({ error: "선택된 슬롯이 모두 보관중/배정중이라 삭제할 수 없습니다." }, { status: 409 });
    }

    const { error } = await adminDb
      .from("storage_locations")
      .delete()
      .in("id", safeIds);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: safeIds.length, skipped: ids.length - safeIds.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
