import { readFileSync, writeFileSync } from 'fs';
import { buildEpostParams } from '../lib/epost/seed128.ts';
import { insertOrder, cancelOrder, normalizeEpostPhone } from '../lib/epost/client.ts';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const phone = normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE);
const base = {
  custNo: process.env.EPOST_CUSTOMER_ID.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO.trim(),
  payType: '2',
  reqType: '2',
  officeSer: '260537802',
  ordCompNm: '인프론트',
  ordNm: '인프론트',
  ordZip: process.env.INFRONT_CENTER_ZIPCODE.replace(/\D/g, ''),
  ordAddr1: process.env.INFRONT_CENTER_ADDR1,
  ordAddr2: process.env.INFRONT_CENTER_ADDR2 || '없음',
  ordMob: phone,
  recNm: '홍길동',
  recZip: '41142',
  recAddr1: '대구광역시 동구 동촌로 1',
  recAddr2: '상세주소 101호',
  recTel: '01012345678',
  recMob: '01012345678',
  contCd: '025',
  goodsNm: '수거테스트',
  printYn: 'Y',
  inqTelCn: '01012345678',
  testYn: 'N',
};

const tries = [{ n: 'SMALL', weight: 5, volume: 80, microYn: 'N' }];

const ok = [];
for (const t of tries) {
  const { n, ...spec } = t;
  process.stdout.write(`${n} ... `);
  try {
    const payload = { ...base, ...spec, orderNo: `LIVE${Date.now()}${n.replace(/\W/g, '')}` };
    writeFileSync('scripts/last-plain.txt', buildEpostParams(payload), 'utf8');
    const r = await insertOrder({ ...payload, testYn: 'Y' });
    console.log(`OK regiNo=${r.regiNo} price=${r.price}`);
    ok.push(r);
  } catch (e) {
    console.log('FAIL', e instanceof Error ? e.message : e);
  }
}

if (ok.length) {
  const reqYmd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (const r of ok) {
    await cancelOrder({
      custNo: base.custNo,
      apprNo: base.apprNo,
      reqType: '2',
      payType: '2',
      reqNo: r.reqNo,
      resNo: r.resNo ?? '',
      regiNo: r.regiNo,
      reqYmd,
      delYn: 'Y',
    });
    console.log('cancelled', r.regiNo);
  }
}
