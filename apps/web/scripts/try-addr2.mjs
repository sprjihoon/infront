/**
 * recAddr2 변형 테스트 — 같은 3층 주소, 다른 형식들
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

import { insertOrder, cancelOrder, normalizeEpostPhone } from '../lib/epost/client.ts';

const custNo = process.env.EPOST_CUSTOMER_ID.trim();
const apprNo = process.env.EPOST_APPROVAL_NO.trim();
const centerPhone = normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE || '01027239490');

async function test(label, recAddr2) {
  const enc = new TextEncoder();
  const bytes = enc.encode(recAddr2);
  try {
    const r = await insertOrder({
      custNo, apprNo,
      payType: '2', reqType: '2',
      officeSer: '260537802',
      weight: 2, volume: 60, microYn: 'N',
      orderNo: `SPB${Date.now()}1`,
      ordCompNm: '인프론트',
      inqTelCn: '01027239490',
      ordNm: '인프론트',
      ordZip: '41142',
      ordAddr1: '대구광역시 동구 동촌로 1',
      ordAddr2: '동대구우체국 2층 소포실',
      ordMob: centerPhone,
      recNm: '홍길동',
      recZip: '41100',
      recAddr1: '대구광역시 동구 안심로 188',
      recAddr2,
      recTel: '01027239490',
      contCd: '025',
      goodsNm: '해외배송 물품',
      printYn: 'Y',
      retVisitYmd: '20260604',
      testYn: 'Y',
    });
    console.log(`✅ "${recAddr2}" (${bytes.length}b) → regiNo=${r.regiNo}`);
    await cancelOrder({ custNo, apprNo, reqType: '2', payType: '2', reqNo: r.reqNo, resNo: r.resNo ?? '', regiNo: r.regiNo, reqYmd: '20260528', delYn: 'Y' }).catch(() => {});
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : String(e);
    console.log(`❌ "${recAddr2}" (${bytes.length}b) → ${msg}`);
    return false;
  }
}

const delay = ms => new Promise(r => setTimeout(r, ms));

console.log('=== recAddr2 변형 테스트 (ordAddr2=full, retVisitYmd=20260604) ===\n');

// 3층 표기 다양한 형식
const variants = [
  '제3층',       // 7b - 현재 실패
  '3층',         // 5b
  '3F',          // 2b (ASCII)
  '3 층',        // 6b
  '제 3 층',     // 9b
  '제3층 사무실', // 16b
  '3층 입구',    // 12b
  '제3층입구',   // 13b
  '3호',         // 4b
  '3층 301',     // 10b - mixing
  '302호',       // 6b
  '3층(제3층)',  // 13b
];

for (const v of variants) {
  await test(v, v);
  await delay(600);
}
