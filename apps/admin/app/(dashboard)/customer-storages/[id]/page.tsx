"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, RefreshCw, Package, User, MapPin, Tag,
  Check, ChevronDown, X, AlertTriangle, CheckCircle,
  Clock, CreditCard,
} from "lucide-react";

interface CustomerInfo {
  id: string;
  name: string | null;
  email: string;
  customer_code: string;
  phone: string | null;
}

interface StorageDetail {
  id: string;
  storage_name: string;
  storage_mode: "short_term" | "long_term";
  plan_type: string | null;
  current_plan_type: string | null;
  max_plan_type: string | null;
  monthly_amount: number | null;
  capacity_score: number | null;
  used_score: number;
  usage_percent: number;
  status: string;
  short_term_started_at: string | null;
  paid_until_date: string | null;
  next_billing_date: string | null;
  notes: string | null;
  created_at: string;
  customers: CustomerInfo | null;
  storage_plan_config: {
    label_ko: string;
    weekly_rate: number | null;
    monthly_amount: number | null;
  } | null;
}

interface StorageItem {
  id: string;
  product_name: string;
  category: string | null;
  capacity_score: number;
  location_code: string | null;
  status: string;
  source: string;
  verification_status: string;
  received_at: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  payment_type: string;
  amount: number;
  status: string;
  approved_at: string | null;
  billing_memo: string | null;
  created_at: string;
}

const ITEM_STATUSES = [
  { value: "PENDING_INBOUND", label: "입고 대기",  color: "bg-yellow-100 text-yellow-700" },
  { value: "IN_STORAGE",      label: "보관 중",    color: "bg-green-100 text-green-700" },
  { value: "PENDING_RELEASE", label: "출고 요청",  color: "bg-blue-100 text-blue-700" },
  { value: "RELEASED",        label: "출고 완료",  color: "bg-gray-100 text-gray-500" },
];

const VERIFY_STATUSES = [
  { value: "unverified",     label: "미확인",          color: "bg-gray-100 text-gray-500" },
  { value: "list_only",      label: "리스트 확인",      color: "bg-blue-100 text-blue-700" },
  { value: "photo_verified", label: "사진+검품 완료",   color: "bg-purple-100 text-purple-700" },
];

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  PICKUP_FEE:           "수거비",
  LISTING_FEE:          "리스트 확인비",
  PHOTO_INSPECTION_FEE: "사진+검품비",
  SHORT_TERM_STORAGE:   "단기보관료",
  LONG_TERM_MONTHLY:    "장기보관 월정액",
  UPGRADE_FEE:          "플랜 업그레이드",
  RELEASE_FEE:          "출고 처리비",
  SHIPPING_FEE:         "배송비",
  OPEN_CHECK_FEE:       "개봉 확인비",
  PENALTY_FEE:          "페널티",
};

function calcWeeks(startedAt: string | null) {
  if (!startedAt) return 0;
  return Math.ceil((Date.now() - new Date(startedAt).getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export default function AdminStorageDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [storage, setStorage] = useState<StorageDetail | null>(null);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "payments" | "info">("items");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemStatusUpdating, setItemStatusUpdating] = useState<string | null>(null);
  const [locationInput, setLocationInput] = useState<Record<string, string>>({});
  const [storageNotes, setStorageNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/customer-storages/${id}`);
      const json = await res.json();
      setStorage(json.storage);
      setItems(json.items ?? []);
      setPayments(json.payments ?? []);
      setStorageNotes(json.storage?.notes ?? "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function updateItemStatus(
    itemId: string,
    field: "status" | "verification_status" | "location_code",
    value: string
  ) {
    setItemStatusUpdating(itemId);
    const body: Record<string, string> = { [field]: value };
    if (field === "status" && value === "IN_STORAGE") {
      body.received_at = new Date().toISOString();
    }
    if (field === "status" && value === "RELEASED") {
      body.released_at = new Date().toISOString();
    }
    const res = await fetch(`/api/admin/customer-storages/${id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, ...json.item } : it));
    }
    setItemStatusUpdating(null);
    setEditingItemId(null);
  }

  async function saveLocation(itemId: string) {
    const loc = locationInput[itemId]?.trim();
    if (!loc) return;
    await updateItemStatus(itemId, "location_code", loc);
    setLocationInput((p) => { const n = { ...p }; delete n[itemId]; return n; });
  }

  async function updateStorageStatus(status: string) {
    const res = await fetch(`/api/admin/customer-storages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const json = await res.json();
      setStorage((s) => s ? { ...s, status: json.storage.status } : s);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    const res = await fetch(`/api/admin/customer-storages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: storageNotes }),
    });
    if (res.ok) {
      const json = await res.json();
      setStorage((s) => s ? { ...s, notes: json.storage.notes } : s);
    }
    setSavingNotes(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!storage) {
    return (
      <div className="p-6 text-center text-sm text-gray-500">
        스토리지를 찾을 수 없습니다.
        <button onClick={() => router.back()} className="ml-2 text-brand-600 underline">돌아가기</button>
      </div>
    );
  }

  const weeksUsed = calcWeeks(storage.short_term_started_at);
  const inStorageCount = items.filter((it) => it.status === "IN_STORAGE").length;

  return (
    <div className="p-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">{storage.storage_name}</h1>
          <p className="text-xs text-gray-400">
            {storage.customers?.customer_code} · {storage.customers?.name ?? storage.customers?.email}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="p-2 rounded-xl hover:bg-gray-100"
        >
          <RefreshCw size={16} className={`text-gray-400 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 grid grid-cols-2 gap-4">
        <InfoCell label="보관 방식" value={storage.storage_mode === "short_term" ? "단기보관" : "장기보관"} />
        <InfoCell label="플랜" value={storage.storage_plan_config?.label_ko ?? storage.plan_type ?? "-"} />
        <InfoCell label="상태">
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              storage.status === "ACTIVE" ? "bg-green-100 text-green-700" :
              storage.status === "SUSPENDED" ? "bg-orange-100 text-orange-700" :
              storage.status === "OVERDUE" ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-500"
            }`}>{storage.status}</span>
            <select
              onChange={(e) => { if (e.target.value) updateStorageStatus(e.target.value); e.target.value = ""; }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none"
              defaultValue=""
            >
              <option value="" disabled>상태 변경</option>
              {["ACTIVE","EMPTY","SUSPENDED","OVERDUE","CANCELLED"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </InfoCell>
        <InfoCell label="용량" value={
          storage.capacity_score != null
            ? `${storage.used_score}/${storage.capacity_score}점 (${Math.round(storage.usage_percent ?? 0)}%)`
            : "-"
        } />
        {storage.storage_mode === "short_term" ? (
          <>
            <InfoCell label="보관 기간" value={`${weeksUsed}주 경과`} />
            <InfoCell label="최대 사용 플랜" value={storage.max_plan_type ? `${storage.max_plan_type} 플랜` : "-"} />
          </>
        ) : (
          <>
            <InfoCell label="이용 만료일" value={storage.paid_until_date ? new Date(storage.paid_until_date).toLocaleDateString("ko-KR") : "-"} />
            <InfoCell label="다음 결제일" value={storage.next_billing_date ? new Date(storage.next_billing_date).toLocaleDateString("ko-KR") : "-"} />
          </>
        )}
        <div className="col-span-2">
          <InfoCell label="고객 연락처">
            <p className="text-sm text-gray-800 mt-0.5">{storage.customers?.email}</p>
            <p className="text-xs text-gray-500">{storage.customers?.phone ?? "-"}</p>
          </InfoCell>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
        {[
          { key: "items", label: `내품 (${items.length})` },
          { key: "payments", label: `결제 (${payments.length})` },
          { key: "info", label: "메모" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeTab === key ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 내품 탭 */}
      {activeTab === "items" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">
              보관 내품 <span className="text-gray-400 font-normal">{inStorageCount}개 보관 중</span>
            </p>
          </div>
          {items.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2">
              <Package size={24} className="text-gray-200" />
              <p className="text-sm text-gray-400">등록된 내품이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map((item) => {
                const sStat = ITEM_STATUSES.find((s) => s.value === item.status);
                const vStat = VERIFY_STATUSES.find((s) => s.value === item.verification_status);
                const isEditing = editingItemId === item.id;

                return (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sStat?.color ?? "bg-gray-100 text-gray-500"}`}>
                            {sStat?.label ?? item.status}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${vStat?.color ?? "bg-gray-100 text-gray-500"}`}>
                            {vStat?.label ?? item.verification_status}
                          </span>
                          {item.location_code && (
                            <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                              <MapPin size={9} />
                              {item.location_code}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400">{item.capacity_score}점</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingItemId(isEditing ? null : item.id)}
                        className="text-xs text-brand-600 border border-brand-200 rounded-lg px-2 py-1 shrink-0"
                      >
                        {isEditing ? "닫기" : "편집"}
                      </button>
                    </div>

                    {isEditing && (
                      <div className="mt-3 space-y-2 bg-gray-50 rounded-xl p-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">보관 상태</p>
                          <div className="flex flex-wrap gap-1.5">
                            {ITEM_STATUSES.map((s) => (
                              <button
                                key={s.value}
                                onClick={() => updateItemStatus(item.id, "status", s.value)}
                                disabled={itemStatusUpdating === item.id}
                                className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border-2 transition-all ${
                                  item.status === s.value
                                    ? "border-brand-400 " + s.color
                                    : "border-gray-200 bg-white text-gray-600"
                                }`}
                              >
                                {itemStatusUpdating === item.id && item.status !== s.value ? "..." : s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">검증 상태</p>
                          <div className="flex flex-wrap gap-1.5">
                            {VERIFY_STATUSES.map((s) => (
                              <button
                                key={s.value}
                                onClick={() => updateItemStatus(item.id, "verification_status", s.value)}
                                className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border-2 transition-all ${
                                  item.verification_status === s.value
                                    ? "border-brand-400 " + s.color
                                    : "border-gray-200 bg-white text-gray-600"
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">로케이션 코드</p>
                          <div className="flex gap-2">
                            <input
                              value={locationInput[item.id] ?? item.location_code ?? ""}
                              onChange={(e) => setLocationInput((p) => ({ ...p, [item.id]: e.target.value }))}
                              placeholder="예: A-01"
                              className="flex-1 text-sm bg-white border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:border-brand-400"
                            />
                            <button
                              onClick={() => saveLocation(item.id)}
                              className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-xl font-semibold"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 결제 탭 */}
      {activeTab === "payments" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">결제 이력</p>
          </div>
          {payments.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2">
              <CreditCard size={24} className="text-gray-200" />
              <p className="text-sm text-gray-400">결제 이력이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {payments.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {PAYMENT_TYPE_LABELS[p.payment_type] ?? p.payment_type}
                    </p>
                    {p.billing_memo && (
                      <p className="text-xs text-gray-400 mt-0.5">{p.billing_memo}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(p.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {p.amount.toLocaleString()}원
                    </p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      p.status === "PAID" ? "bg-green-100 text-green-700" :
                      p.status === "FAILED" ? "bg-red-100 text-red-700" :
                      p.status === "CANCELLED" ? "bg-gray-100 text-gray-500" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 메모 탭 */}
      {activeTab === "info" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-sm font-bold text-gray-900">관리자 메모</p>
          <textarea
            value={storageNotes}
            onChange={(e) => setStorageNotes(e.target.value)}
            rows={5}
            placeholder="이 스토리지에 대한 관리 메모를 입력하세요..."
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-brand-400 resize-none"
          />
          <button
            onClick={saveNotes}
            disabled={savingNotes}
            className="w-full bg-brand-600 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50"
          >
            {savingNotes ? "저장 중..." : "메모 저장"}
          </button>
        </div>
      )}
    </div>
  );
}

function InfoCell({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      {value && <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>}
      {children}
    </div>
  );
}
