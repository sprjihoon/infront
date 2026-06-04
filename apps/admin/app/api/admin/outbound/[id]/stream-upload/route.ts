import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CF_API_TOKEN  = process.env.CLOUDFLARE_STREAM_API_TOKEN!;

/**
 * POST /api/admin/outbound/[id]/stream-upload
 * 출고 패킹 영상 Cloudflare Stream 업로드 URL 발급
 *
 * Body: { type: 'intl'|'domestic', file_size: number, parcel_id: string }
 * parcel_id: parcel_media를 연결할 소포 ID (첫 번째 소포 사용)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { file_size, parcel_id } = (await req.json()) as {
    file_size: number;
    parcel_id: string;
  };

  if (!parcel_id) return NextResponse.json({ error: "parcel_id 필수" }, { status: 400 });

  const tusRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream?direct_user=true`,
    {
      method: "POST",
      headers: {
        Authorization:    `Bearer ${CF_API_TOKEN}`,
        "Tus-Resumable":  "1.0.0",
        "Upload-Length":  String(file_size ?? 0),
        "Upload-Metadata": `name ${btoa("outbound-pack-video")},order_id ${btoa(id)}`,
      },
    },
  );

  if (!tusRes.ok) {
    const txt = await tusRes.text();
    return NextResponse.json({ error: `Cloudflare 오류: ${txt}` }, { status: 500 });
  }

  const streamUid = tusRes.headers.get("stream-media-id") ?? "";
  const uploadUrl = tusRes.headers.get("location") ?? "";

  const { data: media, error } = await adminDb
    .from("parcel_media")
    .insert({
      parcel_id,
      stage:       "OUTBOUND_VIDEO",
      type:        "VIDEO",
      cf_stream_uid: streamUid,
      is_visible:  true,
      uploaded_by: admin.id,
      caption:     "출고 패킹 영상",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    upload_url: uploadUrl,
    stream_uid: streamUid,
    media_id:   media.id,
  });
}

/**
 * PATCH /api/admin/outbound/[id]/stream-upload
 * 업로드 완료 후 URL 업데이트 + 세션에 영상 URL 저장
 *
 * Body: { media_id, stream_uid, session_id? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await params;
  const { media_id, stream_uid, session_id } = (await req.json()) as {
    media_id: string;
    stream_uid: string;
    session_id?: string;
  };

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${stream_uid}`,
    { headers: { Authorization: `Bearer ${CF_API_TOKEN}` } },
  );

  const cfData = await cfRes.json() as {
    result?: { thumbnail?: string; playback?: { hls?: string }; duration?: number };
  };
  const result = cfData.result;

  await adminDb.from("parcel_media").update({
    cf_thumbnail_url: result?.thumbnail ?? null,
    cf_hls_url:       result?.playback?.hls ?? null,
    duration_sec:     result?.duration ? Math.round(result.duration) : null,
  }).eq("id", media_id);

  // 세션에 영상 URL 저장
  if (session_id && result?.playback?.hls) {
    await adminDb
      .from("outbound_sessions")
      .update({
        video_url:        result.playback.hls,
        video_stream_uid: stream_uid,
        video_media_id:   media_id,
        updated_at:       new Date().toISOString(),
      })
      .eq("id", session_id);
  }

  return NextResponse.json({ ok: true });
}
