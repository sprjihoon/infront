import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/**
 * POST /api/admin/outbound/[id]/session
 * 출고 작업 세션 생성
 *
 * Body: { type: 'intl'|'domestic', worker_email?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { type, worker_email } = (await req.json()) as {
    type: "intl" | "domestic";
    worker_email?: string;
  };

  const insertData: Record<string, unknown> = {
    order_type:     type,
    status:         "STARTED",
    worker_email:   worker_email ?? admin.email ?? null,
    work_started_at: new Date().toISOString(),
  };

  if (type === "intl") {
    insertData.order_id = id;
  } else {
    insertData.domestic_order_id = id;
  }

  const { data: session, error } = await adminDb
    .from("outbound_sessions")
    .insert(insertData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session });
}

/**
 * PATCH /api/admin/outbound/[id]/session
 * 세션 상태·데이터 업데이트
 *
 * Body:
 *   session_id  string
 *   status?     string
 *   scan_log?   object[]
 *   boxes?      object[]
 *   video_url?  string
 *   video_stream_uid? string
 *   video_media_id?   string
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await params; // consume params

  const body = (await req.json()) as {
    session_id: string;
    status?: string;
    scan_log?: unknown[];
    boxes?: unknown[];
    video_url?: string;
    video_stream_uid?: string;
    video_media_id?: string;
  };

  const { session_id, ...rest } = body;
  if (!session_id) return NextResponse.json({ error: "session_id 필수" }, { status: 400 });

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (rest.status !== undefined) updateData.status = rest.status;
  if (rest.scan_log !== undefined) updateData.scan_log = rest.scan_log;
  if (rest.boxes !== undefined) updateData.boxes = rest.boxes;
  if (rest.video_url !== undefined) updateData.video_url = rest.video_url;
  if (rest.video_stream_uid !== undefined) updateData.video_stream_uid = rest.video_stream_uid;
  if (rest.video_media_id !== undefined) updateData.video_media_id = rest.video_media_id;

  if (rest.status === "SCAN_DONE") updateData.scan_done_at = new Date().toISOString();
  if (rest.status === "DONE") updateData.shipping_done_at = new Date().toISOString();

  const { error } = await adminDb
    .from("outbound_sessions")
    .update(updateData)
    .eq("id", session_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
