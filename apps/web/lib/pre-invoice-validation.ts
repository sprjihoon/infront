export type PreInvoiceItemInput = {
  name_en?: string;
  quantity?: number;
  unit_price_usd?: number;
  hs_code?: string;
};

/** 수거·등록·출고 신청 공통 인보이스 품목 검증 */
export function validatePreInvoiceItems(
  items: PreInvoiceItemInput[] | null | undefined,
): string | null {
  const rows = items ?? [];
  const filled = rows.filter((i) => (i.name_en ?? "").trim());
  if (filled.length === 0) return "품목을 하나 이상 선택해주세요.";
  if (rows.some((i) => !(i.name_en ?? "").trim())) {
    return "모든 품목의 품목 선택을 완료해주세요.";
  }
  if (filled.some((i) => !i.quantity || i.quantity < 1)) {
    return "모든 품목의 수량을 입력해주세요.";
  }
  if (filled.some((i) => !i.unit_price_usd || i.unit_price_usd <= 0)) {
    return "모든 품목의 단가(USD)를 입력해주세요. (인보이스·보험료 계산에 필수)";
  }
  if (filled.some((i) => !(i.hs_code ?? "").trim())) {
    return "모든 품목의 HS 코드를 입력해주세요. (인보이스·마이창고 전달에 필수)";
  }
  return null;
}
