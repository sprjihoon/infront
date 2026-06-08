"use client";

import { useEffect } from "react";

/** KG이니시스 결제창 취소 시 closeUrl로 호출되는 페이지
 *  overlay 모드: iframe 안에서 로드 → 부모창을 /shop으로 이동
 *  팝업 모드: 팝업 자체를 닫음
 */
export default function PaymentClosePage() {
  useEffect(() => {
    try {
      if (window.opener) {
        window.close();
      } else if (window.top && window.top !== window) {
        window.top.location.replace("/shop");
      } else {
        window.location.replace("/shop");
      }
    } catch {
      window.location.replace("/shop");
    }
  }, []);

  return null;
}
