/**
 * 우체국 반품소포(수거) 도착지 — modo CENTER_* 와 동일
 *
 * 수거 물품이 도착하는 곳은 회사 소재지(안심로)가 아니라
 * 동대구우체국 소포실(우체국 계약 등록 주소)입니다.
 *
 * Vercel/로컬 환경변수 INFRONT_CENTER_* 가 비어 있으면 아래 기본값 사용.
 */

export const EPOST_CENTER_DEFAULTS = {
  ordNm: '인프론트',
  zip: '41142',
  addr1: '대구광역시 동구 동촌로 1',
  addr2: '동대구우체국 2층 소포실',
} as const;

/** modo: CENTER_ADDRESS1/2, CENTER_ZIPCODE, CENTER_RECIPIENT_NAME */
export function resolveInfrontCenterFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return {
    ordNm: (env.INFRONT_CENTER_ORD_NM ?? EPOST_CENTER_DEFAULTS.ordNm).trim(),
    zip: (env.INFRONT_CENTER_ZIPCODE ?? EPOST_CENTER_DEFAULTS.zip).replace(/\D/g, ''),
    addr1: (env.INFRONT_CENTER_ADDR1 ?? EPOST_CENTER_DEFAULTS.addr1).trim(),
    addr2: (env.INFRONT_CENTER_ADDR2 ?? EPOST_CENTER_DEFAULTS.addr2).trim(),
    phone: env.INFRONT_CENTER_PHONE ?? '',
    displayName: env.INFRONT_CENTER_NAME ?? EPOST_CENTER_DEFAULTS.ordNm,
  };
}
