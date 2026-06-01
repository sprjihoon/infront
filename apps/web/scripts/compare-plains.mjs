/**
 * 실제 production 파라미터 vs live-specs 파라미터 평문 비교
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

import { buildEpostParams, seed128Encrypt } from '../lib/epost/seed128.ts';
import { normalizeEpostPhone, sanitizeEpostPlainField, normalizeEpostAddr1, normalizeEpostZip, normalizeEpostPickupAddr2, splitPickupAddressForEpost, resolveEpostCenterAddr2, truncateUtf8Bytes } from '../lib/epost/client.ts';

const custNo = process.env.EPOST_CUSTOMER_ID.trim();
const apprNo = process.env.EPOST_APPROVAL_NO.trim();
const centerAddr2 = process.env.INFRONT_CENTER_ADDR2?.trim() || '없음';

// === Scenario A: live-specs.mjs MICRO (WORKS) ===
const paramsA = {
  custNo, apprNo,
  payType: '2', reqType: '2',
  officeSer: '260537802',
  weight: 2, volume: 60, microYn: 'N',
  orderNo: 'SPB17799460008781',  // 17 chars (same as actual)
  ordCompNm: '인프론트',
  inqTelCn: '01012345678',
  ordNm: '인프론트',
  ordZip: '41142',
  ordAddr1: '대구광역시 동구 동촌로 1',
  ordAddr2: centerAddr2,    // '동대구우체국 2층 소포실'
  ordMob: '01027239490',
  recNm: '홍길동',
  recZip: '41142',           // CENTER zip!
  recAddr1: '대구광역시 동구 동촌로 1',  // center addr!
  recAddr2: '상세주소 101호',
  recTel: '01012345678',
  contCd: '025',
  goodsNm: '수거테스트',
  printYn: 'Y',
};

// === Scenario B: 실제 사용자 요청 (FAILS with ERR-311) ===
// 사용자 주소: 대구광역시 동구 안심로 188, 제3층, 01027239490
const paramsB = {
  custNo, apprNo,
  payType: '2', reqType: '2',
  officeSer: '260537802',
  weight: 2, volume: 60, microYn: 'N',
  orderNo: 'SPB17799460008781',  // same length
  ordCompNm: '인프론트',
  inqTelCn: '01027239490',
  ordNm: '인프론트',
  ordZip: '41142',
  ordAddr1: '대구광역시 동구 동촌로 1',
  ordAddr2: '없음',              // production always uses '없음'
  ordMob: '01027239490',
  recNm: '홍길동',               // assumed user name
  recZip: '41100',               // USER zip (different!)
  recAddr1: '대구광역시 동구 안심로 188',  // USER addr1
  recAddr2: '제3층',
  recTel: '01027239490',
  contCd: '025',
  goodsNm: '해외배송 물품',
  retVisitYmd: '20260604',       // production includes this
  printYn: 'Y',
};

function showPlaintext(label, params) {
  const pt = buildEpostParams(params, 'api.InsertOrder.jparcel');
  const bytes = Buffer.from(pt, 'utf8');
  console.log(`\n=== ${label} ===`);
  console.log(`Total bytes: ${bytes.length} (${Math.ceil(bytes.length/16)} blocks)`);
  
  // Find recZip position
  const recZipIdx = pt.indexOf('recZip=');
  if (recZipIdx >= 0) {
    const bytePos = Buffer.from(pt.slice(0, recZipIdx + 7), 'utf8').length;
    const block = Math.floor((bytePos - 7) / 16);
    console.log(`recZip value starts at byte ${bytePos}, block ${Math.floor(bytePos/16)}`);
    console.log(`recZip value: "${pt.slice(recZipIdx+7, recZipIdx+12)}"`);
  } else {
    console.log('recZip NOT FOUND in plaintext!');
  }
  
  // Show field order and byte offsets
  let offset = 0;
  for (const seg of pt.split('&')) {
    const eqPos = seg.indexOf('=');
    const key = seg.slice(0, eqPos);
    const val = seg.slice(eqPos + 1);
    const segBytes = Buffer.from(seg, 'utf8').length;
    if (['custNo','apprNo','officeSer','ordCompNm','ordNm','ordAddr1','ordAddr2','ordMob','recNm','recZip','recAddr1','recAddr2','recTel','contCd','goodsNm','retVisitYmd','printYn'].includes(key)) {
      const valBytes = Buffer.from(val, 'utf8').length;
      console.log(`  ${key.padEnd(12)} = ${JSON.stringify(val).slice(0,30).padEnd(35)} [byte ${String(offset).padStart(3)}–${String(offset+segBytes+(offset>0?1:0)-1).padStart(3)}, valBytes=${valBytes}]`);
    }
    offset += segBytes + (offset > 0 ? 1 : 0);  // +1 for '&'
    if (offset > pt.length) offset = pt.length;
  }
}

showPlaintext('live-specs.mjs MICRO (WORKS)', paramsA);
showPlaintext('실제 사용자 요청 (ERR-311)', paramsB);

// Difference analysis
const ptA = buildEpostParams(paramsA, 'api.InsertOrder.jparcel');
const ptB = buildEpostParams(paramsB, 'api.InsertOrder.jparcel');
const bufA = Buffer.from(ptA, 'utf8');
const bufB = Buffer.from(ptB, 'utf8');

console.log('\n=== 차이 분석 ===');
console.log(`A bytes: ${bufA.length}, B bytes: ${bufB.length}, diff: ${bufB.length - bufA.length}`);

// Check where recZip falls in blocks for each scenario
const recZipA = ptA.indexOf('recZip=');
const recZipB = ptB.indexOf('recZip=');
const recZipByteA = Buffer.from(ptA.slice(0, recZipA + 7), 'utf8').length;
const recZipByteB = Buffer.from(ptB.slice(0, recZipB + 7), 'utf8').length;
console.log(`A recZip value block: ${Math.floor(recZipByteA/16)}, B recZip value block: ${Math.floor(recZipByteB/16)}`);
