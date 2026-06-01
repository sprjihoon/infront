/**
 * 가설 검증: ordAddr2='동대구우체국 2층 소포실' + orderNo=17자 → 사용자 실제 주소로 테스트
 * 
 * live-specs MICRO 성공 조건:
 *   - ordAddr2='동대구우체국 2층 소포실' (33 bytes) 
 *   - orderNo=17자 (SPB+13자리타임스탬프+1자리seq)
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

import { insertOrder, normalizeEpostPhone, cancelOrder } from '../lib/epost/client.ts';

const custNo = process.env.EPOST_CUSTOMER_ID.trim();
const apprNo = process.env.EPOST_APPROVAL_NO.trim();
const centerPhone = normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE) || '01027239490';
const centerAddr2 = process.env.INFRONT_CENTER_ADDR2?.trim() || '없음';

// 17자 orderNo 생성 (SPB + 13자리 타임스탬프 + 1자리)
const orderNo17 = `SPB${Date.now()}1`.slice(0, 17);
console.log('orderNo17:', orderNo17, '(', orderNo17.length, 'chars)');

// 사용자 실제 수거지 주소 (스크린샷 기준)
const USER_ADDR = {
  recNm: '홍길동',
  recZip: '41100',
  recAddr1: '대구광역시 동구 안심로 188',
  recAddr2: '제3층',
  recTel: '01027239490',
};

async function test(label, params) {
  try {
    const r = await insertOrder(params);
    console.log(`\n✅ [${label}] SUCCESS!`);
    console.log(`   regiNo=${r.regiNo}, price=${r.price}`);
    // 취소
    try {
      await cancelOrder({
        custNo, apprNo,
        reqType: '2', payType: '2',
        reqNo: r.reqNo, resNo: r.resNo ?? '', regiNo: r.regiNo,
        reqYmd: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        delYn: 'Y',
      });
      console.log(`   cancelled OK`);
    } catch (ce) {
      console.log(`   cancel fail: ${ce instanceof Error ? ce.message.slice(0,60) : ce}`);
    }
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`\n❌ [${label}] FAIL: ${msg.slice(0, 120)}`);
    return false;
  }
}

// === Test 1: ordAddr2=full + orderNo=17자 + retVisitYmd 없음 ===
console.log('\n=== Test 1: ordAddr2=full, orderNo=17자, retVisitYmd 없음 ===');
await test('T1', {
  custNo, apprNo, payType: '2', reqType: '2',
  officeSer: '260537802',
  weight: 2, volume: 60, microYn: 'N',
  orderNo: orderNo17,
  ordCompNm: '인프론트',
  inqTelCn: USER_ADDR.recTel,
  ordNm: '인프론트',
  ordZip: '41142',
  ordAddr1: '대구광역시 동구 동촌로 1',
  ordAddr2: centerAddr2,  // '동대구우체국 2층 소포실'
  ordMob: centerPhone,
  ...USER_ADDR,
  contCd: '025',
  goodsNm: '해외배송 물품',
  printYn: 'Y',
  testYn: 'Y',
});
await new Promise(r => setTimeout(r, 600));

// === Test 2: ordAddr2=full + orderNo=17자 + retVisitYmd 포함 ===
console.log('\n=== Test 2: ordAddr2=full, orderNo=17자, retVisitYmd 포함 ===');
await test('T2', {
  custNo, apprNo, payType: '2', reqType: '2',
  officeSer: '260537802',
  weight: 2, volume: 60, microYn: 'N',
  orderNo: `SPB${Date.now()}1`.slice(0, 17),
  ordCompNm: '인프론트',
  inqTelCn: USER_ADDR.recTel,
  ordNm: '인프론트',
  ordZip: '41142',
  ordAddr1: '대구광역시 동구 동촌로 1',
  ordAddr2: centerAddr2,
  ordMob: centerPhone,
  ...USER_ADDR,
  contCd: '025',
  goodsNm: '해외배송 물품',
  retVisitYmd: '20260604',
  printYn: 'Y',
  testYn: 'Y',
});
await new Promise(r => setTimeout(r, 600));

// === Test 3: ordAddr2=full + orderNo=20자 + retVisitYmd 포함 ===
console.log('\n=== Test 3: ordAddr2=full, orderNo=20자 (seq=6448), retVisitYmd 포함 ===');
await test('T3', {
  custNo, apprNo, payType: '2', reqType: '2',
  officeSer: '260537802',
  weight: 2, volume: 60, microYn: 'N',
  orderNo: `SPB${Date.now()}6448`.slice(0, 20),  // 20자
  ordCompNm: '인프론트',
  inqTelCn: USER_ADDR.recTel,
  ordNm: '인프론트',
  ordZip: '41142',
  ordAddr1: '대구광역시 동구 동촌로 1',
  ordAddr2: centerAddr2,
  ordMob: centerPhone,
  ...USER_ADDR,
  contCd: '025',
  goodsNm: '해외배송 물품',
  retVisitYmd: '20260604',
  printYn: 'Y',
  testYn: 'Y',
});
