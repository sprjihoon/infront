import { readFileSync } from 'fs';
import { insertOrder } from '../lib/epost/client.ts';
import { buildReturnPickupOrderParams } from '../lib/epost/pickup-order.ts';
import { resolveInfrontCenterFromEnv } from '../lib/epost/center-config.ts';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const LIVE = process.argv.includes('--live');
const testYn = LIVE ? 'N' : 'Y';

const center = resolveInfrontCenterFromEnv();
console.log('center:', JSON.stringify(center));

const base = buildReturnPickupOrderParams({
  custNo: process.env.EPOST_CUSTOMER_ID.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO.trim(),
  officeSer: '260537802',
  orderNo: `DBG-${Date.now()}`,
  center,
  pickup: {
    name: '홍길동',
    zip: '41100',
    addr1: '대구광역시 동구 범심로 188',
    addr2: '201호',
    phone: process.env.INFRONT_CENTER_PHONE ?? '01027239490',
  },
  goodsNm: '수거테스트',
  weight: 2,
  volume: 60,
  retVisitYmd: '2026-06-02',
  testYn,
});

try {
  const r = await insertOrder({ ...base, orderNo: `DBG-${Date.now()}` });
  console.log('OK regiNo=', r.regiNo);
} catch (e) {
  console.log('FAIL', e instanceof Error ? e.message : e);
}
