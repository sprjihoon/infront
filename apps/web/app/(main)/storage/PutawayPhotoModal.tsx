"use client";

import { X } from "lucide-react";
import { isMockPutawayPhoto, type PutawayPhotoDto } from "@/lib/storage/mock-putaway-photo";

export default function PutawayPhotoModal({
  photos,
  index,
  onIndexChange,
  onClose,
  isMock = false,
}: {
  photos: PutawayPhotoDto[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  isMock?: boolean;
}) {
  const photo = photos[index];
  if (!photo) return null;

  const showMock = isMock || isMockPutawayPhoto(photo.id);
  const takenAt = new Date(photo.created_at).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-gray-900">보관함 적치 사진</p>
              {showMock && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  목업
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{photo.caption ?? "센터 적치 확인"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.storage_url}
            alt="보관함 적치 사진"
            className="w-full max-h-[60vh] object-contain"
          />
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{takenAt}</span>
            {photo.tracking_no && <span className="font-mono">{photo.tracking_no}</span>}
          </div>

          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 ${
                    i === index ? "border-brand-600" : "border-transparent opacity-60"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.storage_url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
