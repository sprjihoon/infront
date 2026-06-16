import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

const storageClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/admin/location-events/[id]/photo
 * 로케이션 이동 후 적치 확인 사진 1장 업로드
 *
 * Form Data:
 *   file: File (required)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: eventId } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "file 필요" }, { status: 400 });
  }

  const { data: event, error: eventErr } = await adminDb
    .from("parcel_location_events")
    .select("id, parcel_id, photo_url, to_location_id, to_location:to_location_id(code)")
    .eq("id", eventId)
    .single();

  if (eventErr || !event) {
    return NextResponse.json({ error: "이동 이력을 찾을 수 없습니다" }, { status: 404 });
  }

  if (event.photo_url) {
    return NextResponse.json({ error: "이미 사진이 등록된 이동입니다" }, { status: 409 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `putaway/${event.parcel_id}/${eventId}-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: storageErr } = await storageClient.storage
    .from("parcel-media")
    .upload(path, arrayBuffer, { contentType: file.type || "image/jpeg", upsert: false });

  if (storageErr) {
    console.error("[location-events/photo] storage upload error:", storageErr);
    return NextResponse.json({ error: storageErr.message }, { status: 500 });
  }

  const { data: { publicUrl } } = storageClient.storage.from("parcel-media").getPublicUrl(path);
  const toLocation = event.to_location as unknown as { code: string } | null;
  const locCode = toLocation?.code ?? "";

  const { error: updateErr } = await adminDb
    .from("parcel_location_events")
    .update({ photo_url: publicUrl })
    .eq("id", eventId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const { data: media, error: mediaErr } = await adminDb
    .from("parcel_media")
    .insert({
      parcel_id: event.parcel_id,
      stage: "PUTAWAY_PHOTO",
      type: "PHOTO",
      storage_url: publicUrl,
      caption: locCode ? `적치 확인 · ${locCode}` : "적치 확인",
      is_visible: true,
      uploaded_by: admin.id,
      location_event_id: eventId,
    })
    .select()
    .single();

  if (mediaErr) {
    console.error("[location-events/photo] parcel_media insert error:", mediaErr);
  }

  return NextResponse.json({
    ok: true,
    photo_url: publicUrl,
    media,
  });
}
