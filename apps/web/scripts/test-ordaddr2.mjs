/**
 * ordAddr2 변경 시 recZip 오류 여부 확인
 * A) ordAddr2='동대구우체국 2층 소포실' (33 bytes, live-specs 성공 케이스)
 * B) ordAddr2='없음' (6 bytes, 현재 production)
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

import { insertOrder, normalizeEpostPhone } from '../lib/epost/client.ts';

const custNo = process.env.EPOST_CUSTOMER_ID.trim();
const apprNo = process.env.EPOST_APPROVAL_NO.trim();
const centerPhone = normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE);

const BASE = {
  custNo, apprNo,
  payType: '2', reqType: '2',
  officeSer: '260537802',
  weight: 2, volume: 60, microYn: 'N',
  ordCompNm: '인프론트',
  inqTelCn: '01027239490',
  ordNm: '인프론트',
  ordZip: '41142',
  ordAddr1: '대구광역시 동구 동촌로 1',
  ordMob: centerPhone || '01027239490',
  // 실제 사용자 수거 주소
  recNm: '홍길동',
  recZip: '41100',
  recAddr1: '대구광역시 동구 안심로 188',
  recAddr2: '제3층',
  recTel: '01027239490',
  contCd: '025',
  goodsNm: '해외배송 물품',
  retVisitYmd: '20260604',
  printYn: 'Y',
  testYn: 'Y',
};

async function test(label, ordAddr2) {
  try {
    const r = await insertOrder({
      ...BASE,
      ordAddr2,
      orderNo: `ADDR2TEST${Date.now()}`.slice(-20),
    });
    console.log(`[${label}] ✅ SUCCESS regiNo=${r.regiNo} price=${r.price}`);
    return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`[${label}] ❌ FAIL: ${msg.slice(0, 100)}`);
    return null;
  }
}

console.log('=== ordAddr2 변경 효과 테스트 ===\n');

// A: 실제 센터 주소 (33 bytes)
const rA = await test('A: 동대구우체국 2층 소포실 (33b)', '동대구우체국 2층 소포실');
await new Promise(r => setTimeout(r, 600));

// B: 현재 production 값 (6 bytes)
await test('B: 없음 (6b)', '없음');
await new Promise(r => setTimeout(r, 600));

// C: '없음' 과 동일 문자수 대체 (같은 길이 ASCII)
await test('C: None (4b ASCII)', 'None');
await new Promise(r => setTimeout(r, 600));

// D: 빈 문자열 → resolveEpostCenterAddr2가 '없음'으로 변환됨
// (이 테스트는 직접 insertOrder에 빈 ordAddr2를 넣으면 sanitize가 '없음'으로 만듦)

// A가 성공했으면 cancel
if (rA) {
  const { cancelOrder } = await import('../lib/epost/client.ts');
  try {
    await cancelOrder({
      custNo, apprNo,
      reqType: '2', payType: '2',
      reqNo: rA.reqNo, resNo: rA.resNo ?? '', regiNo: rA.regiNo,
      reqYmd: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      delYn: 'Y',
    });
    console.log('\n[A] cancel OK');
  } catch (e) {
    console.log('\n[A] cancel fail:', e instanceof Error ? e.message.slice(0, 60) : e);
  }
}
