import { readFileSync } from 'fs';
import { buildEpostParams } from '../lib/epost/seed128.ts';
import { insertOrder } from '../lib/epost/client.ts';
import { buildReturnPickupOrderParams } from '../lib/epost/pickup-order.ts';
import { getDefaultEpostRetVisitYmd } from '../lib/epost/pickup-date.ts';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const phone = '01027239490';
const params = buildReturnPickupOrderParams({
  custNo: process.env.EPOST_CUSTOMER_ID.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO.trim(),
  officeSer: '260537802',
  orderNo: `SPB${Date.now()}`.slice(0, 20),
  center: {
    ordNm: '인프론트',
    zip: '41142',
    addr1: process.env.INFRONT_CENTER_ADDR1,
    addr2: '',
    phone,
  },
  pickup: {
    name: '홍길동',
    zip: '41100',
    addr1: '대구 동구 안심로 188', // prod log — 축약 도로명
    addr2: '3층',
    phone,
  },
  goodsNm: '해외배송 물품',
  weight: 2,
  volume: 60,
  retVisitYmd: getDefaultEpostRetVisitYmd(),
  testYn: 'N',
});

const withMob = { ...params, recMob: phone };
console.log('plainLen current (no recMob):', buildEpostParams(params).length);
console.log('plainLen WITH recMob (prod-like):', buildEpostParams(withMob).length);

try {
  const r = await insertOrder(params);
  console.log('LIVE OK regiNo=', r.regiNo);
} catch (e) {
  console.log('LIVE FAIL', e instanceof Error ? e.message.split('\n')[0] : e);
}
