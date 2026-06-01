/**
 * 격리 테스트: 변수를 하나씩 변경하여 어떤 필드가 핵심인지 확인
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

// live-specs MICRO 성공 파라미터 (베이스라인)
const LIVE_SPEC = {
  custNo, apprNo, payType: '2', reqType: '2',
  officeSer: '260537802',
  weight: 2, volume: 60, microYn: 'N',
  orderNo: `SPB${Date.now()}1`.slice(0, 17),
  ordCompNm: '인프론트', inqTelCn: '01012345678',
  ordNm: '인프론트', ordZip: '41142',
  ordAddr1: '대구광역시 동구 동촌로 1',
  ordAddr2: centerAddr2,   // '동대구우체국 2층 소포실' (33b)
  ordMob: centerPhone,
  recNm: '홍길동', recZip: '41142', // CENTER zip (same as live-specs!)
  recAddr1: '대구광역시 동구 동촌로 1', // CENTER addr!
  recAddr2: '상세주소 101호',         // 19 bytes
  recTel: '01012345678',
  contCd: '025', goodsNm: '수거테스트', printYn: 'Y', testYn: 'Y',
};

async function test(label, params) {
  try {
    const r = await insertOrder(params);
    console.log(`✅ [${label}] SUCCESS regiNo=${r.regiNo}`);
    try {
      await cancelOrder({ custNo, apprNo, reqType:'2', payType:'2', reqNo:r.reqNo, resNo:r.resNo??'', regiNo:r.regiNo, reqYmd:new Date().toISOString().slice(0,10).replace(/-/g,''), delYn:'Y' });
    } catch {}
    return true;
  } catch (e) {
    console.log(`❌ [${label}] ${e instanceof Error ? e.message.slice(0,90) : e}`);
    return false;
  }
}

console.log('=== 격리 테스트 ===');
console.log('(live-specs MICRO 성공 파라미터를 기준으로 하나씩 변경)\n');

// BASELINE: live-specs MICRO과 완전히 동일
console.log('T-BASE: 완전 live-specs 복제 (성공해야 함)');
await test('BASE', { ...LIVE_SPEC, orderNo: `SPB${Date.now()}1`.slice(0, 17) });
await new Promise(r => setTimeout(r, 500));

// 1: recZip만 사용자 값으로 변경
console.log('\nT1: recZip만 41100으로');
await test('recZip41100', { ...LIVE_SPEC, orderNo: `SPB${Date.now()}1`.slice(0, 17), recZip: '41100' });
await new Promise(r => setTimeout(r, 500));

// 2: recAddr1만 사용자 값으로
console.log('\nT2: recAddr1만 안심로 188로');
await test('recAddr1User', { ...LIVE_SPEC, orderNo: `SPB${Date.now()}1`.slice(0, 17), recAddr1: '대구광역시 동구 안심로 188' });
await new Promise(r => setTimeout(r, 500));

// 3: recAddr2만 사용자 값으로 (12바이트 차이)
console.log('\nT3: recAddr2만 제3층으로 (7b vs 19b)');
await test('recAddr2Short', { ...LIVE_SPEC, orderNo: `SPB${Date.now()}1`.slice(0, 17), recAddr2: '제3층' });
await new Promise(r => setTimeout(r, 500));

// 4: recTel만 사용자 값으로
console.log('\nT4: recTel만 01027239490으로');
await test('recTelUser', { ...LIVE_SPEC, orderNo: `SPB${Date.now()}1`.slice(0, 17), recTel: '01027239490' });
await new Promise(r => setTimeout(r, 500));

// 5: 모든 rec* 사용자 값 + retVisitYmd 추가
console.log('\nT5: 모든 rec* 사용자값 + retVisitYmd');
await test('fullUser', {
  ...LIVE_SPEC, orderNo: `SPB${Date.now()}1`.slice(0, 17),
  recZip: '41100', recAddr1: '대구광역시 동구 안심로 188', recAddr2: '제3층', recTel: '01027239490',
  goodsNm: '해외배송 물품', retVisitYmd: '20260604',
});
await new Promise(r => setTimeout(r, 500));

// 6: ordAddr2만 '없음'으로 (다른건 live-specs 동일)
console.log('\nT6: ordAddr2만 없음으로 (핵심 검증)');
await test('ordAddr2Short', { ...LIVE_SPEC, orderNo: `SPB${Date.now()}1`.slice(0, 17), ordAddr2: '없음' });
