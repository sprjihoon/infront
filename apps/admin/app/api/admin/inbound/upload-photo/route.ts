import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const storageClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/inbound/upload-photo
 * 내품 사진 업로드 → Supabase Storage → parcel_media INSERT
 *
 * Form Data:
 *   parcel_id: string
 *   file: File
 *   caption?: string   (예: "T-shirt 1번")
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const parcelId = formData.get("parcel_id") as string;
  const file = formData.get("file") as File | null;
  const caption = (formData.get("caption") as string) || null;

  if (!parcelId || !file) return NextResponse.json({ error: "parcel_id, file 필요" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `inbound/${parcelId}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: storageErr } = await storageClient.storage
    .from("parcel-media")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (storageErr) return NextResponse.json({ error: storageErr.message }, { status: 500 });

  const { data: { publicUrl } } = storageClient.storage.from("parcel-media").getPublicUrl(path);

  const { data, error } = await adminDb.from("parcel_media").insert({
    parcel_id: parcelId,
    stage: "INSPECTION_PHOTO",
    type: "PHOTO",
    storage_url: publicUrl,
    caption,
    is_visible: true,
    uploaded_by: admin.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, media: data, url: publicUrl });
}
