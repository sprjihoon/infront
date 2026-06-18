import { NextResponse } from "next/server";
import { getCachedStorageTypes } from "@/lib/storage/cached-types";

/** GET /api/storage/types — 스토리지 타입 목록 (1시간 서버 캐시) */
export async function GET() {
  try {
    const types = await getCachedStorageTypes();
    return NextResponse.json({ types });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
