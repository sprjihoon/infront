/**
 * 국가별 통관 정보 — 면세한도 · 금지/제한 품목 · 배터리 규정
 * 출처: 각국 세관 공식 사이트, UPU, USPS Postal Explorer (2025년 5월 기준)
 * ⚠️ 통관 규정은 수시로 변경되므로 발송 전 공식 채널에서 재확인 권장
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
    dutyFreeNote: "관세·소비세 면제. 단, 가죽가방·니트류·스키부츠·가죽신발 등 일부 품목은 ¥10,000 이하여도 면세 불가",
    prohibited: ["마약·향정신성의약품", "총기·폭발물", "위조품·복제품", "아동 음란물", "도박기기"],
    restricted: ["육류·유제품 (동식물검역증 필요)", "식물·종자 (식물방역증 필요)", "의약품 (개인 소지량 제한)", "화장품 (성분 규제)"],
    batteryLimit: "리튬이온 160Wh 이하 / 리튬메탈 2g 이하",
    customsNote: "동일 발송인이 동일 날짜에 동일 수취인에게 보낸 복수 소포는 합산 심사. 식품·의약품은 별도 허가 필요할 수 있음",
  },
  CN: {
    dutyFree: "50위안 이하 (관세 면제 기준)",
    dutyFreeNote: "1건당 거래 한도 2,000위안 (2024.12.1 개정, 기존 1,000위안). 50위안 초과 시 관세 부과. 인보이스 금액 정확 기재 필수",
    prohibited: ["마약·독성물질", "정치·종교 관련 자료", "위조품", "총기·폭발물", "음란물"],
    restricted: ["식품류 (통관 검사 까다로움)", "의약품 (수입허가 필요)", "동식물·식물성 원료", "건강기능식품"],
    batteryLimit: "리튬이온 160Wh 이하",
    customsNote: "통관 검사 매우 엄격. 선물 포장 삼가고 인보이스 품목·가격 정확히 기재. 과소 신고 적발 시 추징 및 반송 처리",
  },
  US: {
    dutyFree: "면세 사실상 폐지 (2025.8.29~)",
    dutyFreeNote: "트럼프 행정부 IEEPA 관세 조치로 기존 $800 드미니미스 전 세계 적용 중단. 모든 우편 소포에 관세 부과 (품목별 ad valorem 또는 건당 $80~$200 정액 선택)",
    prohibited: ["마약·향정신성물질", "총기·탄약 (허가 없이)", "위조품", "멸종위기종 제품", "특정 식물성 농산물"],
    restricted: ["육류·가금류 (USDA 허가)", "의약품 (FDA 규정)", "알코올 (주류면허 필요)", "담배 (세금 신고 필요)"],
    batteryLimit: "리튬이온 100Wh 이하 (우편 발송 별도 규정 적용)",
    customsNote: "2025년 8월 이후 사실상 모든 한국발 소포에 관세 부과. 식물·농산물은 USDA APHIS 검역 별도 필수",
  },
  AU: {
    dutyFree: "AUD 1,000 이하 (관세 면제)",
    dutyFreeNote: "관세는 AUD 1,000 이하 면제. GST(10%)는 AUD 1,000 이하라도 GST 등록 해외 판매자가 부과. AUD 1,000 초과 시 관세+GST 국경에서 징수",
    prohibited: ["마약", "총기·무기", "멸종위기종 제품", "특정 의약품"],
    restricted: ["식품·육류·유제품 (생물보안 검역 필수)", "식물·종자·흙 (엄격 금지)", "목재제품 (검역 필요)", "동물성 제품"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "생물보안 검역 세계 최엄격 수준. 식품·식물류 미신고 시 고액 벌금. 복수 주문이 같은 날 같은 발송인에서 오면 합산 처리",
  },
  CA: {
    dutyFree: "CAD 20 이하 (우편 소포)",
    dutyFreeNote: "우편 소포 CAD 20 이하 관세·세금 면제. 선물 발송 시 CAD 60 이하 면세. Canada Post 취급 수수료 CAD 9.95 별도 부과",
    prohibited: ["마약", "총기·폭발물 (허가 없이)", "위조품", "멸종위기종 제품"],
    restricted: ["식품 (CFIA 규정)", "의약품 (Health Canada 허가)", "알코올·담배 (수량 제한)", "식물·흙"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "면세 한도가 매우 낮아 소액 물품도 과세 대상. 상업용은 CAD 20부터 과세. 우편 경로별 취급 수수료 추가 발생",
  },
  GB: {
    dutyFree: "£135 이하 (관세 면제)",
    dutyFreeNote: "£135 이하 관세 면제. 단 VAT(20%)는 별도 부과. 2029년 이전 면세 한도 폐지 예정(정부 협의 중)",
    prohibited: ["마약", "총기·폭발물", "음란물", "위조품", "멸종위기종 제품"],
    restricted: ["육류·유제품 (수의검역 필요)", "식물·종자 (식물검역증 필요)", "의약품 (MHRA 규정)", "담배·알코올 (수량 제한)"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "브렉시트로 EU와 별도 통관 체계. 인보이스·원산지 정확 기재 필수. 배송 지연 빈번하므로 여유 기간 설정 권장",
  },
  DE: {
    dutyFree: "€150 이하 (관세 면제)",
    dutyFreeNote: "2026.7월부터 €150 이하 소포에도 €3 정액 관세 부과 예정(EU 개편). VAT(19%)는 현재도 전액 부과",
    prohibited: ["마약", "총기·폭발물", "음란물", "위조품", "나치 관련 물품"],
    restricted: ["식품·육류 (수의검역)", "식물 (식물검역증)", "의약품 (허가 필요)", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "2021년부터 €22 소액 VAT 면세 폐지. 현재 모든 수입품 VAT 부과. 2026년 7월 이후 관세 체계 추가 강화 예정",
  },
  FR: {
    dutyFree: "€150 이하 (관세 면제)",
    dutyFreeNote: "2026.7월부터 €150 이하 소포에도 €3 정액 관세 부과 예정(EU 개편). VAT(20%) 현재도 전액 부과",
    prohibited: ["마약", "총기·폭발물", "음란물", "위조품"],
    restricted: ["식품·육류 (수의검역)", "식물 (식물검역증)", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "통관 지연 빈번. 프랑스어 인보이스 권장. 2026년 EU 관세 개편 이후 소액 물품도 과세 강화",
  },
  SG: {
    dutyFree: "SGD 400 이하",
    dutyFreeNote: "GST 비등록 해외 판매자 기준 SGD 400 이하 GST 면제. GST 등록 판매자(또는 플랫폼)는 구매 시점에 GST(9%) 직접 징수",
    prohibited: ["마약", "씹는담배·껌", "전자담배·액상·기기", "총기", "음란물"],
    restricted: ["의약품 (HSA 규정)", "식품 (SFA 허가)", "담배 (수량 제한, 고세율)", "알코올 (면허 필요)"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "씹는담배·전자담배 절대 금지 (적발 시 고액 벌금). 담배 세율 세계 최고 수준",
  },
  HK: {
    dutyFree: "사실상 무관세 (자유무역항)",
    dutyFreeNote: "홍콩은 자유무역항으로 대부분 품목 관세·소비세 없음. 예외: 주류(30% 초과 알코올), 담배, 탄화수소유, 메탄올",
    prohibited: ["마약", "총기·폭발물", "위조품", "멸종위기종 제품"],
    restricted: ["의약품 (등록 필요)", "식품 (FEHD 기준 준수)", "담배 (세금 납부 필수)", "알코올 30% 초과 (과세)"],
    batteryLimit: "리튬이온 160Wh 이하",
    customsNote: "대부분 품목 무관세로 통관 빠름. 단, 담배·주류는 별도 과세. 중국 대륙과 별도 세관 체계 적용",
  },
  TW: {
    dutyFree: "NT$2,000 이하",
    dutyFreeNote: "우편 소포 NT$2,000 이하 관세·영업세(5%) 면제. 동일 수취인 연간 NT$20,000 이하 누적 기준 적용",
    prohibited: ["마약", "총기·폭발물", "위조품", "도박기기", "중국 본토 직접 발송 불가"],
    restricted: ["식품 (위생검역 필요)", "식물 (식물검역 필요)", "의약품 (TFDA 허가)", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "중국 본토 경유 금지, 직항 경로 이용 필수. 연간 누적 한도 초과 시 과세",
  },
  TH: {
    dutyFree: "THB 1,500 이하",
    dutyFreeNote: "2026.1.1부터 THB 1,500 면세 한도 폐지 예정. 이후 모든 수입 소포 과세 예정",
    prohibited: ["마약", "음란물", "종교 모독 자료", "총기", "위조품"],
    restricted: ["식품 (FDA 허가)", "의약품", "담배 (개인 소지량 제한)", "전자기기 일부"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "불상·종교 물품 수출입 시 허가 필요. 2026년 이후 소액 물품도 과세 예정이므로 사전 확인 권장",
  },
  VN: {
    dutyFree: "면세 폐지 (2025.2.18~)",
    dutyFreeNote: "2025년 2월 18일 VND 100만동(약 USD 40) 이하 면세 완전 폐지. 현재 모든 국제 우편·특송 소포에 수입관세(0~30%)·VAT(10%) 부과",
    prohibited: ["마약", "총기·폭발물", "정치자료", "음란물", "도박기기"],
    restricted: ["식품 (검역 필수)", "의약품 (허가 필요)", "전자기기 (인증 필요)", "이중 용도 물품"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "소액 물품도 전면 과세. 통관 절차 복잡하고 서류 요구 빈번. 배송 지연 감안 필요",
  },
  PH: {
    dutyFree: "PHP 10,000 이하",
    dutyFreeNote: "CMTA(관세현대화법) 기준. PHP 10,000 이하 관세·세금 면제. 단 12% VAT는 별도 적용될 수 있음",
    prohibited: ["마약", "총기·폭발물", "음란물", "위조품"],
    restricted: ["식품 (FDA 허가)", "의약품", "담배 (수량 제한)", "알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "통관 지연 및 추가 비용 발생 빈번. 여유 배송 기간 필요. Balikbayan Box(연 3회, 연 PHP 15만 이하)는 별도 면세",
  },
  MY: {
    dutyFree: "RM 500 이하 (우편 소포)",
    dutyFreeNote: "우편 소포 RM 500 이하 관세 면제. 단 저가 물품세(Low Value Goods Tax 10%) 별도 부과될 수 있음. 여행자 반입은 RM 1,000 이하",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품 (Halal 인증 권장)", "의약품", "담배 (수량 제한)", "알코올 (무슬림 제한)"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "무슬림 다수 국가. 돼지고기·알코올 성분 포함 제품 신고 주의. RM 500 초과 시 관세·SST 부과",
  },
  ID: {
    dutyFree: "USD 3 이하",
    dutyFreeNote: "USD 3 이하 면세. USD 3~1,500 구간은 VAT 11% + 관세 7.5% 부과. 특정 품목(가방·신발·화장품·섬유)은 10~30% 고율 관세",
    prohibited: ["마약", "총기", "음란물", "위조품", "도박기기"],
    restricted: ["식품 (BPOM 허가)", "의약품", "화장품 (BPOM 등록 필요)", "알코올 (수량 제한)"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "화장품·의약품은 BPOM 사전 등록 필수. 의류 5점, 휴대폰 2대 등 수량 제한 있음. 통관 지연 빈번",
  },
  MO: {
    dutyFree: "사실상 무관세 (자유무역항)",
    dutyFreeNote: "마카오는 홍콩과 유사한 자유무역항 체계. 대부분 품목 관세 없음. 특정 소비재(담배·주류·향수)는 과세",
    prohibited: ["마약", "총기·폭발물", "위조품"],
    restricted: ["의약품", "담배·알코올 (수량 제한)"],
    batteryLimit: "리튬이온 160Wh 이하",
    customsNote: "홍콩과 유사한 통관 체계. 중국 본토와 별도 세관 적용",
  },
  MN: {
    dutyFree: "USD 1,000 이하 (개인 물품)",
    dutyFreeNote: "개인 사용 목적 물품 기준. 상업용 물품은 별도 기준 적용",
    prohibited: ["마약", "총기", "위조품"],
    restricted: ["식품 (검역)", "의약품", "담배 (수량 제한)"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "통관에 시간이 오래 걸릴 수 있음. 겨울철 혹한으로 배송 지연 가능",
  },
  NZ: {
    dutyFree: "NZD 1,000 이하",
    dutyFreeNote: "NZD 1,000 이하 관세·수수료 면제. GST(15%)는 NZD 1,000 이하도 해외 판매자가 부과. 주류·담배는 금액 무관 과세",
    prohibited: ["마약", "총기 (허가 없이)", "멸종위기종 제품"],
    restricted: ["식품·육류·유제품 (생물보안 검역 필수)", "식물·종자·흙", "목재제품 (검역)", "동물성 제품"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "호주와 함께 생물보안 검역 세계 최엄격. 신고 누락 시 대규모 벌금. 같은 날 같은 발송인 복수 주문은 합산 처리",
  },
  IT: {
    dutyFree: "€150 이하 (관세 면제)",
    dutyFreeNote: "2026.7월부터 €150 이하 소포에도 €3 정액 관세 부과 예정(EU 개편). VAT(22%) 현재도 전액 부과",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품 (수의검역)", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "이탈리아는 EU 국가 중 통관 지연이 빈번한 편. 인보이스 상세 기재 권장",
  },
  ES: {
    dutyFree: "€150 이하 (관세 면제)",
    dutyFreeNote: "2026.7월부터 €150 이하 소포에도 €3 정액 관세 부과 예정(EU 개편). VAT(21%) 현재도 전액 부과",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품 (수의검역)", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "통관 지연 발생 가능. 여유 있는 배송 기간 설정 권장",
  },
  NL: {
    dutyFree: "€150 이하 (관세 면제)",
    dutyFreeNote: "2026.7월부터 €150 이하 소포에도 €3 정액 관세 부과 예정(EU 개편). VAT(21%) 현재도 전액 부과",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "EU 주요 물류 허브(로테르담·스히폴). 통관 비교적 빠름",
  },
  SE: {
    dutyFree: "€150 이하 (관세 면제)",
    dutyFreeNote: "EU 기준 €150 이하 관세 면제. VAT(25%, EU 최고 수준)는 전액 부과. 2026년 EU 개편 후 변경 예정",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "VAT 25%로 EU 내 최고 수준. 소액 물품도 VAT 전액 징수",
  },
  CH: {
    dutyFree: "CHF 150 이하 (여행자 반입)",
    dutyFreeNote: "2025.1.1부터 여행자 반입 면세 한도 CHF 300→CHF 150으로 인하. 우편 선물(사인→사인): CHF 100 이하 면제. VAT(8.1%) 별도 부과",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품 (검역)", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "EU 회원국 아님. 자체 관세·VAT 체계 적용. 2025년 1월 면세 한도 인하로 과세 범위 확대",
  },
  RU: {
    dutyFree: "€200 이하 / 31kg 이하",
    dutyFreeNote: "2026년 €100, 2027년 €50으로 단계적 인하 예정. 초과분에 15% 관세 또는 kg당 최소 €2",
    prohibited: ["마약", "총기·폭발물", "음란물", "위조품", "국제제재 대상 물품"],
    restricted: ["식품 (검역)", "의약품", "전자기기 일부", "이중 용도 물품"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "국제 제재로 EMS 서비스 중단·지연 가능성 있음. 발송 전 현재 운행 여부 반드시 확인 필수",
  },
  BR: {
    dutyFree: "사실상 없음 (2024.8.1~)",
    dutyFreeNote: "2024년 8월 이후 USD 50 이하도 20% 수입세 부과(연방법 14,902/2024). USD 50~3,000은 60% 부과(-$20 공제). 개인 간 선물 우편 USD 50 이하는 예외 가능",
    prohibited: ["마약", "총기", "음란물", "위조품"],
    restricted: ["식품 (ANVISA 허가)", "의약품", "화장품 (ANVISA 등록)", "전자기기"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "통관 매우 오래 걸림(1~3개월). 주(州)별 ICMS(18~25%) 추가 부과. 인보이스 정확 기재 필수. 과소신고 적발 시 몰수",
  },
  MX: {
    dutyFree: "사실상 없음 (2025.1.1~)",
    dutyFreeNote: "2025년 1월부터 미국·캐나다 이외 국가발 물품 면세 폐지. 한국발 소포 USD 1~2,500에 19% 세율 적용. 미국·캐나다발은 USD 50 이하 면세 유지",
    prohibited: ["마약", "총기 (허가 없이)", "음란물", "위조품"],
    restricted: ["식품 (SENASICA 검역)", "의약품", "담배·알코올"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "2025년부터 한국발은 소액도 과세. USD 1,000 이상은 수취인 RFC(세금ID) 필수. 통관 지연 빈번",
  },
  AE: {
    dutyFree: "AED 1,000 이하",
    dutyFreeNote: "아부다비 기준 AED 1,000 이하 관세 면제. 두바이는 AED 300 적용. VAT(5%)는 면세 한도 이하도 부과",
    prohibited: ["마약", "총기", "음란물", "도박기기", "이스라엘 불매 관련 물품"],
    restricted: ["알코올 (면허 소지자 한정)", "돼지고기 제품", "의약품 (허가 필요)", "전자담배"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "이슬람 문화 존중 필수. 알코올·돼지고기 관련 제품 각별 주의. 두바이와 아부다비 기준 상이",
  },
  SA: {
    dutyFree: "SAR 1,000 이하",
    dutyFreeNote: "SAR 1,000 이하 관세 면제. VAT(15%, 세계 최고 수준)는 면세 한도 이하도 부과",
    prohibited: ["마약", "알코올·돼지고기 제품", "음란물", "도박기기", "총기"],
    restricted: ["의약품 (SFDA 허가)", "화장품", "특정 식품", "종교 자료"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "이슬람법 기반 엄격한 통관. 알코올·음란물 절대 금지(형사처벌). VAT 15%는 반드시 계산에 포함",
  },
  IN: {
    dutyFree: "INR 5,000 이하 (선물)",
    dutyFreeNote: "선물 기준 INR 5,000 이하 관세 면제. 상업용 물품은 사실상 전액 과세. 기본관세(BCD) + IGST 18% 등 복합 과세",
    prohibited: ["마약", "총기", "음란물", "위조품", "특정 식물·동물"],
    restricted: ["식품 (FSSAI 허가)", "의약품 (CDSCO 허가)", "전자기기 (BIS 인증 필수)", "화장품"],
    batteryLimit: "리튬이온 100Wh 이하",
    customsNote: "BIS 미인증 전자기기 반송 처리 가능. 통관 복잡하고 오래 걸림. 2025년 우편 수입 규정 신규 발효(No.18/2025)",
  },
};

export function getCustomsInfo(countryCode: string): CustomsInfo | null {
  return DATA[countryCode] ?? null;
}

export const CUSTOMS_DATA = DATA;
