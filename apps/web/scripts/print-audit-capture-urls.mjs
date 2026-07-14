/**
 * KG이니시스 심사용 URL+하단정보 캡처 URL 목록 출력
 *
 * cd apps/web && node scripts/print-audit-capture-urls.mjs
 */

const BASE = "https://infront.kr";

const PATHS = [
  "/signup",
  "/login",
  "/mypage",
  "/shop",
  "/shop/products/PICKUP_FEE",
  "/shop/checkout?product=PICKUP_FEE",
  "/shop/orders",
  "/shop/refund-policy",
  "/shop/shipping-policy",
];

function withAudit(path) {
  const sep = path.includes("?") ? "&" : "?";
  return `${BASE}${path}${sep}audit=1`;
}

console.log("=== KG 심사 캡처 URL (audit=1 → 상단 URL 바 표시) ===\n");
PATHS.forEach((p, i) => {
  console.log(`${String(i + 1).padStart(2, "0")}. ${withAudit(p)}`);
});

console.log("\n=== BC/하나 결제창 (내국인 계정) ===");
console.log(withAudit("/shop/checkout?product=PICKUP_FEE"));
console.log("  → audit-domestic@infront.kr / AuditDomestic2026!");
console.log("  → 신용카드 → BC카드·하나카드 각각 캡처\n");
