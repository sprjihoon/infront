/**
 * 프로덕션 정확한 파라미터 테스트
 * ordAddr2='없음' (프로덕션과 동일) + 실제 사용자 rec*
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

async function test(label, params) {
  try {
    const r = await insertOrder(params);
    console.log(`✅ [${label}] regiNo=${r.regiNo} price=${r.price}`);
    // 즉시 취소
    try {
      const cancelResult = await cancelOrder({
        custNo, apprNo, reqType: '2', payType: '2',
        reqNo: r.reqNo, resNo: r.resNo ?? '', regiNo: r.regiNo,
        reqYmd: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        delYn: 'Y',
      });
      console.log(`  → cancel: canceledYn=${cancelResult.canceledYn}`);
    } catch (ce) {
      console.log(`  → cancel FAIL: ${ce.message?.slice(0, 60)}`);
    }
    return true;
  } catch (e) {
    console.log(`❌ [${label}] ${e instanceof Error ? e.message.slice(0, 120) : e}`);
    return false;
  }
}

const delay = ms => new Promise(r => setTimeout(r, ms));

console.log('=== 프로덕션 정확한 params 테스트 ===\n');

const BASE = {
  custNo, apprNo,
  payType: '2', reqType: '2',
  officeSer: '260537802',
  weight: 2, volume: 60, microYn: 'N',
  ordCompNm: '인프론트',
  inqTelCn: '01027239490',  // user phone (production uses pickup phone here)
  ordNm: '인프론트',
  ordZip: '41142',
  ordAddr1: '대구광역시 동구 동촌로 1',
  ordMob: centerPhone,
  recNm: '홍길동',
  recZip: '41100',
  recAddr1: '대구광역시 동구 안심로 188',
  recAddr2: '제3층',
  recTel: '01027239490',
  contCd: '025',
  goodsNm: '해외배송 물품',
  printYn: 'Y',
  retVisitYmd: '20260604',
  testYn: 'Y',
};

// P1: 프로덕션과 완전히 동일 — ordAddr2='없음'
await test('P1 ordAddr2=없음 (프로덕션 현재)', {
  ...BASE, orderNo: `SPB${Date.now()}1`, ordAddr2: '없음',
});
await delay(800);

// P2: ordAddr2=full (개선 후 예상)
await test('P2 ordAddr2=full (개선안)', {
  ...BASE, orderNo: `SPB${Date.now()}1`, ordAddr2: '동대구우체국 2층 소포실',
});
await delay(800);

// P3: ordAddr2=없음 + retVisitYmd 제거 (날짜 없이)
await test('P3 ordAddr2=없음, no retVisitYmd', {
  ...BASE, orderNo: `SPB${Date.now()}1`, ordAddr2: '없음', retVisitYmd: undefined,
});
await delay(800);

// P4: ordAddr2=full + no retVisitYmd
await test('P4 ordAddr2=full, no retVisitYmd', {
  ...BASE, orderNo: `SPB${Date.now()}1`, ordAddr2: '동대구우체국 2층 소포실', retVisitYmd: undefined,
});
await delay(800);

// P5: ordAddr2=full + 짧은 recAddr2 (상세주소 없이) — 제3층 대신 '301호'
await test('P5 ordAddr2=full, recAddr2=301호', {
  ...BASE, orderNo: `SPB${Date.now()}1`, ordAddr2: '동대구우체국 2층 소포실', recAddr2: '301호',
});
