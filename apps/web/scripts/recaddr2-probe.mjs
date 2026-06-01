import { readFileSync } from 'fs';
import { insertOrder } from '../lib/epost/client.ts';
import { buildReturnPickupOrderParams } from '../lib/epost/pickup-order.ts';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const phone = '01027239490';
const base = {
  custNo: process.env.EPOST_CUSTOMER_ID.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO.trim(),
  officeSer: '260537802',
  goodsNm: '해외배송 물품',
  weight: 2,
  volume: 60,
  testYn: 'N',
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
    addr1: '대구광역시 동구 안심로 188',
    phone,
  },
};

for (const addr2 of ['3층', '3층 ', '제3층', '188-3층', '201호', '3층 201호', '안심로188 3층']) {
  try {
    const params = buildReturnPickupOrderParams({
      ...base,
      orderNo: `R2${Date.now()}${Math.floor(Math.random() * 99)}`,
      pickup: { ...base.pickup, addr2 },
    });
    const r = await insertOrder(params);
    console.log(`OK [${addr2}] regiNo=${r.regiNo}`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.log(`FAIL [${addr2}]`, m.includes('ERR-') ? m.split('ERR-')[1].slice(0, 60) : m.slice(0, 60));
  }
}
