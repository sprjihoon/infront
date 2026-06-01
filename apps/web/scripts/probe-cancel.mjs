/**
 * ordAddr2 길이를 변화시켜 필드 파싱 임계 바이트 수 탐색
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(path.join(__dirname, '../.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

// Import production seed128 via tsx
import { seed128Encrypt, buildEpostParams } from '../lib/epost/seed128.ts';

const custNo = process.env.EPOST_CUSTOMER_ID?.trim() ?? '';
const apprNo = process.env.EPOST_APPROVAL_NO?.trim() ?? '';
const secKey = process.env.EPOST_SECURITY_KEY?.trim() ?? '';
const apiKey = process.env.EPOST_API_KEY?.trim() ?? '';
const p = '01027239490';

const BASE = {
  custNo, apprNo,
  payType: '2', reqType: '2',
  officeSer: '260537802',
  weight: 2, volume: 15000, microYn: 'N',
  orderNo: 'PROBEFIXED001',
  ordCompNm: '인프론트',
  inqTelCn: p,
  ordNm: '인프론트',
  ordZip: '41142',
  ordAddr1: '대구광역시 동구 동촌로 1',
  ordMob: p,
  recNm: '홍길동',
  recZip: '41100',
  recAddr1: '대구광역시 동구 안심로 188',
  recAddr2: '제3층',
  recTel: p,
  contCd: '025',
  goodsNm: '테스트',
  retVisitYmd: '20260604',
  printYn: 'Y',
  testYn: 'Y',
};

async function tryPlaintext(label, params) {
  const plainText = buildEpostParams(params, 'api.InsertOrder.jparcel');
  const bytes = Buffer.from(plainText, 'utf8');
  const encrypted = seed128Encrypt(plainText, secKey);
  const url = `https://ship.epost.go.kr/api.InsertOrder.jparcel?key=${apiKey}&testYn=Y&regData=${encodeURIComponent(encrypted)}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Apache-HttpClient/4.5.1 (Java/1.8.0_91)' },
    signal: AbortSignal.timeout(15000),
  });
  const xml = await resp.text();
  const errCode = xml.match(/<!?\[CDATA\[([^\]]*)\]\]>/g)?.map(m=>m.replace(/<!?\[CDATA\[|\]\]>/g,'').trim()) ?? [];
  const code = errCode[0] ?? 'UNKNOWN';
  const msg = errCode[1] ?? xml.slice(0,100);
  console.log(`[${label}] ${bytes.length}b (${Math.ceil(bytes.length/16)} blk) → ${code}: ${msg.slice(0,60)}`);
  return code;
}

// Test: All-ASCII addresses with each contCd value
const ASCII_BASE = {
  ...BASE,
  ordCompNm: 'Infront',
  ordNm: 'Infront',
  ordAddr1: 'Daegu Donggu Dongchonro 1',
  ordAddr2: 'None',
  recNm: 'Hong Gildong',
  recAddr1: 'Daegu Donggu Ansimro 188',
  recAddr2: '3F',
  goodsNm: 'TestGoods',
};
console.log('=== ASCII 주소 + contCd 브루트포스 ===');
for (const cd of ['021','022','023','024','025','026','027','028','029']) {
  await tryPlaintext(`ASCII contCd=${cd}`, { ...ASCII_BASE, contCd: cd });
  await new Promise(r => setTimeout(r, 300));
}
