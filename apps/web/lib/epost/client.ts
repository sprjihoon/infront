/**
 * 우체국 계약소포 API 클라이언트 (Node.js / Next.js API Route용)
 * officeSer(공급지코드): 260537802 (인프론트)
 */

import { seed128Encrypt, buildEpostParams } from './seed128';
import type { InsertOrderParams, InsertOrderResponse, GetResInfoParams, GetResInfoResponse, CancelOrderParams, EPOST_TREAT_STATUS } from './types';
export type { GetResInfoResponse };

const EPOST_BASE_URL = 'http://ship.epost.go.kr';
const OFFICE_SER = '260537802'; // 공급지코드 (인프론트)

function getEnv(key: string) {
  return process.env[key] ?? '';
}

/** 우체국 API — 전화번호는 숫자만 허용 */
export function normalizeEpostPhone(phone?: string, maxLen = 12): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').substring(0, maxLen);
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
  if (typeof body.ordCompNm === 'string') {
    body.ordCompNm = truncateUtf8Bytes(body.ordCompNm, EPOST_ORD_COMP_NM_MAX_BYTES);
  }
  if (typeof body.ordNm === 'string') {
    body.ordNm = truncateUtf8Bytes(body.ordNm, 40);
  }
  if (typeof body.recNm === 'string') {
    body.recNm = truncateUtf8Bytes(body.recNm, 40);
  }
  if (typeof body.goodsNm === 'string') {
    body.goodsNm = truncateUtf8Bytes(body.goodsNm, 200);
  }
  if (typeof body.orderNo === 'string') {
    body.orderNo = body.orderNo.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 20);
  }
  if (!body.orderNo || String(body.orderNo).trim() === '') {
    throw new Error('orderNo가 비어 있습니다.');
  }
  if (typeof body.recAddr2 === 'string' && body.recAddr2.trim() === '') {
    body.recAddr2 = '없음';
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
  const encrypted = seed128Encrypt(plainText, securityKey);
  url += `&regData=${encodeURIComponent(encrypted)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Apache-HttpClient/4.5.1 (Java/1.8.0_91)' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
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
