/**
 * 우체국 계약소포 API 클라이언트 (Node.js / Next.js API Route용)
 * officeSer(공급지코드): 260537802 (인프론트)
 */

import { seed128Encrypt, buildEpostParams } from './seed128';
import type { InsertOrderParams, InsertOrderResponse, GetResInfoParams, GetResInfoResponse, EPOST_TREAT_STATUS } from './types';
export type { GetResInfoResponse };

const EPOST_BASE_URL = 'http://ship.epost.go.kr';
const OFFICE_SER = '260537802'; // 공급지코드 (인프론트)

function getEnv(key: string) {
  return process.env[key] ?? '';
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

  const body: Record<string, unknown> = {
    ...params,
    custNo,
    apprNo,
    officeSer: params.officeSer ?? OFFICE_SER,
    weight: Math.floor(typeof params.weight === 'number' && params.weight > 0 ? params.weight : 2),
    volume: Math.floor(typeof params.volume === 'number' && params.volume > 0 ? params.volume : 60),
    microYn: params.microYn ?? 'N',
    printYn: params.printYn ?? 'Y',
  };
  delete body.testYn;

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

export function mockInsertOrder(): InsertOrderResponse {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  return {
    reqNo:    `MOCK-REQ-${Date.now()}`,
    resNo:    `MOCK-RES-${Date.now()}`,
    regiNo:   `700000000000${Math.floor(Math.random()*10000).toString().padStart(4,'0')}`,
    regiPoNm: '테스트우체국',
    resDate:  `${ymd}120000`,
    price:    '5000',
  };
}
