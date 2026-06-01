import { readFileSync } from 'fs';
import { insertOrder, cancelOrder } from '../lib/epost/client.ts';
import { buildReturnPickupOrderParams } from '../lib/epost/pickup-order.ts';
import { getDefaultEpostRetVisitYmd } from '../lib/epost/pickup-date.ts';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const orderNo = `SPB${Date.now()}`;
const p = buildReturnPickupOrderParams({
  custNo: process.env.EPOST_CUSTOMER_ID.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO.trim(),
  officeSer: '260537802',
  orderNo,
  center: {
    ordNm: '인프론트',
    zip: '41142',
    addr1: process.env.INFRONT_CENTER_ADDR1,
    addr2: '',
    phone: process.env.INFRONT_CENTER_PHONE,
  },
  pickup: {
    name: '홍길동',
    zip: '41100',
    addr1: '대구광역시 동구 안심로 188',
    addr2: '제3층',
    phone: '01027239490',
  },
  goodsNm: '취소테스트',
  weight: 2,
  volume: 60,
  retVisitYmd: getDefaultEpostRetVisitYmd(),
  testYn: 'N',
});

const ins = await insertOrder(p);
console.log('INSERT', { regiNo: ins.regiNo, reqNo: ins.reqNo, resNo: ins.resNo, resDate: ins.resDate });

await new Promise((r) => setTimeout(r, 2000));

const reqYmd =
  (ins.resDate || '').replace(/\D/g, '').slice(0, 8) ||
  new Date().toISOString().slice(0, 10).replace(/-/g, '');

for (const delYn of ['Y', 'N']) {
  try {
    const c = await cancelOrder({
      custNo: process.env.EPOST_CUSTOMER_ID.trim(),
      apprNo: process.env.EPOST_APPROVAL_NO.trim(),
      reqType: '2',
      payType: '2',
      insertSnapshot: p,
      reqNo: ins.reqNo,
      resNo: ins.resNo,
      regiNo: ins.regiNo,
      reqYmd,
      delYn,
    });
    console.log(`CANCEL OK delYn=${delYn}`, c);
    process.exit(0);
  } catch (e) {
    console.log(`CANCEL FAIL delYn=${delYn}:`, e instanceof Error ? e.message : e);
  }
}
process.exit(1);
