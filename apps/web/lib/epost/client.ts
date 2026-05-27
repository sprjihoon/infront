/**
 * 우체국 계약소포 API 클라이언트 (Node.js / Next.js API Route용)
 * officeSer(공급지코드): 260537802 (인프론트)
 */

import { seed128Encrypt, buildEpostParams } from './seed128';
import type { InsertOrderParams, InsertOrderResponse, GetResInfoParams, GetResInfoResponse, CancelOrderParams, EPOST_TREAT_STATUS } from './types';
export type { GetResInfoResponse };

const EPOST_BASE_URL = 'https://ship.epost.go.kr';
const OFFICE_SER = '260537802'; // 공급지코드 (인프론트)

function getEnv(key: string) {
  return process.env[key] ?? '';
}

/** 우체국 API — 우편번호는 숫자 5자리 */
export function normalizeEpostZip(zip?: string | number | null): string {
  if (zip == null || zip === '') return '';
  return String(zip).replace(/\D/g, '').slice(0, 5);
}

/** "대구 동구 …" → "대구광역시 동구 …" (주소 검색 축약형 보정) */
function expandMetroShortName(addr: string): string {
  const pairs: [RegExp, string][] = [
    [/^대구\s+(?!광역시)/, '대구광역시 '],
    [/^부산\s+(?!광역시)/, '부산광역시 '],
    [/^인천\s+(?!광역시)/, '인천광역시 '],
    [/^광주\s+(?!광역시)/, '광주광역시 '],
    [/^대전\s+(?!광역시)/, '대전광역시 '],
    [/^울산\s+(?!광역시)/, '울산광역시 '],
    [/^세종\s+(?!특별자치시)/, '세종특별자치시 '],
  ];
  for (const [re, prefix] of pairs) {
    if (re.test(addr)) return addr.replace(re, prefix);
  }
  return addr;
}

/** 우체국 recAddr1/ordAddr1 — 앞뒤 공백 제거 + 시·도 축약 보정 */
export function normalizeEpostAddr1(addr?: string | null): string {
  const trimmed = addr?.trim() ?? '';
  return trimmed ? expandMetroShortName(trimmed) : '';
}

/** 센터 ordAddr2 — 미입력 시 '없음' (modo shipments-book 동일) */
export function resolveEpostCenterAddr2(detail?: string | null): string {
  const trimmed = detail?.trim();
  return trimmed && trimmed.length >= 2 ? trimmed : '없음';
}

/** 우체국 수거 상세주소(recAddr2) 최소 길이 */
export const EPOST_PICKUP_DETAIL_MIN_LEN = 2;

export function isValidPickupAddressDetail(detail?: string | null): boolean {
  return (detail ?? '').trim().length >= EPOST_PICKUP_DETAIL_MIN_LEN;
}

/** null이면 통과, 아니면 저장/신청 전에 alert 등에 쓸 메시지 */
export function validatePickupAddressDetail(detail?: string | null): string | null {
  const trimmed = (detail ?? '').trim();
  if (!trimmed) {
    return '상세주소(동·호수, 층)를 입력해주세요. 우체국 수거에 필요합니다.';
  }
  if (trimmed.length < EPOST_PICKUP_DETAIL_MIN_LEN) {
    if (/^\d$/.test(trimmed)) {
      return `"${trimmed}"만으로는 부족합니다. 예: ${trimmed}층, 302호`;
    }
    return '상세주소는 2글자 이상 입력해주세요. (예: 201호, 제3층)';
  }
  const compact = trimmed.replace(/\s+/g, '');
  if (/^\d+층$/.test(compact)) {
    return `"${trimmed}"만 입력하면 우체국 접수가 거절될 수 있습니다. 예: 제${compact}, 201호`;
  }
  return null;
}

/** 고객 수거지 recAddr2 — 미입력 시 빈 문자열 (modo shipments-book 동일) */
export function resolveEpostPickupAddr2(detail?: string | null): string {
  const trimmed = detail?.trim();
  return trimmed && trimmed.length >= EPOST_PICKUP_DETAIL_MIN_LEN ? trimmed : '';
}

/**
 * 우체국 반품소포 recAddr2 — "3층"처럼 숫자+층만 2글자면 파서가 recTel 등을 밀어 ERR-311/522 발생.
 * 라이브 검증: "3층" 실패, "제3층"/"201호" 성공.
 */
export function normalizeEpostPickupAddr2(detail: string): string {
  const t = sanitizeEpostPlainField(detail.trim());
  if (!t) return t;
  const compact = t.replace(/\s+/g, '');
  if (/^\d+층$/.test(compact)) return `제${compact}`;
  return t;
}

/**
 * 주소록 address_detail 컬럼이 비어 있어도 도로명 주소 문자열에 상세가 포함된 경우 추출
 * (예: "대구광역시 동구 안심로 188 2, 3층" 또는 "… 188 (신기동)")
 */
export function inferPickupAddressDetail(
  addr1?: string | null,
  detail?: string | null,
): string {
  const fromColumn = (detail ?? '').trim();
  if (fromColumn.length >= 2) return fromColumn;

  const full = (addr1 ?? '').trim();
  if (full.length < 5) return '';

  // 도로번호 뒤 상세 (예: 안심로 188 2, 3층 (신기동))
  const roadTail = full.match(/(?:로|길|대로)\s*(\d+(?:-\d+)?)\s+(.+)$/);
  if (roadTail && roadTail[2].trim().length >= 2) return roadTail[2].trim();

  const commaParts = full.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const last = commaParts[commaParts.length - 1];
    if (last.length >= 2 && last.length <= 50 && !/^\d{5}$/.test(last)) return last;
  }

  const floor = full.match(/(\d+\s*층(?:\s*\d+)?[^\s,)]*|\d+\s*호|\d+동\s*\d+[^\s,)]*)/);
  if (floor && floor[1].trim().length >= 2) return floor[1].trim();

  const paren = full.match(/\(([^)]+)\)\s*$/);
  if (paren && paren[1].trim().length >= 2) return paren[1].trim();

  return '';
}

/**
 * 우체국 recAddr1(도로명) / recAddr2(상세) 분리
 * 한 줄 주소에 상세가 붙어 있으면 도로명만 addr1, 나머지 addr2
 */
export function splitPickupAddressForEpost(
  addr1?: string | null,
  detail?: string | null,
): { addr1: string; addr2: string } {
  const full = normalizeEpostAddr1(addr1);
  const d = (detail ?? '').trim();
  const inferred = inferPickupAddressDetail(full, d);

  if (full.length >= 2 && d.length >= 2) {
    return { addr1: full, addr2: d };
  }

  if (full.length >= 2 && inferred.length >= 2) {
    const roadOnly = full
      .replace(new RegExp(`\\s*${escapeRegExpForAddr(inferred)}\\s*$`), '')
      .trim();
    if (roadOnly.length >= 2) {
      return { addr1: roadOnly, addr2: inferred };
    }
    const roadMatch = full.match(/^(.+?(?:로|길|대로)\s*\d+(?:-\d+)?)\s+(.+)$/);
    if (roadMatch && roadMatch[1].trim().length >= 2 && roadMatch[2].trim().length >= 2) {
      return { addr1: roadMatch[1].trim(), addr2: roadMatch[2].trim() };
    }
    return { addr1: full, addr2: inferred };
  }

  if (full.length >= 2) {
    const roadMatch = full.match(/^(.+?(?:로|길|대로)\s*\d+(?:-\d+)?)\s+(.+)$/);
    if (roadMatch && roadMatch[2].trim().length >= 2) {
      return { addr1: roadMatch[1].trim(), addr2: roadMatch[2].trim() };
    }
    return { addr1: full, addr2: resolveEpostPickupAddr2(d) };
  }

  return { addr1: '', addr2: resolveEpostPickupAddr2(d || inferred) };
}

function escapeRegExpForAddr(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @deprecated resolveEpostCenterAddr2 또는 resolveEpostPickupAddr2 사용 */
export function resolveEpostRecAddr2(detail?: string | null): string {
  return resolveEpostCenterAddr2(detail);
}

/** 우체국 API 평문 — & = 줄바꿈이 있으면 필드가 밀려 ordMob ERR-522 유발 */
export function sanitizeEpostPlainField(value: string): string {
  return value.replace(/[&=\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 우체국 API — 전화번호는 ASCII 숫자만 (공백·하이픈·+82·전각숫자 등 제거) */
export function normalizeEpostPhone(phone?: string | null, maxLen = 12): string {
  if (!phone) return '';
  let digits = '';
  for (const ch of String(phone)) {
    if (ch >= '0' && ch <= '9') digits += ch;
  }
  if (digits.startsWith('82') && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }
  return digits.substring(0, maxLen);
}

const EPOST_PHONE_RE = /^\d{9,12}$/;

/** ordMob/recTel 등 — 우체국 ERR-522 방지 */
export function requireEpostPhone(
  phone: string | undefined | null,
  fieldLabel: string,
): string {
  const digits = normalizeEpostPhone(phone);
  if (!EPOST_PHONE_RE.test(digits)) {
    throw new Error(
      `${fieldLabel}는 숫자 9~12자리여야 합니다. (현재: "${(phone ?? '').trim() || '(비어 있음)'}") ` +
        'Vercel INFRONT_CENTER_PHONE·수거 연락처를 01012345678 형식으로 설정해주세요.',
    );
  }
  return digits;
}

/** UTF-8 바이트 기준 문자열 절단 (우체국 API 필드 길이 제한) */
export function truncateUtf8Bytes(str: string, maxBytes: number): string {
  if (!str) return str;
  const buf = Buffer.from(str, 'utf8');
  if (buf.length <= maxBytes) return str;
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
  return buf.subarray(0, end).toString('utf8');
}

/** InsertOrder orderNo — 영숫자, 하이픈 없음 (SPB + timestamp + seq) */
export function formatEpostOrderNo(prefix = 'SPB', seq = 1): string {
  return `${prefix}${Date.now()}${seq}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
}

/** 우체국 API — ordCompNm 실측 12byte 초과 시 regData 필드 밀림 */
const EPOST_ORD_COMP_NM_MAX_BYTES = 12;
const EPOST_ADDR_MAX_BYTES = 100;

const INSERT_ORDER_KEYS = new Set([
  'custNo', 'apprNo', 'payType', 'reqType', 'officeSer',
  'weight', 'volume', 'microYn', 'packngMtrCd', 'orderNo',
  'insuYn', 'insuAmt',
  'ordCompNm', 'inqTelCn', 'ordNm', 'ordZip', 'ordAddr1', 'ordAddr2', 'ordTel', 'ordMob',
  'recNm', 'recZip', 'recAddr1', 'recAddr2', 'recTel', 'recMob',
  'contCd', 'goodsNm', 'goodsCd', 'goodsMdl', 'goodsSize', 'goodsColor', 'qty',
  'delivMsg', 'smsOrdCd', 'retReason', 'retVisitYmd', 'retOrigRegiNo',
  'printYn', 'printAreaCdYn',
]);

function sanitizeInsertOrderBody(body: Record<string, unknown>) {
  for (const key of Object.keys(body)) {
    if (!INSERT_ORDER_KEYS.has(key)) delete body[key];
  }
  for (const key of ['ordMob', 'ordTel', 'recMob', 'recTel', 'inqTelCn']) {
    if (key in body && body[key] != null && body[key] !== '') {
      body[key] = normalizeEpostPhone(String(body[key]));
    }
  }
  const reqType = String(body.reqType ?? '');
  if (reqType === '2') {
    // 반품소포: recMob 있으면 우체국 복호화 파서가 recZip 등 다음 필드를 밀어냄
    delete body.recMob;
    if ('ordMob' in body) {
      body.ordMob = requireEpostPhone(String(body.ordMob ?? ''), '주문자 휴대폰(ordMob)');
    }
    if ('recTel' in body) {
      body.recTel = requireEpostPhone(String(body.recTel ?? ''), '수취인 연락처(recTel)');
    }
    if (body.inqTelCn != null && body.inqTelCn !== '') {
      body.inqTelCn = requireEpostPhone(String(body.inqTelCn), '문의전화(inqTelCn)');
    }
  }
  if (typeof body.ordCompNm === 'string') {
    body.ordCompNm = truncateUtf8Bytes(body.ordCompNm, EPOST_ORD_COMP_NM_MAX_BYTES);
  }
  if (typeof body.ordNm === 'string') {
    body.ordNm = truncateUtf8Bytes(body.ordNm, 40);
  }
  if (typeof body.recNm === 'string') {
    body.recNm = truncateUtf8Bytes(body.recNm, 40);
  }
  for (const key of ['ordAddr1', 'ordAddr2', 'recAddr1', 'recAddr2'] as const) {
    const raw = body[key];
    if (typeof raw === 'string') {
      body[key] = truncateUtf8Bytes(sanitizeEpostPlainField(raw), EPOST_ADDR_MAX_BYTES);
    }
  }
  if (typeof body.goodsNm === 'string') {
    body.goodsNm = truncateUtf8Bytes(sanitizeEpostPlainField(body.goodsNm), 200);
  }
  if (typeof body.delivMsg === 'string' && body.delivMsg !== '') {
    body.delivMsg = truncateUtf8Bytes(sanitizeEpostPlainField(body.delivMsg), 200);
  }
  if (String(body.reqType ?? '') === '2') {
    const mob = String(body.ordMob ?? '');
    if (!EPOST_PHONE_RE.test(mob)) {
      throw new Error(
        `주문자 휴대폰(ordMob) 형식 오류: "${mob || '(비어 있음)'}" — 수거 연락처를 01012345678 형식으로 입력해주세요.`,
      );
    }
  }
  if (typeof body.orderNo === 'string') {
    body.orderNo = body.orderNo.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 20);
  }
  if (typeof body.recZip === 'string') {
    body.recZip = normalizeEpostZip(body.recZip);
  }
  if (typeof body.ordZip === 'string') {
    body.ordZip = normalizeEpostZip(body.ordZip);
  }
  if (!body.orderNo || String(body.orderNo).trim() === '') {
    throw new Error('orderNo가 비어 있습니다.');
  }
  if (typeof body.recAddr2 === 'string' && body.recAddr2.trim() === '') {
    if (reqType === '2') {
      throw new Error(
        '반품인 상세주소(recAddr2)가 비어 있습니다. 수거지 상세주소를 입력해주세요.',
      );
    }
    body.recAddr2 = '없음';
  }
  if (
    reqType === '2' &&
    typeof body.recAddr2 === 'string' &&
    body.recAddr2.trim() === '없음'
  ) {
    throw new Error(
      '반품인 상세주소(recAddr2)에 "없음"은 사용할 수 없습니다. 동·호수·층을 입력해주세요.',
    );
  }
  if (typeof body.ordAddr2 === 'string' && body.ordAddr2.trim() === '') {
    body.ordAddr2 = '없음';
  }
}

function parseXml(xml: string, tag: string): string | null {
  const cdata = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[(.*?)\\]\\]>\\s*</${tag}>`, 's').exec(xml);
  if (cdata) return cdata[1].trim();
  const plain = new RegExp(`<${tag}>(.*?)</${tag}>`, 's').exec(xml);
  return plain ? plain[1].trim() : null;
}

async function callEPost(
  endpoint: string,
  params: Record<string, unknown>,
  testYn: 'Y' | 'N' = 'N'
): Promise<string> {
  const apiKey = getEnv('EPOST_API_KEY');
  const securityKey = getEnv('EPOST_SECURITY_KEY');

  if (!apiKey) throw new Error('EPOST_API_KEY 환경변수가 설정되지 않았습니다.');
  if (!securityKey) throw new Error('EPOST_SECURITY_KEY 환경변수가 설정되지 않았습니다.');

  let url = `${EPOST_BASE_URL}/${endpoint}?key=${apiKey}`;
  if (testYn === 'Y') url += '&testYn=Y';

  const plainText = buildEpostParams(params);

  if (String(params.reqType) === '2') {
    const fields: Record<string, string> = {};
    for (const pair of plainText.split('&')) {
      const idx = pair.indexOf('=');
      if (idx > 0) fields[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
    const rec2 = (fields.recAddr2 ?? '').trim();
    if (!rec2 || rec2 === '없음' || rec2.length < EPOST_PICKUP_DETAIL_MIN_LEN) {
      throw new Error(
        `우체국 반품 수거 전송 오류: recAddr2="${rec2 || '(비어 있음)'}" — ` +
          '수취인(반품인) 상세주소가 센터값(없음)으로 들어갔습니다. ord/rec 매핑을 확인하세요.',
      );
    }
  }

  // 진단용 로그 — recAddr1 실제 전송값 확인
  {
    const dbg: Record<string, string> = {};
    for (const pair of plainText.split('&')) {
      const idx = pair.indexOf('=');
      if (idx > 0) dbg[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
    console.log('[EPOST] plainText fields:', {
      recNm:    dbg.recNm,
      recZip:   dbg.recZip,
      recAddr1: dbg.recAddr1,
      recAddr2: dbg.recAddr2,
      recTel:   dbg.recTel,
      ordNm:    dbg.ordNm,
      ordAddr1: dbg.ordAddr1,
      ordZip:   dbg.ordZip,
      ordMob:   dbg.ordMob,
      ordTel:   dbg.ordTel,
      inqTelCn: dbg.inqTelCn,
      recMobInPlain: 'recMob' in dbg,
      plainLen: plainText.length,
    });
  }

  const encrypted = seed128Encrypt(plainText, securityKey);
  url += `&regData=${encodeURIComponent(encrypted)}`;

  async function attemptFetch(): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    try {
      return await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': 'Apache-HttpClient/4.5.1 (Java/1.8.0_91)' },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
  }

  let resp: Response;
  try {
    try {
      resp = await attemptFetch();
    } catch (firstNetErr) {
      const isAbort = firstNetErr instanceof Error && (firstNetErr.name === 'AbortError' || firstNetErr.message.includes('abort'));
      if (isAbort) throw firstNetErr;
      // Network-level retry after 1 s (handles transient ECONNRESET / cold-start drops)
      console.warn('[EPOST] first attempt failed, retrying in 1s:', firstNetErr instanceof Error ? firstNetErr.message : firstNetErr);
      await new Promise((r) => setTimeout(r, 1000));
      resp = await attemptFetch();
    }
  } catch (err) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'));
    if (isAbort) {
      throw new Error('우체국 API 응답 시간 초과(30초). 잠시 후 다시 시도해주세요.');
    }
    const detail = err instanceof Error ? err.message : String(err);
    // err.cause contains the underlying Node.js socket/DNS error (e.g. ECONNREFUSED, ENOTFOUND)
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
    const causeCode =
      err instanceof Error && err.cause != null && typeof (err.cause as Record<string, unknown>).code === 'string'
        ? (err.cause as Record<string, unknown>).code as string
        : undefined;
    console.error('[EPOST] fetch error', { detail, cause, causeCode, endpoint });
    const hint =
      causeCode === 'ECONNREFUSED' ? '서버가 연결을 거부했습니다.' :
      causeCode === 'ENOTFOUND'    ? 'DNS 조회에 실패했습니다.' :
      causeCode === 'ETIMEDOUT'    ? '연결 시도 시간이 초과됐습니다.' :
      causeCode === 'ECONNRESET'   ? '연결이 강제로 끊어졌습니다.' :
      cause ?? detail;
    throw new Error(
      `우체국 API 서버(${EPOST_BASE_URL})에 연결하지 못했습니다. 네트워크 또는 우체국 서비스 상태를 확인해주세요. (${hint})`,
    );
  }

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`EPost HTTP ${resp.status}: ${txt}`);
  }

  const xml = await resp.text();

  if (xml.includes('<error>') || xml.includes('ERR-')) {
    const code = parseXml(xml, 'error_code') ?? 'UNKNOWN';
    const msg  = parseXml(xml, 'message') ?? xml.substring(0, 200);
    throw new Error(`EPost Error ${code}: ${msg}`);
  }

  return xml;
}

export async function insertOrder(params: InsertOrderParams): Promise<InsertOrderResponse> {
  const custNo = (params.custNo || getEnv('EPOST_CUSTOMER_ID')).trim();
  const apprNo = (params.apprNo || getEnv('EPOST_APPROVAL_NO')).trim();
  const testYn  = params.testYn === 'Y' ? 'Y' : 'N';

  const weight = Math.floor(typeof params.weight === 'number' && params.weight > 0 ? params.weight : 2);
  const body: Record<string, unknown> = {
    ...params,
    custNo,
    apprNo,
    officeSer: params.officeSer ?? OFFICE_SER,
    weight,
    volume: Math.floor(typeof params.volume === 'number' && params.volume > 0 ? params.volume : 60),
    printYn: params.printYn ?? 'Y',
    microYn: params.microYn === 'Y' ? 'Y' : 'N',
  };
  delete body.testYn;
  sanitizeInsertOrderBody(body);

  if (!body.recZip || String(body.recZip).length !== 5) {
    throw new Error('수취인 우편번호(recZip)가 없습니다.');
  }
  if (!body.recAddr1 || normalizeEpostAddr1(String(body.recAddr1)).length < 2) {
    throw new Error('수취인 주소(recAddr1)가 없습니다.');
  }
  if (String(body.reqType ?? '') === '2') {
    const recDetail = String(body.recAddr2 ?? '').trim();
    if (recDetail.length < EPOST_PICKUP_DETAIL_MIN_LEN || recDetail === '없음') {
      throw new Error(
        '반품인 상세주소(recAddr2)가 없습니다. 수거지 동·호수·층을 2글자 이상 입력해주세요.',
      );
    }
    if (!body.recAddr1 || normalizeEpostAddr1(String(body.recAddr1)).length < 2) {
      throw new Error('반품인 도로명 주소(recAddr1)가 없습니다.');
    }
    requireEpostPhone(String(body.ordMob ?? ''), '센터 연락처(ordMob)');
    requireEpostPhone(String(body.recTel ?? body.recMob ?? ''), '수거 연락처(recTel)');
  } else {
    const recTel = String(body.recTel ?? body.recMob ?? '');
    if (!recTel || recTel.length < 9) {
      throw new Error('수취인 연락처(recTel)가 없습니다.');
    }
  }

  const xml = await callEPost('api.InsertOrder.jparcel', body, testYn);

  const result: InsertOrderResponse = {
    reqNo:     parseXml(xml, 'reqNo') ?? '',
    resNo:     parseXml(xml, 'resNo') ?? '',
    regiNo:    parseXml(xml, 'regiNo') ?? '',
    regiPoNm:  parseXml(xml, 'regiPoNm') ?? parseXml(xml, 'regipoNm') ?? '',
    resDate:   parseXml(xml, 'resDate') ?? '',
    price:     parseXml(xml, 'price') ?? '0',
    vTelNo:    parseXml(xml, 'vTelNo') ?? undefined,
    insuFee:   parseXml(xml, 'insuFee') ?? undefined,
    islandAddFee: parseXml(xml, 'islandAddFee') ?? undefined,
    notifyMsg: parseXml(xml, 'notifyMsg') ?? undefined,
  };

  if (!result.regiNo) throw new Error('우체국 API 응답에 운송장번호(regiNo)가 없습니다.');
  return result;
}

export async function getResInfo(params: GetResInfoParams): Promise<GetResInfoResponse> {
  const custNo = ((params.custNo ?? '') || getEnv('EPOST_CUSTOMER_ID')).trim();

  const xml = await callEPost('api.GetResInfo.jparcel', {
    custNo,
    reqType: params.reqType,
    orderNo: params.orderNo,
    reqYmd:  params.reqYmd,
  });

  const treatStusCd = parseXml(xml, 'treatStusCd') ?? '00';
  const STATUS_NAMES: Record<string, string> = {
    '00': '신청접수', '01': '집하완료', '02': '수거중', '03': '배달완료',
  };

  return {
    reqNo:       parseXml(xml, 'reqNo')    ?? '',
    resNo:       parseXml(xml, 'resNo')    ?? '',
    regiNo:      parseXml(xml, 'regiNo')   ?? '',
    regiPoNm:    parseXml(xml, 'regiPoNm') ?? '',
    resDate:     parseXml(xml, 'resDate')  ?? '',
    price:       parseXml(xml, 'price')    ?? '0',
    vTelNo:      parseXml(xml, 'vTelNo')   ?? undefined,
    treatStusCd,
    treatStusNm: STATUS_NAMES[treatStusCd],
  };
}

export async function cancelOrder(params: CancelOrderParams): Promise<{
  reqNo: string;
  resNo: string;
  canceledYn?: string;
}> {
  const custNo = (params.custNo || getEnv('EPOST_CUSTOMER_ID')).trim();
  const apprNo = (params.apprNo || getEnv('EPOST_APPROVAL_NO')).trim();

  const payload = {
    custNo,
    apprNo,
    reqType: params.reqType,
    payType: params.payType ?? '2',
    reqNo:   params.reqNo,
    resNo:   params.resNo,
    regiNo:  params.regiNo,
    reqYmd:  params.reqYmd,
    delYn:   params.delYn,
  };

  const parseCancel = (xml: string) => ({
    reqNo: parseXml(xml, 'reqNo') ?? '',
    resNo: parseXml(xml, 'resNo') ?? '',
    canceledYn: parseXml(xml, 'canceledYn') ?? undefined,
  });

  // modo: api.GetResCancelCmd.jparcel (SHPAPI-U02-01)
  try {
    const xml = await callEPost('api.GetResCancelCmd.jparcel', payload);
    return parseCancel(xml);
  } catch {
    const xml = await callEPost('api.CancelOrder.jparcel', payload);
    return parseCancel(xml);
  }
}

export function mockInsertOrder(): InsertOrderResponse {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-7);
  return {
    reqNo:    `MOCK-REQ-${Date.now()}`,
    resNo:    `MOCK-RES-${Date.now()}`,
    regiNo:   `7000000${suffix.padStart(7, '0')}`,
    regiPoNm: '테스트우체국',
    resDate:  `${ymd}120000`,
    price:    '5000',
  };
}
