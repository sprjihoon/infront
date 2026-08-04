"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/** 구독도 일반 상품과 동일하게 checkout으로 주문합니다. */
function RegisterRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const plan = searchParams.get("plan") ?? "MEMBERSHIP_BASIC";
    router.replace(`/shop/checkout?product=${encodeURIComponent(plan)}`);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-gray-300" />
    </div>
  );
}

export default function ShopBillingRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      }
    >
      <RegisterRedirect />
    </Suspense>
  );
}
