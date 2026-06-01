import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

import { buildReturnPickupOrderParams } from '../lib/epost/pickup-order.ts';
import { buildEpostParams } from '../lib/epost/seed128.ts';
import { resolveInfrontCenterFromEnv } from '../lib/epost/center-config.ts';

const center = resolveInfrontCenterFromEnv();
console.log('Center from env:', JSON.stringify(center, null, 2));

const params = buildReturnPickupOrderParams({
  custNo: process.env.EPOST_CUSTOMER_ID.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO.trim(),
  officeSer: '260537802',
  orderNo: 'DBG-TEST-001',
  center,
  pickup: {
    name: '홍길동',
    zip: '41100',
    addr1: '대구광역시 동구 범심로 188',
    addr2: '201호',
    phone: '01012345678',
  },
  goodsNm: '수거테스트',
  weight: 2,
  volume: 60,
  retVisitYmd: '2026-06-02',
  testYn: 'Y',
});

const plain = buildEpostParams(params);
console.log('\nFULL PLAINTEXT:');
console.log(plain);
console.log('\nField byte lengths:');
for (const pair of plain.split('&')) {
  const i = pair.indexOf('=');
  if (i > 0) {
    const k = pair.slice(0, i);
    const v = pair.slice(i + 1);
    const vBytes = Buffer.byteLength(v, 'utf8');
    const vLen = v.length;
    if (vBytes !== vLen) {
      console.log(`  ${k}: "${v}" → ${vLen} chars, ${vBytes} UTF-8 bytes`);
    } else {
      console.log(`  ${k}: "${v}" → ${vBytes} bytes`);
    }
  }
}
