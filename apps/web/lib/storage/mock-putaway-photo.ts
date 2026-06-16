/** 스토리지 상세 — 적치 사진 UI 미리보기용 목업 */

export const MOCK_PUTAWAY_PHOTO_ID = "00000000-mock-0000-0000-000000000099";

export type PutawayPhotoDto = {
  id: string;
  storage_url: string;
  caption: string | null;
  created_at: string;
  parcel_id: string;
  tracking_no: string | null;
};

export function isMockPutawayPhoto(id: string) {
  return id === MOCK_PUTAWAY_PHOTO_ID || id.startsWith("00000000-mock-");
}

export function buildMockPutawayPhotos(parcelId?: string | null): PutawayPhotoDto[] {
  return [
    {
      id: MOCK_PUTAWAY_PHOTO_ID,
      storage_url:
        "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80",
      caption: "적치 확인 · A-012",
      created_at: new Date().toISOString(),
      parcel_id: parcelId ?? "00000000-mock-0000-0000-000000000001",
      tracking_no: "MOCK-PUTAWAY-001",
    },
  ];
}

export function shouldUsePutawayMock() {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_SHOW_PUTAWAY_MOCK === "true"
  );
}
