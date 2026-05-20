"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Package, Truck, MapPin, Weight, Ruler,
  AlertTriangle, CheckCircle, Clock, Play, Image as ImageIcon,
  RotateCcw, Send, ChevronRight, FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Parcel {
  id: string;
  tracking_no: string | null;
  pickup_tracking_no: string | null;
  status: string;
  sender_name: string | null;
  sender_address: string | null;
  sender_phone: string | null;
  weight_actual: number | null;
  vol_length: number | null;
  vol_width: number | null;
  vol_height: number | null;
  is_shippable: boolean | null;
  hold_reason: string | null;
  notes: string | null;
  inbound_at: string | null;
  created_at: string;
}

interface ParcelMedia {
  id: string;
  stage: string;
  type: string;
  storage_url: string;
  cf_thumbnail_url: string | null;
  cf_hls_url: string | null;
  caption: string | null;
  created_at: string;
}

interface InspectionResult {
  id: string;
  grade: string;
  checklist: Record<string, unknown>;
  notes: string | null;
  inspected_at: string;
}

interface LinkedOrder {
  order_id: string;
  orders: { order_no: string; status: string; created_at: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; step: number }> = {
  PENDING_PICKUP:  { label: "수거 신청 완료", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", step: 1 },
  PICKED_UP:       { label: "수거 완료",      color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",     step: 2 },
  INBOUND:         { label: "창고 입고",       color: "text-green-700",  bg: "bg-green-50 border-green-200",   step: 3 },
  INSPECTION:      { label: "검품 진행 중",    color: "text-purple-700", bg: "bg-purple-50 border-purple-200", step: 4 },
  PACKING:         { label: "포장 작업 중",    color: "text-orange-700", bg: "bg-orange-50 border-orange-200", step: 5 },
  HOLD:            { label: "보류",            color: "text-red-700",    bg: "bg-red-50 border-red-200",       step: 3 },
  PAYMENT_WAIT:    { label: "결제 대기",       color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",   step: 5 },
  SHIPPING:        { label: "국제 발송 중",    color: "text-blue-800",   bg: "bg-blue-100 border-blue-300",    step: 6 },
  DONE:            { label: "배송 완료",       color: "text-gray-700",   bg: "bg-gray-50 border-gray-200",     step: 7 },
};

const STAGE_LABEL: Record<string, string> = {
  INBOUND_VIDEO:    "입고 영상",
  INSPECTION_PHOTO: "검수 사진",
  PACKAGING_PHOTO:  "포장 사진",
  OUTBOUND_VIDEO:   "발송 영상",
};

const GRADE_CONFIG: Record<string, { label: string; color: string }> = {
  OK:                   { label: "정상", color: "text-green-700 bg-green-100" },
  HOLD:                 { label: "보류", color: "text-yellow-700 bg-yellow-100" },
  RETURN_RECOMMENDED:   { label: "반품 권장", color: "text-red-700 bg-red-100" },
};

const SHIPPABLE_STATUSES = new Set(["INBOUND", "INSPECTION"]);
const RETURNABLE_STATUSES = new Set(["INBOUND", "INSPECTION", "HOLD"]);

export default function ParcelDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const parcelId = params.id;

  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [media, setMedia] = useState<ParcelMedia[]>([]);
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [linkedOrders, setLinkedOrders] = useState<LinkedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<ParcelMedia | null>(null);

  useEffect(() => {
    if (!parcelId) return;
    const supabase = createClient();

    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [
        { data: parcelData },
        { data: mediaData },
        { data: inspData },
        { data: orderData },
      ] = await Promise.all([
        supabase.from("parcels").select("*").eq("id", parcelId).eq("customer_id", user.id).maybeSingle(),
        supabase.from("parcel_media").select("*").eq("parcel_id", parcelId).order("created_at"),
        supabase.from("inspection_results").select("*").eq("parcel_id", parcelId).order("inspected_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("order_parcels").select("order_id, orders(order_no, status, created_at)").eq("parcel_id", parcelId),
      ]);

      if (!parcelData) { router.push("/warehouse"); return; }
      setParcel(parcelData);
      setMedia(mediaData ?? []);
      setInspection(inspData ?? null);
      setLinkedOrders(orderData as unknown as LinkedOrder[] ?? []);
      setLoading(false);
    }

    load();
  }, [parcelId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!parcel) return null;

  const statusCfg = STATUS_CONFIG[parcel.status] ?? { label: parcel.status, color: "text-gray-700", bg: "bg-gray-50 border-gray-200", step: 0 };
  const canShip = SHIPPABLE_STATUSES.has(parcel.status) && parcel.is_shippable !== false;
  const canReturn = RETURNABLE_STATUSES.has(parcel.status);

  const mediaByStage = media.reduce<Record<string, ParcelMedia[]>>((acc, m) => {
    (acc[m.stage] = acc[m.stage] ?? []).push(m);
    return acc;
  }, {});

  return (
    <div className="px-4 py-5 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition-transform">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">물품 상세</h1>
      </div>

      {/* 상태 카드 */}
      <div className={`border rounded-2xl p-4 ${statusCfg.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-lg font-bold ${statusCfg.color}`}>{statusCfg.label}</p>
            {parcel.hold_reason && (
              <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <AlertTriangle size={14} /> {parcel.hold_reason}
              </p>
            )}
          </div>
          {parcel.is_shippable === false && parcel.status !== "HOLD" && (
            <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">
              배송 불가
            </span>
          )}
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">기본 정보</h2>
        <div className="space-y-2">
          <InfoRow icon={<Package size={15} className="text-gray-400" />} label="운송장" value={parcel.tracking_no ?? "미등록"} />
          {parcel.pickup_tracking_no && (
            <InfoRow icon={<Truck size={15} className="text-gray-400" />} label="수거 운송장" value={parcel.pickup_tracking_no} />
          )}
          {parcel.sender_name && (
            <InfoRow icon={<MapPin size={15} className="text-gray-400" />} label="발송인" value={parcel.sender_name} />
          )}
          {parcel.sender_address && (
            <InfoRow icon={<MapPin size={15} className="text-gray-400" />} label="발송지" value={parcel.sender_address} />
          )}
          {parcel.inbound_at && (
            <InfoRow icon={<Clock size={15} className="text-gray-400" />} label="입고일" value={new Date(parcel.inbound_at).toLocaleDateString("ko-KR")} />
          )}
          <InfoRow icon={<Clock size={15} className="text-gray-400" />} label="접수일" value={new Date(parcel.created_at).toLocaleDateString("ko-KR")} />
        </div>
      </div>

      {/* 실측 정보 */}
      {(parcel.weight_actual || parcel.vol_length) && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">측정 정보</h2>
          <div className="grid grid-cols-2 gap-3">
            {parcel.weight_actual && (
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Weight size={20} className="text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900">{parcel.weight_actual}g</p>
                <p className="text-xs text-gray-500">실측 무게</p>
              </div>
            )}
            {parcel.vol_length && parcel.vol_width && parcel.vol_height && (
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Ruler size={20} className="text-violet-500 mx-auto mb-1" />
                <p className="text-base font-bold text-gray-900">
                  {parcel.vol_length}×{parcel.vol_width}×{parcel.vol_height}
                </p>
                <p className="text-xs text-gray-500">cm (L×W×H)</p>
              </div>
            )}
          </div>
          {parcel.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
              <p className="font-medium mb-0.5">메모</p>
              <p>{parcel.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* 검수 결과 */}
      {inspection && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">검수 결과</h2>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${GRADE_CONFIG[inspection.grade]?.color ?? "text-gray-700 bg-gray-100"}`}>
              {GRADE_CONFIG[inspection.grade]?.label ?? inspection.grade}
            </span>
          </div>
          <div className="space-y-1.5">
            {(Object.entries(inspection.checklist) as [string, unknown][]).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                {val ? (
                  <CheckCircle size={15} className="text-green-500 shrink-0" />
                ) : (
                  <AlertTriangle size={15} className="text-red-400 shrink-0" />
                )}
                <span className="text-gray-700">{CHECKLIST_LABEL[key] ?? key}</span>
              </div>
            ))}
          </div>
          {inspection.notes && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{inspection.notes}</p>
          )}
          <p className="text-xs text-gray-400">
            검수일: {new Date(inspection.inspected_at).toLocaleDateString("ko-KR")}
          </p>
        </div>
      )}

      {/* 미디어 타임라인 */}
      {media.length > 0 ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">미디어 타임라인</h2>
          {Object.entries(mediaByStage).map(([stage, items]) => (
            <div key={stage} className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {STAGE_LABEL[stage] ?? stage}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {items.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMedia(m)}
                    className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 active:scale-95 transition-transform"
                  >
                    {m.cf_thumbnail_url ? (
                      <img src={m.cf_thumbnail_url} alt={m.caption ?? ""} className="w-full h-full object-cover" />
                    ) : m.type === "VIDEO" ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play size={24} className="text-gray-400" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={24} className="text-gray-400" />
                      </div>
                    )}
                    {m.type === "VIDEO" && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/40 rounded-full p-1.5">
                          <Play size={16} className="text-white fill-white" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center py-8">
          <ImageIcon size={36} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">아직 업로드된 사진·영상이 없습니다</p>
          <p className="text-xs text-gray-300 mt-0.5">입고 후 오픈박스 영상이 등록됩니다</p>
        </div>
      )}

      {/* 연결된 주문 */}
      {linkedOrders.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">연결된 배송 주문</h2>
          {linkedOrders.map((lo) => (
            lo.orders && (
              <Link
                key={lo.order_id}
                href="/orders"
                className="flex items-center justify-between py-2 border-t first:border-t-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{lo.orders.order_no}</p>
                  <p className="text-xs text-gray-400">{new Date(lo.orders.created_at).toLocaleDateString("ko-KR")}</p>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </Link>
            )
          ))}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="space-y-2 pb-2">
        {canShip && (
          <Link
            href={`/shipping-request?parcels=${parcel.id}`}
            className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl active:scale-[0.98] transition-transform shadow"
          >
            <Send size={18} />
            해외배송 신청
          </Link>
        )}
        {canReturn && (
          <Link
            href={`/return-request?parcel_id=${parcel.id}`}
            className="flex items-center justify-center gap-2 w-full bg-white border border-gray-200 text-gray-700 font-semibold py-4 rounded-2xl active:scale-[0.98] transition-transform shadow-sm"
          >
            <RotateCcw size={18} />
            반품 신청
          </Link>
        )}
        <Link
          href="/box-delivery"
          className="flex items-center justify-center gap-2 w-full bg-white border border-gray-200 text-gray-700 font-medium py-3 rounded-2xl active:scale-[0.98] transition-transform shadow-sm"
        >
          <FileText size={16} className="text-gray-500" />
          <span className="text-sm">빈 박스 신청</span>
        </Link>
      </div>

      {/* 미디어 뷰어 모달 */}
      {selectedMedia && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <div className="max-w-[400px] w-full" onClick={(e) => e.stopPropagation()}>
            {selectedMedia.type === "VIDEO" && selectedMedia.cf_hls_url ? (
              <video
                src={selectedMedia.cf_hls_url}
                controls
                className="w-full rounded-xl"
                autoPlay
              />
            ) : (
              <img
                src={selectedMedia.storage_url}
                alt={selectedMedia.caption ?? ""}
                className="w-full rounded-xl"
              />
            )}
            {selectedMedia.caption && (
              <p className="text-white text-sm text-center mt-3">{selectedMedia.caption}</p>
            )}
            <button
              onClick={() => setSelectedMedia(null)}
              className="w-full mt-4 text-white/70 text-sm py-2"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 flex-1 break-all">{value}</span>
    </div>
  );
}

const CHECKLIST_LABEL: Record<string, string> = {
  condition_ok:    "전반적 상태 양호",
  size_match:      "사이즈 일치",
  color_match:     "색상 일치",
  defect:          "결함 없음",
  authenticity_ok: "정품 확인",
};
