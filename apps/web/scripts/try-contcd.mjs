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

// reqType=2 방문반품 (인프론트 계약 기준 — regiNo 발급 확인된 매핑)
// ord* = 고객(수거지), rec* = 물류센터(수취처)
const base = {
  custNo: process.env.EPOST_CUSTOMER_ID.trim(),
  apprNo: process.env.EPOST_APPROVAL_NO.trim(),
  payType: '2',
  reqType: '2',
  officeSer: '260537802',
  weight: 2,
  volume: 60,
  microYn: 'N',
  // ord* = 고객 (수거 요청자, 반품인)
  ordCompNm: '홍길동',
  ordNm:     '홍길동',
  ordZip:    '41100',
  ordAddr1:  '대구광역시 동구 범심로 188',
  ordAddr2:  '201호',
  ordMob:    '01012345678',
  // rec* = 물류센터 (우체국 계약 등록 수취처)
  recNm:    (process.env.INFRONT_CENTER_ORD_NM ?? '인프론트').trim(),
  recZip:   process.env.INFRONT_CENTER_ZIPCODE.replace(/\D/g, ''),
  recAddr1: process.env.INFRONT_CENTER_ADDR1,
  recAddr2: '없음',
  recTel:   phone,
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
