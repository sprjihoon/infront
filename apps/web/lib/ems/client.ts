/**
 * EMS / K-Packet 국제발송 OpenAPI 클라이언트
 * https://eship.epost.go.kr
 *
 * 인증키: EMS_API_KEY (조회: regkey, 신청: key)
 * 보안키: EMS_SECURITY_KEY (SEED128 암호화)
 */

import { seed128Encrypt, buildEpostParams } from '../epost/seed128';

const BASE = 'https://eship.epost.go.kr';

/** EMS OpenAPI 가 비즈니스 레벨 오류를 반환할 때 사용하는 에러 (HTTP 400 처리용) */
export class EmsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmsApiError';
  }
}

function getKey()  { return process.env.EMS_API_KEY  ?? ''; }
function getSec()  { return process.env.EMS_SECURITY_KEY ?? ''; }
function getCust() { return process.env.EMS_CUSTOMER_NO  ?? ''; }
function getAppr() { return process.env.EMS_APPROVAL_NO  ?? ''; }

function parseXml(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  return xml.match(re)?.[1]?.trim() ?? null;
}

function parseAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

function checkError(xml: string) {
  if (xml.includes('<error>') || xml.includes('ERR-')) {
    const code = parseXml(xml, 'error_code') ?? 'ERR-UNKNOWN';
    const msg  = parseXml(xml, 'message') ?? xml.substring(0, 300);
    throw new EmsApiError(`EMS API ${code}: ${msg}`);
  }
}

const MOCK_MODE = process.env.EMS_MOCK === 'true';
const FETCH_TIMEOUT_MS = 10_000;

function isMockMode() { return MOCK_MODE; }

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('abort') || msg.includes('timeout')) {
      throw new EmsApiError('우체국 EMS 서버 응답 시간 초과 (10s). 잠시 후 다시 시도하세요.');
    }
    // 네트워크 차단 / DNS 실패 등 (Vercel 해외 서버 → 한국 API 접근 불가)
    throw new EmsApiError('우체국 EMS 서버에 연결할 수 없습니다. (네트워크 오류)');
  } finally {
    clearTimeout(timer);
  }
}

/** GET 요청 (조회 API — 암호화 없음) */
async function getQuery(endpoint: string, params: Record<string, string>) {
  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set('regkey', getKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetchWithTimeout(url.toString(), {
    headers: { 'User-Agent': 'Apache-HttpClient/4.5.1 (Java/1.8.0_91)' },
  });
  if (!res.ok) throw new EmsApiError(`EMS HTTP ${res.status}`);
  const xml = await res.text();
  checkError(xml);
  return xml;
}

/** POST 요청 (신청 API — SEED128 암호화) */
async function postEncrypted(endpoint: string, params: Record<string, unknown>) {
  const sec = getSec();
  if (!sec) throw new Error('EMS_SECURITY_KEY 환경변수가 설정되지 않았습니다.');

  const plain = buildEpostParams(params);
  const encrypted = seed128Encrypt(plain, sec);

  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set('key', getKey());
  url.searchParams.set('regData', encrypted);

  const res = await fetchWithTimeout(url.toString(), {
    headers: { 'User-Agent': 'Apache-HttpClient/4.5.1 (Java/1.8.0_91)' },
  });
  if (!res.ok) throw new EmsApiError(`EMS HTTP ${res.status}`);
  const xml = await res.text();
  checkError(xml);
  return xml;
}

// ─────────────────────────────────────────────────────────────
// 1. 배송 예상비용 조회 (EMSAPI-S04-01)
// ─────────────────────────────────────────────────────────────
export interface QuoteParams {
  premiumcd: string;  // 31=EMS, 32=EMS프리미엄, 14=K-Packet
  em_ee: string;      // em=비서류, ee=서류, rl=K-Packet
  countrycd: string;  // JP, US, CN …
  totweight: number;  // 총중량(g)
  boxlength?: number; // 가로(cm)
  boxwidth?: number;  // 세로(cm)
  boxheight?: number; // 높이(cm)
  boyn?: 'Y' | 'N';  // 보험가입 여부
  boprc?: number;     // 보험가입 금액
  apprno?: string;    // 계약승인번호
}

export interface QuoteResult {
  totalFee: number;   // 총 배송예상비용(KRW)
}

/** 국가·서비스·중량별 예상 단가표 (Mock 전용, 실제 API 대체용) */
function mockQuoteFee(p: QuoteParams): number {
  const w = p.totweight;
  if (p.premiumcd === '14') {
    // K-Packet: 300g 기준 약 5,000원, 100g당 약 1,000원 추가
    return Math.round(5000 + Math.max(0, w - 300) / 100 * 1000);
  }
  if (p.premiumcd === '32') {
    // EMS 프리미엄: EMS 대비 약 15% 할증
    const base = mockEmsBaseFee(p.countrycd, w);
    return Math.round(base * 1.15);
  }
  // EMS 비서류/서류
  return mockEmsBaseFee(p.countrycd, w);
}

function mockEmsBaseFee(countrycd: string, weightG: number): number {
  // 지역 구분 (대략)
  const zone1 = ['JP', 'CN', 'TW', 'HK', 'MO'];
  const zone2 = ['US', 'CA', 'AU', 'NZ', 'SG', 'TH', 'VN', 'MY', 'PH'];
  const isZ1 = zone1.includes(countrycd);
  const isZ2 = zone2.includes(countrycd);
  const base  = isZ1 ? 14000 : isZ2 ? 22000 : 28000;
  const per500 = isZ1 ? 3500  : isZ2 ? 5500  : 7500;
  const steps = Math.ceil(Math.max(0, weightG - 500) / 500);
  return base + steps * per500;
}

export async function getShippingQuote(p: QuoteParams): Promise<QuoteResult> {
  // 중량 상한 체크
  const maxG = p.premiumcd === '14' ? 2000 : 30000;
  if (p.totweight > maxG) {
    throw new EmsApiError(
      `중량 초과: ${p.premiumcd === '14' ? 'K-Packet' : 'EMS'} 최대 ${maxG / 1000}kg (입력: ${(p.totweight / 1000).toFixed(1)}kg)`,
    );
  }

  // Mock 모드: 실제 API 대신 단가표 사용
  if (isMockMode()) {
    return { totalFee: mockQuoteFee(p) };
  }

  const params: Record<string, string> = {
    premiumcd: p.premiumcd,
    em_ee:     p.em_ee,
    countrycd: p.countrycd,
    totweight: String(p.totweight),
    boyn:      p.boyn ?? 'N',
    boprc:     String(p.boprc ?? 0),
  };
  if (p.boxlength) params.boxlength = String(p.boxlength);
  if (p.boxwidth)  params.boxwidth  = String(p.boxwidth);
  if (p.boxheight) params.boxheight = String(p.boxheight);

  // apprno: 정확히 10자리일 때만 전달 (Quote API는 없어도 동작)
  const apprno = p.apprno ?? getAppr();
  if (apprno && apprno.length === 10) params.apprno = apprno;

  const xml = await getQuery('api.EmsTotProcCmd.ems', params);
  const fee = parseXml(xml, 'emsTotProc');
  if (!fee) throw new EmsApiError('해당 국가 또는 서비스는 지원되지 않습니다.');
  return { totalFee: parseInt(fee, 10) };
}

// ─────────────────────────────────────────────────────────────
// 2. 발송가능 국가 조회 (EMSAPI-S01-01)
// ─────────────────────────────────────────────────────────────
export interface NationInfo {
  nationcd:  string;
  nationnm:  string;
  nationfn:  string;
  premiumcd: string;
}

export async function getAvailableNations(premiumcd: string): Promise<NationInfo[]> {
  const xml = await getQuery('api.RetrieveNationListRequest.ems', { premiumcd });
  const cds  = parseAll(xml, 'nationcd');
  const nms  = parseAll(xml, 'nationnm');
  const fns  = parseAll(xml, 'nationfn');
  return cds.map((cd, i) => ({
    nationcd:  cd,
    nationnm:  nms[i] ?? '',
    nationfn:  fns[i] ?? '',
    premiumcd,
  }));
}

// ─────────────────────────────────────────────────────────────
// 3. 고객번호 조회 (EMSAPI-C01-01) — 최초 1회 셋업용
// ─────────────────────────────────────────────────────────────
export async function getEmsCustomerNo(memberID: string): Promise<string> {
  const xml = await postEncrypted('api.EmsIdCustnoInfo.ems', { memberID });
  const custno = parseXml(xml, 'custno');
  if (!custno) throw new Error('EMS 고객번호를 조회하지 못했습니다.');
  return custno;
}

// ─────────────────────────────────────────────────────────────
// 4. 계약승인번호 조회 (EMSAPI-C01-02)
// ─────────────────────────────────────────────────────────────
export interface ApprovalInfo {
  apprno:       string;
  expl:         string;
  prcpaymethcd: string;  // 10=즉납, 12=후납
  cntracdivcd:  string;  // H=계약국제특급, J=K-Packet
}

export async function getEmsApprovalList(custno?: string): Promise<ApprovalInfo[]> {
  const no = custno ?? getCust();
  if (!no) throw new Error('EMS_CUSTOMER_NO 환경변수가 설정되지 않았습니다.');
  const xml = await postEncrypted('api.EmsPrcPayMethodList.ems', { custno: no });
  const apprnos = parseAll(xml, 'apprno');
  const expls   = parseAll(xml, 'expl');
  const methods = parseAll(xml, 'prcpaymethcd');
  const divs    = parseAll(xml, 'cntracdivcd');
  return apprnos.map((a, i) => ({
    apprno:       a,
    expl:         expls[i] ?? '',
    prcpaymethcd: methods[i] ?? '',
    cntracdivcd:  divs[i] ?? '',
  }));
}

// ─────────────────────────────────────────────────────────────
// 5. 접수신청(픽업요청) (EMSAPI-R01-01)
// ─────────────────────────────────────────────────────────────
export interface EmsApplyParams {
  // 계약 정보
  custno?:   string;
  apprno?:   string;
  premiumcd: string;   // 31=EMS, 32=EMS프리미엄, 14=K-Packet
  em_ee:     string;   // em/ee/rl
  countrycd: string;   // 2자리 국가코드

  // 중량/크기
  totweight: number;   // 총중량(g)
  boxlength: number;   // 가로(cm)
  boxwidth:  number;   // 세로(cm)
  boxheight: number;   // 높이(cm)

  // 발송인 (인프론트 창고)
  sender:         string;  // 발송인명
  senderzipcode:  string;  // 우편번호 (6자리)
  senderaddr1:    string;  // 상세
  senderaddr2:    string;  // 시/군/구
  senderaddr3:    string;  // 도/시
  sendertelno1:   string;  // 국가코드 (82)
  sendertelno2:   string;
  sendertelno3:   string;
  sendertelno4:   string;
  sendermobile1?: string;
  sendermobile2?: string;
  sendermobile3?: string;
  sendermobile4?: string;

  // 수취인
  receivename:      string;
  receivezipcode?:  string;
  receiveaddr1:     string;  // 주/도
  receiveaddr2:     string;  // 시/군
  receiveaddr3:     string;  // 상세
  receivetelno?:    string;  // 전체 전화번호
  receivemail?:     string;

  // 물품 정보 (;구분)
  EM_gubun:  string;   // Merchandise;Merchandise
  contents:  string;   // 품목명 (영문, ;구분)
  number:    string;   // 개수 (;구분)
  weight:    string;   // 순중량g (;구분)
  value:     string;   // 가격USD (;구분)
  hs_code:   string;   // HS코드 (;구분)
  origin:    string;   // 생산지코드 (;구분)
  currunitcd: string;  // USD or EUR

  // 옵션
  orderno?:   string;  // 업체 주문번호 (unique)
  boyn?:      'Y'|'N';
  boprc?:     number;
  snd_message?: string;
}

export interface EmsApplyResult {
  receiveseq:       string;  // 접수번호
  prerecevprc:      string;  // 우편요금(KRW)
  regino:           string;  // 등기번호 (EG000001KR 형식)
  reqno:            string;  // 예약번호
  treatporegipocd:  string;  // 우편용 국기호
  treatporegipoengnm: string; // 우체국 영문명
  orderno:          string;
}

export async function applyEms(p: EmsApplyParams): Promise<EmsApplyResult> {
  const custno = p.custno ?? getCust();
  const apprno = p.apprno ?? getAppr();
  if (!custno) throw new Error('EMS_CUSTOMER_NO 환경변수가 설정되지 않았습니다.');
  if (!apprno) throw new Error('EMS_APPROVAL_NO 환경변수가 설정되지 않았습니다.');

  const params: Record<string, unknown> = {
    custno, apprno,
    premiumcd: p.premiumcd,
    em_ee:     p.em_ee,
    countrycd: p.countrycd,
    totweight: p.totweight,
    boxlength: p.boxlength,
    boxwidth:  p.boxwidth,
    boxheight: p.boxheight,
    boyn:      p.boyn ?? 'N',
    boprc:     p.boprc ?? 0,
    orderno:   p.orderno ?? `SPB-${Date.now()}`,
    sender:         p.sender,
    senderzipcode:  p.senderzipcode,
    senderaddr1:    p.senderaddr1,
    senderaddr2:    p.senderaddr2,
    senderaddr3:    p.senderaddr3,
    sendertelno1:   p.sendertelno1,
    sendertelno2:   p.sendertelno2,
    sendertelno3:   p.sendertelno3,
    sendertelno4:   p.sendertelno4,
    receivename:    p.receivename,
    receivezipcode: p.receivezipcode ?? '',
    receiveaddr1:   p.receiveaddr1,
    receiveaddr2:   p.receiveaddr2,
    receiveaddr3:   p.receiveaddr3,
    receivetelno:   p.receivetelno ?? '',
    receivemail:    p.receivemail ?? '',
    EM_gubun:  p.EM_gubun,
    contents:  p.contents,
    number:    p.number,
    weight:    p.weight,
    value:     p.value,
    hs_code:   p.hs_code,
    origin:    p.origin,
    currunitcd: p.currunitcd,
    snd_message: p.snd_message ?? '',
  };

  const xml = await postEncrypted('api.EmsApplyInsertReceiveTempCmdNew.ems', params);

  return {
    receiveseq:           parseXml(xml, 'receiveseq') ?? '',
    prerecevprc:          parseXml(xml, 'prerecevprc') ?? '0',
    regino:               parseXml(xml, 'regino') ?? '',
    reqno:                parseXml(xml, 'reqno') ?? '',
    treatporegipocd:      parseXml(xml, 'treatporegipocd') ?? '',
    treatporegipoengnm:   parseXml(xml, 'treatporegipoengnm') ?? '',
    orderno:              parseXml(xml, 'orderno') ?? '',
  };
}

/** 개발용 Mock — 실제 API 미호출 */
export function mockApplyEms(p: Pick<EmsApplyParams, 'premiumcd' | 'em_ee' | 'countrycd'>): EmsApplyResult {
  const prefix = p.premiumcd === '32' ? 'UP' : p.em_ee === 'rl' ? 'LK' : 'EG';
  return {
    receiveseq:         `S${Date.now()}`,
    prerecevprc:        '36500',
    regino:             `${prefix}${Math.floor(Math.random()*1e9).toString().padStart(9,'0')}KR`,
    reqno:              `${Date.now()}`,
    treatporegipocd:    '10186',
    treatporegipoengnm: 'SEOUL GWANJIN',
    orderno:            `SPB-${Date.now()}`,
  };
}

// ─────────────────────────────────────────────────────────────
// 6. 접수신청 취소 (EMSAPI-R03-01)
// ─────────────────────────────────────────────────────────────
export async function cancelEms(params: {
  custno?: string;
  apprno?: string;
  reqno: string;
  regino: string;
}): Promise<{ canceledyn: string; notcancelreason: string }> {
  const custno = params.custno ?? getCust();
  const apprno = params.apprno ?? getAppr();
  const xml = await postEncrypted('api.EmsApplyCancel.ems', {
    custno, apprno,
    reqno:    params.reqno,
    regino:   params.regino,
    cancelyn: 'Y',
  });
  return {
    canceledyn:      parseXml(xml, 'canceledyn') ?? 'N',
    notcancelreason: parseXml(xml, 'notcancelreason') ?? '',
  };
}
