import { readFileSync } from 'fs';
import { insertOrder, cancelOrder, normalizeEpostPhone } from '../lib/epost/client.ts';

const raw = readFileSync('.env.local', 'utf8');
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const phone = normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE);
const LIVE = process.argv.includes('--live');
const testYn = LIVE ? 'N' : 'Y';
const codes = ['011', '021', '025', '031', '003', '001'];

// reqType=2 방문반품 — modo shipments-book 동일
// ord* = 센터, rec* = 고객(반품인, 수거지)
const base = {
  custNo: process.env.EPOST_CUSTOMER_ID.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO.trim(),
  payType: '2',
  reqType: '2',
  officeSer: '260537802',
  weight: 2,
  volume: 60,
  microYn: 'N',
  ordCompNm: (process.env.INFRONT_CENTER_ORD_NM ?? '인프론트').trim(),
  ordNm:     (process.env.INFRONT_CENTER_ORD_NM ?? '인프론트').trim(),
  ordZip:    process.env.INFRONT_CENTER_ZIPCODE.replace(/\D/g, ''),
  ordAddr1:  process.env.INFRONT_CENTER_ADDR1,
  ordAddr2:  process.env.INFRONT_CENTER_ADDR2?.trim() || '없음',
  ordMob:    phone,
  recNm:    '홍길동',
  recZip:   '41100',
  recAddr1: '대구광역시 동구 범심로 188',
  recAddr2: '201호',
  recTel:   '01012345678',
  goodsNm: '수거테스트',
  printYn: 'Y',
  inqTelCn: '01012345678',
  testYn,
};

const ok = [];
for (const contCd of codes) {
  process.stdout.write(`contCd=${contCd} ... `);
  try {
    const r = await insertOrder({ ...base, contCd, orderNo: `DBG-${Date.now()}-${contCd}` });
    console.log(`OK regiNo=${r.regiNo}`);
    ok.push(r);
    break;
  } catch (e) {
    console.log(e instanceof Error ? e.message.split(':').slice(0, 2).join(':') : e);
  }
}

if (LIVE && ok.length) {
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
