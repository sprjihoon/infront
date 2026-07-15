import Link from "next/link";
import { BUSINESS_INFO } from "@/lib/shop/business-info";

export function ShopFooter() {
  const b = BUSINESS_INFO;
  return (
    <footer className="border-t border-gray-200 bg-white mt-auto px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-3">
        <p className="text-xs font-bold text-gray-700">{b.companyName}</p>
        <div className="text-[11px] text-gray-500 leading-relaxed space-y-0.5">
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
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
          <Link href="/shop/terms" className="text-[11px] text-gray-500 underline underline-offset-2 hover:text-gray-700">
            이용약관
          </Link>
          <Link href="/shop/privacy" className="text-[11px] text-gray-500 underline underline-offset-2 hover:text-gray-700">
            개인정보처리방침
          </Link>
          <Link href="/shop/refund-policy" className="text-[11px] text-gray-500 underline underline-offset-2 hover:text-gray-700">
            취소/환불 정책
          </Link>
          <Link href="/shop/shipping-policy" className="text-[11px] text-gray-500 underline underline-offset-2 hover:text-gray-700">
            배송/서비스 제공 정책
          </Link>
        </div>
        <div className="border-t border-gray-100 pt-3 space-y-0.5 text-[11px] text-gray-500 leading-relaxed">
          <p>
            <span className="font-semibold text-gray-700">{b.companyName}</span>에서 운영하는 사이트에서 판매되는 모든 상품은{" "}
            <span className="font-semibold text-gray-700">{b.companyName}</span>에서 책임지고 있습니다.
          </p>
          <p>* 민원 담당자 {b.representative} &nbsp;/&nbsp; 연락처 {b.phone}</p>
        </div>
        <p className="text-[10px] text-gray-400">© 2026 틸리언. All rights reserved.</p>
      </div>
    </footer>
  );
}
