/**
 * 국가별 통관 정보 — 면세한도 · 금지/제한 품목 · 배터리 규정
 * 출처: 우체국 국제우편 안내, 각국 세관 공식 기준 (2025 기준)
 */

export interface CustomsInfo {
  dutyFree: string;          // 면세한도
  dutyFreeNote?: string;     // 면세 관련 추가 설명
  prohibited: string[];      // 절대 금지 품목
  restricted: string[];      // 조건부 허용 / 주의 품목
  batteryLimit: string;      // 리튬배터리 규정
  customsNote?: string;      // 기타 유의사항
}

const DATA: Record<string, CustomsInfo> = {
  JP: {
    dutyFree: "1만엔 이하",
    dutyFreeNote: "동일 발송인의 동일 날짜 합산 기준",
    prohibited: ["마약·향정신성의약품", "총기·폭발물", "위조품·복제품", "음란물", "도박기기"],
    restricted: ["육류·유제품 (검역 필요)", "식물·종자 (식물검역증 필요)", "의약품 (개인 소지량 제한)", "화장품 (성분 규제)"],
    batteryLimit: "리튬이온 160Wh 이하 / 리튬메탈 2g 이하",
    customsNote: "식품·의약품 등은 수입 허가 필요할 수 있음",
  },
  CN: {
    dutyFree: "50위안 이하",
    dutyFreeNote: "실질적으로 대부분 과세 대상 — 신고 금액 정확 기재 필수",
    prohibited: ["마약·독성물질", "정치·종교 관련 자료", "위조품", "총기·폭발물", "음란물"],
    restricted: ["식품류 (통관 까다로움)", "의약품 (허가 필요)", "동식물·식물성 원료", "건강기능식품"],
    batteryLimit: "리튬이온 160Wh 이하",
    customsNote: "통관 검사 매우 엄격. 선물 포장 삼가고 인보이스 정확히 작성 권장",
  },
  US: {
    dutyFree: "$800 이하",
    dutyFreeNote: "De Minimis 기준 (개인 소비용, 동일 수취인 1일 1회)",
    prohibited: ["마약·향정신성물질", "총기·탄약 (허가 없이)", "위조품", "멸종위기종 제품", "특정 식물성 농산물"],
    restricted: ["육류·가금류 (USDA 허가)", "의약품 (FDA 규정)", "알코올 (면허 필요)", "담배 (세금 신고 필요)"],
    batteryLimit: "리튬이온 100Wh 이하 기내 반입 / 우편 발송은 별도 규정",
    customsNote: "식물·농산물은 USDA APHIS 검역 필수",
  },
  AU: {
    dutyFree: "AUD 1,000 이하",
    dutyFreeNote: "GST(10%) 별도 — AUD 1,000 초과 시 GST + 관세 부과",
    prohibited: ["마약", "총기·무기", "멸종위기종 제품", "특정 의약품"],
    restricted: ["식품·육류·유제품 (검역 필수)", "식물·종자·흙 (엄격 금지)", "목재제품 (검역)", "동물성 제품"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "생물보안 검역 매우 엄격. 식품·식물류 신고 누락 시 고액 벌금",
  },
  CA: {
    dutyFree: "CAD 20 이하",
    dutyFreeNote: "낮은 면세 한도 — 대부분의 상품에 GST/HST 부과",
    prohibited: ["마약", "총기·폭발물 (허가 없이)", "위조품", "멸종위기종 제품"],
    restricted: ["식품 (CFIA 규정)", "의약품 (Health Canada 허가)", "알코올·담배 (수량 제한)", "식물·흙"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "선물도 CAD 60 초과 시 과세. 상업용 상품은 CAD 20부터 과세",
  },
  GB: {
    dutyFree: "£135 이하",
    dutyFreeNote: "브렉시트 이후 EU와 별도 기준. £135 초과 시 VAT(20%) + 관세",
    prohibited: ["마약", "총기·폭발물", "음란물", "위조품", "멸종위기종 제품"],
    restricted: ["육류·유제품 (수의검역)", "식물·종자 (식물검역증)", "의약품 (MHRA 규정)", "담배·알코올 (수량 제한)"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "브렉시트로 통관 절차 강화. 인보이스·원산지 증명 정확히 작성 필요",
  },
  DE: {
    dutyFree: "€150 이하",
    dutyFreeNote: "EU 공통 기준. €150 초과 시 관세 + VAT(19%) 부과",
    prohibited: ["마약", "총기·폭발물", "음란물", "위조품", "나치 관련 물품"],
    restricted: ["식품·육류 (수의검역)", "식물 (식물검역증)", "의약품 (허가 필요)", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "€22 이하 소액 면세 폐지됨 (2021년~). 모든 수입품 VAT 부과",
  },
  FR: {
    dutyFree: "€150 이하",
    dutyFreeNote: "EU 공통 기준. VAT(20%) 별도",
    prohibited: ["마약", "총기·폭발물", "음란물", "위조품"],
    restricted: ["식품·육류 (수의검역)", "식물 (식물검역증)", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "프랑스어 인보이스 권장. 통관 지연 빈번하므로 여유 있는 배송 기간 설정",
  },
  SG: {
    dutyFree: "SGD 400 이하",
    dutyFreeNote: "GST(9%) 별도 — SGD 400 초과 시 GST 부과",
    prohibited: ["마약", "씹는담배·껌", "전자담배·액상", "총기", "음란물"],
    restricted: ["의약품 (HSA 규정)", "식품 (SFA 허가)", "담배 (수량 제한)", "알코올 (면허 필요)"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "씹는담배·전자담배는 절대 금지. 적발 시 고액 벌금",
  },
  HK: {
    dutyFree: "HKD 500 이하",
    dutyFreeNote: "일부 품목(술·담배·향수·화장품)은 별도 세율 적용",
    prohibited: ["마약", "총기·폭발물", "위조품", "멸종위기종 제품"],
    restricted: ["의약품 (등록 필요)", "식품 (FEHD 기준)", "담배 (세금 납부)", "알코올 (30% 초과 시 과세)"],
    batteryLimit: "리튬이온 160Wh 이하",
    customsNote: "홍콩은 자유무역항으로 대부분 무관세. 단, 주류·담배·탄화수소유는 과세",
  },
  TW: {
    dutyFree: "NT$2,000 이하",
    dutyFreeNote: "동일 수취인 1년 누적 NT$20,000 이하 면세",
    prohibited: ["마약", "총기·폭발물", "위조품", "도박기기"],
    restricted: ["식품 (위생검역)", "식물 (식물검역)", "의약품 (TFDA 허가)", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "중국 본토 경유 불가. 직항 경로 이용 필수",
  },
  TH: {
    dutyFree: "THB 1,500 이하",
    dutyFreeNote: "수입 VAT(7%) 별도. 상업용 물품은 한도 적용 안 됨",
    prohibited: ["마약", "음란물", "종교 모독 자료", "총기", "위조품"],
    restricted: ["식품 (FDA 허가)", "의약품", "담배 (개인 소지량 제한)", "전자기기 일부"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "불상·종교 물품 수출입 시 허가 필요",
  },
  VN: {
    dutyFree: "USD 5 이하",
    dutyFreeNote: "사실상 면세 혜택 없음. 거의 모든 수입 상품에 관세 부과",
    prohibited: ["마약", "총기·폭발물", "정치자료", "음란물", "도박기기"],
    restricted: ["식품 (검역 필수)", "의약품 (허가 필요)", "전자기기 (인증 필요)", "이중 용도 물품"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "통관 시간 길고 추가 서류 요구 빈번. 배송 지연 감안 필요",
  },
  PH: {
    dutyFree: "PHP 10,000 이하",
    dutyFreeNote: "개인 선물용 PHP 10,000 이하 면세",
    prohibited: ["마약", "총기·폭발물", "음란물", "위조품"],
    restricted: ["식품 (FDA 허가)", "의약품", "담배 (수량 제한)", "알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "통관 지연 및 추가 비용 발생 빈번. 여유 배송 기간 필요",
  },
  MY: {
    dutyFree: "RM 500 이하",
    dutyFreeNote: "SST(판매세 10%) 별도",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품 (Halal 인증 권장)", "의약품", "담배 (수량 제한)", "알코올 (무슬림 제한)"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "무슬림 다수 국가. 돼지고기·알코올 성분 포함 제품 신고 주의",
  },
  ID: {
    dutyFree: "USD 3 이하",
    dutyFreeNote: "사실상 면세 없음. VAT(11%) + 소득세 별도",
    prohibited: ["마약", "총기", "음란물", "위조품", "도박기기"],
    restricted: ["식품 (BPOM 허가)", "의약품", "화장품 (BPOM 등록)", "알코올 (수량 제한)"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "화장품·의약품은 BPOM 사전 등록 필요. 통관 지연 빈번",
  },
  MO: {
    dutyFree: "MOP 5,000 이하",
    dutyFreeNote: "마카오는 관세율 낮음",
    prohibited: ["마약", "총기·폭발물", "위조품"],
    restricted: ["의약품", "담배·알코올 (수량 제한)"],
    batteryLimit: "리튬이온 160Wh 이하",
    customsNote: "홍콩과 유사한 통관 체계",
  },
  MN: {
    dutyFree: "USD 1,000 이하",
    dutyFreeNote: "개인 물품 기준",
    prohibited: ["마약", "총기", "위조품"],
    restricted: ["식품 (검역)", "의약품", "담배 (수량 제한)"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "통관 시간 오래 걸릴 수 있음",
  },
  NZ: {
    dutyFree: "NZD 1,000 이하",
    dutyFreeNote: "GST(15%) 별도 — NZD 1,000 초과 시 GST + 관세",
    prohibited: ["마약", "총기 (허가 없이)", "멸종위기종 제품"],
    restricted: ["식품·육류·유제품 (생물보안 검역)", "식물·종자·흙", "목재제품 (검역)", "동물성 제품"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "호주와 함께 생물보안 검역 최엄격 국가. 신고 누락 시 대규모 벌금",
  },
  IT: {
    dutyFree: "€150 이하",
    dutyFreeNote: "EU 공통 기준. VAT(22%)",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품 (수의검역)", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "통관 지연 빈번한 국가. 인보이스 상세 기재 권장",
  },
  ES: {
    dutyFree: "€150 이하",
    dutyFreeNote: "EU 공통 기준. VAT(21%)",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품 (수의검역)", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "통관 지연 발생 가능. 여유 있는 배송 기간 설정 권장",
  },
  NL: {
    dutyFree: "€150 이하",
    dutyFreeNote: "EU 공통 기준. VAT(21%)",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "EU 주요 물류 허브. 통관 비교적 빠름",
  },
  SE: {
    dutyFree: "SEK 0 (전액 과세)",
    dutyFreeNote: "€150 이하 관세 면제, VAT(25%) 항상 부과",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "EU 외 발송품에도 VAT 전액 징수",
  },
  CH: {
    dutyFree: "CHF 65 이하",
    dutyFreeNote: "EU 회원국 아님. 자체 관세·VAT(8.1%) 체계",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품 (검역)", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "EU와 별도 관세 체계. 스위스 자체 통관 절차 적용",
  },
  RU: {
    dutyFree: "€200 이하 / 31kg 이하",
    dutyFreeNote: "개인 물품 기준 (2023년 기준, 변동 가능)",
    prohibited: ["마약", "총기·폭발물", "음란물", "위조품", "제재 대상 물품"],
    restricted: ["식품 (검역)", "의약품", "전자기기 일부", "이중 용도 물품"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "국제 제재로 EMS 서비스 중단 또는 지연 가능. 발송 전 현황 확인 필수",
  },
  BR: {
    dutyFree: "USD 50 이하",
    dutyFreeNote: "개인 선물 USD 50 이하. 상업용 물품은 USD 3,000까지 간이 통관",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품 (ANVISA 허가)", "의약품", "화장품 (ANVISA 등록)", "전자기기"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "통관 매우 오래 걸림(1~3개월). 세금 부담 높음. 인보이스 정확 기재 필수",
  },
  MX: {
    dutyFree: "USD 50 이하",
    dutyFreeNote: "개인 물품 USD 50 이하 면세. 초과 시 관세 + IVA(16%)",
    prohibited: ["마약", "총기 (허가 없이)", "음란물", "위조품"],
    restricted: ["식품 (SENASICA 검역)", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "통관 지연 빈번. 고가 물품은 추가 서류 요구됨",
  },
  AE: {
    dutyFree: "AED 1,000 이하",
    dutyFreeNote: "VAT(5%) 별도. 상업용은 별도 기준",
    prohibited: ["마약", "총기", "음란물", "도박기기", "이스라엘 관련 물품 (일부)"],
    restricted: ["알코올 (면허 소지자만)", "돼지고기 제품", "의약품 (허가 필요)", "전자담배"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "이슬람 문화 존중 필수. 알코올·돼지고기 관련 제품 각별 주의",
  },
  SA: {
    dutyFree: "SAR 1,000 이하",
    dutyFreeNote: "VAT(15%) 별도",
    prohibited: ["마약", "알코올", "돼지고기 제품", "음란물", "도박기기", "총기"],
    restricted: ["의약품 (SFDA 허가)", "화장품", "특정 식품", "종교 자료"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "이슬람법 기반 엄격한 통관. 알코올·음란물 절대 금지. 통관 지연 빈번",
  },
  IN: {
    dutyFree: "INR 5,000 이하",
    dutyFreeNote: "선물 기준. 상업용 물품은 사실상 전액 과세",
    prohibited: ["마약", "총기", "음란물", "위조품", "특정 식물·동물"],
    restricted: ["식품 (FSSAI 허가)", "의약품 (CDSCO 허가)", "전자기기 (BIS 인증)", "화장품"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "통관 매우 복잡하고 오래 걸림. BIS 미인증 전자기기 반송 처리될 수 있음",
  },
};

export function getCustomsInfo(countryCode: string): CustomsInfo | null {
  return DATA[countryCode] ?? null;
}

export const CUSTOMS_DATA = DATA;
