export type PreInvoiceItemInput = {
  name_en?: string;
  product_name?: string;
  quantity?: number;
  unit_price_usd?: number;
  hs_code?: string;
  is_sealed?: boolean;
};

/** 수거·등록·출고 신청 공통 인보이스 품목 검증 */
export function validatePreInvoiceItems(
  items: PreInvoiceItemInput[] | null | undefined,
): string | null {
  const rows = items ?? [];
  if (rows.length === 0) return "품목을 하나 이상 입력해주세요.";

  // 미개봉 아이템: 박스 이름만 필요
  const sealedRows = rows.filter((i) => i.is_sealed);
  for (const i of sealedRows) {
    if (!(i.product_name ?? "").trim() && !(i.name_en ?? "").trim()) {
      return "미개봉 박스의 이름을 입력해주세요.";
    }
  }

  // 일반 아이템 검증
  const normalRows = rows.filter((i) => !i.is_sealed);
  const filledNormal = normalRows.filter((i) => (i.name_en ?? "").trim());
  if (filledNormal.length === 0 && sealedRows.length === 0) return "품목을 하나 이상 선택해주세요.";
  if (normalRows.some((i) => !(i.name_en ?? "").trim())) {
    return "모든 품목의 품목 선택을 완료해주세요.";
  }
  if (filledNormal.some((i) => !i.quantity || i.quantity < 1)) {
    return "모든 품목의 수량을 입력해주세요.";
  }
  if (filledNormal.some((i) => !i.unit_price_usd || i.unit_price_usd <= 0)) {
    return "모든 품목의 단가(USD)를 입력해주세요. (인보이스·보험료 계산에 필수)";
  }
  if (filledNormal.some((i) => !(i.hs_code ?? "").trim())) {
    return "모든 품목의 HS 코드를 입력해주세요. (인보이스·스토리지 전달에 필수)";
  }
  return null;
}
