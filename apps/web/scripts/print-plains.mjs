/**
 * 평문 직접 출력 — 실패 케이스 vs 성공 케이스
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

import { buildEpostParams } from '../lib/epost/seed128.ts';
import { normalizeEpostZip, normalizeEpostAddr1, normalizeEpostPickupAddr2, requireEpostPhone, resolveEpostCenterAddr2, splitPickupAddressForEpost, truncateUtf8Bytes, sanitizeEpostPlainField } from '../lib/epost/client.ts';

const custNo = process.env.EPOST_CUSTOMER_ID.trim();
const apprNo = process.env.EPOST_APPROVAL_NO.trim();
const centerPhone = process.env.INFRONT_CENTER_PHONE?.trim() || '01027239490';
const normalizedCenterPhone = centerPhone.replace(/\D/g, '');
const centerAddr2Full = process.env.INFRONT_CENTER_ADDR2?.trim() || '동대구우체국 2층 소포실';

function buildPlain(opts) {
  const { ordAddr2, recZip, recAddr1, recAddr2, recTel, goodsNm, retVisitYmd } = opts;
  const params = {
    custNo, apprNo,
    payType: '2', reqType: '2',
    officeSer: '260537802',
    weight: 2, volume: 60, microYn: 'N',
    orderNo: 'SPB00000000000001',
    ordCompNm: '인프론트',
    inqTelCn: recTel,
    ordNm: '인프론트',
    ordZip: '41142',
    ordAddr1: '대구광역시 동구 동촌로 1',
    ordAddr2,
    ordMob: normalizedCenterPhone,
    recNm: '홍길동',
    recZip,
    recAddr1,
    recAddr2,
    recTel,
    contCd: '025',
    goodsNm,
    printYn: 'Y',
  };
  if (retVisitYmd) params.retVisitYmd = retVisitYmd;
  return buildEpostParams(params, 'api.InsertOrder.jparcel');
}

function analyze(label, plain) {
  const fields = {};
  for (const pair of plain.split('&')) {
    const idx = pair.indexOf('=');
    if (idx > 0) fields[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
  
  // Compute byte offsets
  const enc = new TextEncoder();
  const bytes = enc.encode(plain);
  let offset = 0;
  const offsets = {};
  for (const pair of plain.split('&')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const key = pair.slice(0, idx);
      const valBytes = enc.encode(pair.slice(idx + 1)).length;
      const keyBytes = enc.encode(pair.slice(0, idx + 1)).length; // key=
      offsets[key] = { start: offset + keyBytes, end: offset + keyBytes + valBytes, block: Math.floor((offset + keyBytes) / 16) };
      offset += enc.encode(pair).length + 1; // +1 for &
    }
  }
  
  console.log(`\n=== ${label} ===`);
  console.log(`Total bytes: ${bytes.length}, blocks: ${Math.ceil(bytes.length / 16)}`);
  console.log(`ordAddr2 = "${fields.ordAddr2}" (${enc.encode(fields.ordAddr2 || '').length}b)`);
  console.log(`recZip   = "${fields.recZip}" @ byte ${offsets.recZip?.start}-${offsets.recZip?.end} (block ${offsets.recZip?.block})`);
  console.log(`recAddr1 = "${fields.recAddr1}"`);
  console.log(`recAddr2 = "${fields.recAddr2}"`);
  console.log(`recTel   = "${fields.recTel}"`);
  console.log(`goodsNm  = "${fields.goodsNm}"`);
  console.log(`retVisitYmd = "${fields.retVisitYmd ?? '(없음)'}"`);
  console.log(`\nFull plaintext:\n${plain}`);
}

// Case A: PRODUCTION (failing) — ordAddr2='없음', user rec*
const userRecTel = requireEpostPhone('01027239490', 'test');
const userPlain = buildPlain({
  ordAddr2: '없음',
  recZip: normalizeEpostZip('41100'),
  recAddr1: normalizeEpostAddr1('대구광역시 동구 안심로 188'),
  recAddr2: normalizeEpostPickupAddr2('제3층'),
  recTel: userRecTel,
  goodsNm: '해외배송 물품',
  retVisitYmd: '20260604',
});
analyze('PRODUCTION (실패) — ordAddr2=없음, 사용자 rec*', userPlain);

// Case B: WORKING — ordAddr2='동대구우체국 2층 소포실', CENTER rec*
const workingPlain = buildPlain({
  ordAddr2: centerAddr2Full,
  recZip: '41142',
  recAddr1: '대구광역시 동구 동촌로 1',
  recAddr2: '상세주소 101호',
  recTel: userRecTel,
  goodsNm: '수거테스트',
  retVisitYmd: undefined,
});
analyze('WORKING — ordAddr2=full, CENTER rec*', workingPlain);

// Case C: Mixed — ordAddr2='동대구우체국 2층 소포실', user rec* (T2 in earlier test was close)
const mixedPlain = buildPlain({
  ordAddr2: centerAddr2Full,
  recZip: normalizeEpostZip('41100'),
  recAddr1: normalizeEpostAddr1('대구광역시 동구 안심로 188'),
  recAddr2: normalizeEpostPickupAddr2('제3층'),
  recTel: userRecTel,
  goodsNm: '해외배송 물품',
  retVisitYmd: '20260604',
});
analyze('MIXED — ordAddr2=full, 사용자 rec*', mixedPlain);
