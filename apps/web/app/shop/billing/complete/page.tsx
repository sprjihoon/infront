import { redirect } from "next/navigation";

/** 빌링 심사용 구독 UI — 해외카드 심사 집중을 위해 샵에서 비노출 */
export default function ShopBillingCompletePage() {
  redirect("/shop");
}
