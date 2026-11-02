"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PickupAddressPicker, { type PickupAddressValue } from "@/components/ui/PickupAddressPicker";
import { PayPalCheckoutButtons } from "@/app/shop/components/PayPalCheckoutButtons";
import { isValidPickupAddressDetail, normalizeEpostZip } from "@/lib/epost/client";

type Fee = {
  size_code: string;
  label_ko: string;
  dims_ko: string;
  price: number;
};

type PayParams = {
  mid: string;
  oid: string;
  price: string;
  timestamp: string;
  signature: string;
  verification: string;
  mKey: string;
  goodname: string;
  buyername: string;
  buyertel: string;
  buyeremail: string;
  returnUrl: string;
  closeUrl: string;
  jsUrl: string;
};

type PendingBox = {
  id: string;
  storageId: string;
  amount: number;
  sizeCode: string;
  qty: number;
};

function BoxInner() {
  const router = useRouter();
  const params = useSearchParams();
  const purpose = params.get("purpose") === "storage" ? "storage" : "shipping";
  const storageId = params.get("storage_id");
  const [fees, setFees] = useState<Fee[]>([]);
  const [sizeCode, setSizeCode] = useState("");
  const [qty, setQty] = useState(1);
  const [address, setAddress] = useState<PickupAddressValue | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [usePaypal, setUsePaypal] = useState(false);
  const [profile, setProfile] = useState({ name: "", phone: "", email: "" });
  const [pending, setPending] = useState<PendingBox | null>(null);
  const [payParams, setPayParams] = useState<PayParams | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = fees.find((f) => f.size_code === sizeCode) ?? fees[0];
  const amount = (selected?.price ?? 0) * qty;

  useEffect(() => {
    fetch("/api/inbound/box")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.boxes ?? []) as Fee[];
        setFees(rows);
        if (rows[0]) setSizeCode(rows[0].size_code);
      })
      .catch(() => setFees([]));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCustomerId(user.id);
      const foreigner = (user.user_metadata as { customer_type?: string })?.customer_type === "foreigner";
      setUsePaypal(Boolean(foreigner && user.email_confirmed_at));
      const { data } = await supabase
        .from("customers")
        .select("name, phone, email")
        .eq("id", user.id)
        .maybeSingle();
      setProfile({
        name: data?.name ?? "",
        phone: data?.phone ?? "",
        email: data?.email ?? user.email ?? "",
      });
    });
  }, []);

  useEffect(() => {
    if (!payParams) return;
    const prev = document.getElementById("inicis-box-script");
    if (prev) prev.remove();
    const script = document.createElement("script");
    script.id = "inicis-box-script";
    script.src = payParams.jsUrl;
    script.onload = () => {
      const INIStdPay = (window as Window & { INIStdPay?: { pay: (id: string) => void } }).INIStdPay;
      if (INIStdPay?.pay) INIStdPay.pay("frmBoxPayment");
    };
    document.head.appendChild(script);
  }, [payParams]);

  function resetPending() {
    setPending(null);
    setPayParams(null);
  }

  async function createRequest(): Promise<PendingBox | null> {
    if (!address || normalizeEpostZip(address.zipcode).length !== 5 || address.address.trim().length < 2) {
      alert("주소 검색으로 받을 주소를 선택해 주세요.");
      return null;
    }
    if (!isValidPickupAddressDetail(address.addressDetail)) {
      alert("상세주소(동·호수)를 입력해 주세요.");
      return null;
    }
    if (!selected) {
      alert("박스 크기를 선택해 주세요.");
      return null;
    }
    const res = await fetch("/api/inbound/box", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose,
        storage_id: storageId,
        size_code: selected.size_code,
        qty,
        name: address.name,
        phone: address.phone,
        zipcode: address.zipcode,
        address: address.address,
        address_detail: address.addressDetail,
      }),
    });
    const json = await res.json();
    if (json.code === "NEED_STORAGE") {
      router.push(`/storage/new?next=method&purpose=storage`);
      return null;
    }
    if (!res.ok) {
      alert(json.error ?? "신청에 실패했습니다.");
      return null;
    }
    return {
      id: json.id,
      storageId: json.storage_id,
      amount: json.amount,
      sizeCode: json.size_code,
      qty: json.qty,
    };
  }

  async function startCard(box: PendingBox) {
    const res = await fetch("/api/storage/pay/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storage_id: box.storageId,
        payment_type: "PICKUP_FEE",
        box_request_id: box.id,
        pickup_boxes: [{ size_code: box.sizeCode, qty: box.qty }],
        buyername: address?.name || profile.name || "고객",
        buyertel: (address?.phone || profile.phone || "").replace(/[^0-9\-]/g, "") || "010-0000-0000",
        buyeremail: profile.email || "pay@infront.kr",
      }),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      alert(json.error ?? "결제 준비에 실패했습니다.");
      return;
    }
    setPayParams(json);
  }

  async function handlePay() {
    setLoading(true);
    try {
      const box = pending ?? await createRequest();
      if (!box) return;
      setPending(box);
      if (!usePaypal) await startCard(box);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3.5 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">박스가 필요해요</h1>
          <p className="text-xs text-gray-400 mt-0.5">우체국 박스 1호~5호만 구입할 수 있습니다</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-[600px] mx-auto space-y-4">
        <div className="space-y-2">
          {fees.map((fee) => (
            <button
              key={fee.size_code}
              type="button"
              onClick={() => { setSizeCode(fee.size_code); resetPending(); }}
              className={`w-full text-left rounded-2xl border px-4 py-3 ${
                selected?.size_code === fee.size_code
                  ? "bg-brand-50 border-brand-600"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">우체국 {fee.label_ko}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{fee.dims_ko}</p>
                </div>
                <p className="text-sm font-bold text-gray-900">{fee.price.toLocaleString()}원</p>
              </div>
            </button>
          ))}
        </div>

        <label className="block text-xs font-bold text-gray-600">
          개수
          <input
            type="number"
            min={1}
            max={20}
            value={qty}
            onChange={(e) => {
              setQty(Math.min(20, Math.max(1, Number(e.target.value) || 1)));
              resetPending();
            }}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white"
          />
        </label>

        <div>
          <p className="text-xs font-bold text-gray-600 mb-2">받을 주소</p>
          <PickupAddressPicker
            value={address}
            customerId={customerId}
            onChange={(v) => {
              setAddress(v);
              resetPending();
            }}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">박스 비용</span>
          <span className="text-base font-bold text-gray-900">{amount.toLocaleString()}원</span>
        </div>

        {usePaypal && pending ? (
          <PayPalCheckoutButtons
            mode="order"
            createPayload={{
              kind: "storage",
              storage_id: pending.storageId,
              payment_type: "PICKUP_FEE",
              box_request_id: pending.id,
              pickup_boxes: [{ size_code: pending.sizeCode, qty: pending.qty }],
              buyername: address?.name || profile.name || "고객",
              buyertel: address?.phone || profile.phone,
              buyeremail: profile.email,
            }}
            onPaid={(result) => {
              const q = new URLSearchParams({
                amount: String(result.amountKrw),
                storage_id: pending.storageId,
                type: "PICKUP_FEE",
                next: "box",
                purpose,
                verified: "1",
                provider: "paypal",
              });
              router.push(`/storage/payment/success?${q}`);
            }}
            onError={(msg) => alert(msg)}
          />
        ) : (
          <button
            type="button"
            disabled={loading || amount <= 0}
            onClick={handlePay}
            className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
            {amount.toLocaleString()}원 결제하기
          </button>
        )}
      </div>

      {payParams && (
        <form id="frmBoxPayment" method="POST" acceptCharset="UTF-8" style={{ display: "none" }}>
          <input type="hidden" name="version" value="1.0" />
          <input type="hidden" name="gopaymethod" value="Card" />
          <input type="hidden" name="mid" value={payParams.mid} />
          <input type="hidden" name="oid" value={payParams.oid} />
          <input type="hidden" name="price" value={payParams.price} />
          <input type="hidden" name="timestamp" value={payParams.timestamp} />
          <input type="hidden" name="signature" value={payParams.signature} />
          <input type="hidden" name="verification" value={payParams.verification} />
          <input type="hidden" name="mKey" value={payParams.mKey} />
          <input type="hidden" name="goodname" value={payParams.goodname} />
          <input type="hidden" name="buyername" value={payParams.buyername} />
          <input type="hidden" name="buyertel" value={payParams.buyertel} />
          <input type="hidden" name="buyeremail" value={payParams.buyeremail} />
          <input type="hidden" name="currency" value="WON" />
          <input type="hidden" name="langWallet" value="ko" />
          <input type="hidden" name="returnUrl" value={payParams.returnUrl} />
          <input type="hidden" name="closeUrl" value={payParams.closeUrl} />
          <input type="hidden" name="acceptmethod" value="centerCd(Y):HPP(2)" />
        </form>
      )}
    </div>
  );
}

export default function BoxRequestPage() {
  return (
    <Suspense>
      <BoxInner />
    </Suspense>
  );
}
