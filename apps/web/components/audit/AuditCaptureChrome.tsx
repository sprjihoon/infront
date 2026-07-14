"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BUSINESS_INFO, BUSINESS_SITE_ORIGIN } from "@/lib/shop/business-info";

function useAuditCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAudit = searchParams.get("audit") === "1";
  const qs = searchParams.toString();
  const displayUrl = `${BUSINESS_SITE_ORIGIN}${pathname}${qs ? `?${qs}` : ""}`;
  const showBusinessFooter = isAudit && !pathname.startsWith("/shop");
  return { isAudit, displayUrl, showBusinessFooter };
}

function AuditCaptureUrlBarInner() {
  const { isAudit, displayUrl } = useAuditCapture();
  if (!isAudit) return null;

  return (
    <div
      className="sticky top-0 z-[9999] border-b border-gray-300 bg-[#f1f3f4] px-3 py-2 shadow-sm"
      aria-label="캡처용 URL 표시"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <span className="shrink-0 rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-500">
          URL
        </span>
        <p className="truncate font-mono text-[11px] text-gray-800">{displayUrl}</p>
      </div>
    </div>
  );
}

function AuditCaptureFooterInner() {
  const { showBusinessFooter } = useAuditCapture();
  if (!showBusinessFooter) return null;

  return (
    <footer className="mt-auto border-t border-gray-200 bg-white px-4 py-5">
      <BusinessInfoBlock />
    </footer>
  );
}

export function BusinessInfoBlock() {
  const b = BUSINESS_INFO;
  return (
    <div className="mx-auto max-w-2xl space-y-2">
      <p className="text-xs font-bold text-gray-700">{b.companyName}</p>
      <div className="space-y-0.5 text-[11px] leading-relaxed text-gray-500">
        <p>
          <span className="text-gray-400">상호명</span> {b.companyName} &nbsp;|&nbsp;{" "}
          <span className="text-gray-400">대표자</span> {b.representative}
        </p>
        <p>
          <span className="text-gray-400">사업자등록번호</span> {b.businessRegistrationNumber}
        </p>
        <p>
          <span className="text-gray-400">통신판매업신고</span> {b.mailOrderReportNumber}
        </p>
        <p>
          <span className="text-gray-400">사업장 주소</span> {b.address}
        </p>
        <p>
          <span className="text-gray-400">연락처</span> {b.phone} &nbsp;|&nbsp;{" "}
          <span className="text-gray-400">이메일</span> {b.email}
        </p>
      </div>
    </div>
  );
}

export function AuditCaptureUrlBar() {
  return (
    <Suspense fallback={null}>
      <AuditCaptureUrlBarInner />
    </Suspense>
  );
}

export function AuditCaptureFooter() {
  return (
    <Suspense fallback={null}>
      <AuditCaptureFooterInner />
    </Suspense>
  );
}

/** @deprecated use AuditCaptureUrlBar */
export function AuditCaptureChrome() {
  return <AuditCaptureUrlBar />;
}
