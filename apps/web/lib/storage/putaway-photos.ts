import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildMockPutawayPhotos,
  shouldUsePutawayMock,
  type PutawayPhotoDto,
} from "@/lib/storage/mock-putaway-photo";

export type { PutawayPhotoDto };

function mapPhotoRows(
  photos: Array<{
    id: string;
    storage_url: string | null;
    caption: string | null;
    created_at: string;
    parcel_id: string | null;
    parcels: { tracking_no: string | null } | { tracking_no: string | null }[] | null;
  }>,
): PutawayPhotoDto[] {
  return photos
    .filter((p) => p.storage_url && p.parcel_id)
    .map((p) => {
      const parcelRow = p.parcels;
      const tracking = Array.isArray(parcelRow)
        ? parcelRow[0]?.tracking_no ?? null
        : parcelRow?.tracking_no ?? null;
      return {
        id: p.id,
        storage_url: p.storage_url as string,
        caption: p.caption,
        created_at: p.created_at,
        parcel_id: p.parcel_id as string,
        tracking_no: tracking,
      };
    });
}

/** 특정 스토리지의 적치 사진 목록 */
export async function fetchPutawayPhotosForStorage(
  supabase: SupabaseClient,
  parcelIds: string[],
): Promise<PutawayPhotoDto[]> {
  if (parcelIds.length === 0) {
    return shouldUsePutawayMock() ? buildMockPutawayPhotos() : [];
  }

  const { data: photos, error } = await supabase
    .from("parcel_media")
    .select(`
      id, storage_url, caption, created_at, parcel_id,
      parcels(tracking_no)
    `)
    .in("parcel_id", parcelIds)
    .eq("stage", "PUTAWAY_PHOTO")
    .not("storage_url", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[putaway-photos] fetch error:", error);
    return shouldUsePutawayMock() ? buildMockPutawayPhotos(parcelIds[0]) : [];
  }

  const mapped = mapPhotoRows(photos ?? []);
  if (mapped.length === 0 && shouldUsePutawayMock()) {
    return buildMockPutawayPhotos(parcelIds[0]);
  }
  return mapped;
}

/** 사용자 전체 스토리지별 적치 사진 (storage_id → photos[]) */
export async function fetchPutawayPhotosByStorage(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, PutawayPhotoDto[]>> {
  const { data: parcels } = await supabase
    .from("parcels")
    .select("id, customer_storage_id")
    .eq("customer_id", userId)
    .not("customer_storage_id", "is", null)
    .not("status", "in", '("SHIPPED","RETURNED","PICKUP_CANCELLED","DISPOSED")');

  const byStorage: Record<string, string[]> = {};
  for (const p of parcels ?? []) {
    const sid = p.customer_storage_id as string;
    if (!byStorage[sid]) byStorage[sid] = [];
    byStorage[sid].push(p.id);
  }

  const result: Record<string, PutawayPhotoDto[]> = {};
  await Promise.all(
    Object.entries(byStorage).map(async ([storageId, parcelIds]) => {
      result[storageId] = await fetchPutawayPhotosForStorage(supabase, parcelIds);
    }),
  );

  // 목업: 스토리지는 있지만 소포/사진 없을 때도 버튼 미리보기
  if (shouldUsePutawayMock()) {
    const { data: storages } = await supabase
      .from("customer_storages")
      .select("id")
      .eq("user_id", userId)
      .neq("status", "CANCELLED");

    for (const s of storages ?? []) {
      if (!result[s.id]?.length) {
        result[s.id] = buildMockPutawayPhotos();
      }
    }
  }

  return result;
}

export function isPutawayMockPhotos(photos: PutawayPhotoDto[]) {
  return photos.some((p) => p.id.startsWith("00000000-mock-"));
}
