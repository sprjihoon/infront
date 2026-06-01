import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CF_API_TOKEN  = process.env.CLOUDFLARE_STREAM_API_TOKEN!;

/**
 * POST /api/admin/inbound/stream-upload
 * Cloudflare Stream TUS 업로드 URL 발급 + parcel_media 레코드 생성
 *
 * Body: { parcel_id: string, file_size: number }
 * Response: { upload_url, media_id, stream_uid }
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { parcel_id, file_size } = await req.json() as { parcel_id: string; file_size: number };
  if (!parcel_id) return NextResponse.json({ error: "parcel_id 필요" }, { status: 400 });

  // Cloudflare Stream TUS 업로드 URL 발급
  const tusRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream?direct_user=true`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CF_API_TOKEN}`,
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(file_size ?? 0),
      "Upload-Metadata": `name ${btoa("openbox-video")},parcel_id ${btoa(parcel_id)}`,
    },
  });

  if (!tusRes.ok) {
    const txt = await tusRes.text();
    return NextResponse.json({ error: `Cloudflare 오류: ${txt}` }, { status: 500 });
  }

  const streamUid = tusRes.headers.get("stream-media-id") ?? "";
  const uploadUrl = tusRes.headers.get("location") ?? "";

  // parcel_media 레코드 선 생성 (영상 처리 중 상태)
  const { data: media, error } = await adminDb.from("parcel_media").insert({
    parcel_id,
    stage: "INBOUND_VIDEO",
    type: "VIDEO",
    cf_stream_uid: streamUid,
    is_visible: true,
    uploaded_by: admin.id,
    caption: "오픈박스 영상",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, upload_url: uploadUrl, stream_uid: streamUid, media_id: media.id });
}

/**
 * PATCH /api/admin/inbound/stream-upload
 * 업로드 완료 후 thumbnail/hls URL 업데이트
 *
 * Body: { media_id, stream_uid }
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { media_id, stream_uid } = await req.json() as { media_id: string; stream_uid: string };

  const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${stream_uid}`, {
    headers: { "Authorization": `Bearer ${CF_API_TOKEN}` },
  });

  const cfData = await cfRes.json() as { result?: { thumbnail?: string; playback?: { hls?: string }; duration?: number } };
  const result = cfData.result;

  await adminDb.from("parcel_media").update({
    cf_thumbnail_url: result?.thumbnail ?? null,
    cf_hls_url: result?.playback?.hls ?? null,
    duration_sec: result?.duration ? Math.round(result.duration) : null,
  }).eq("id", media_id);

  return NextResponse.json({ ok: true });
}
