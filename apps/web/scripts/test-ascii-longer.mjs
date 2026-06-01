/**
 * ASCII 전체 + recAddr2를 길게 해서 기본 동작 확인
 * 그리고 recAddr2 길이가 문제인지 확인
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
const { insertOrder, cancelOrder, normalizeEpostPhone } = await import('../lib/epost/client.ts');
const custNo = process.env.EPOST_CUSTOMER_ID?.trim() ?? '';
const apprNo = process.env.EPOST_APPROVAL_NO?.trim() ?? '';
const p = normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE);

const tests = [
  { label: '3F (2char)', recAddr2: '3F' },
  { label: '3rd Floor (9char)', recAddr2: '3rd Floor' },
  { label: '3F Room (6char)', recAddr2: '3F Room' },
];

for (const t of tests) {
  const params = {
    custNo, apprNo,
    payType: '2', reqType: '2',
    officeSer: '260537802',
    ordCompNm: 'Infront',
    ordNm: 'Infront',
    inqTelCn: p,
    ordZip: '41142',
    ordAddr1: '1 Dongchon-ro',
    ordAddr2: 'Eomul',
    ordMob: p,
    recNm: 'HongGilDong',
    recZip: '41100',
    recAddr1: '188 Ansim-ro Dong-gu',
    recAddr2: t.recAddr2,
    recTel: p,
    contCd: '025',
    goodsNm: 'TestGoods',
    weight: 2, volume: 15000, microYn: 'N',
    retVisitYmd: '20260604',
    printYn: 'Y',
    orderNo: `AT${Date.now()}`,
    testYn: 'Y',
  };

  try {
    const r = await insertOrder(params);
    console.log(`[${t.label}] ✅ 성공! regiNo=${r.regiNo}`);
    await cancelOrder({
      custNo, apprNo, reqType: '2', payType: '2',
      reqNo: r.reqNo, resNo: r.resNo ?? '', regiNo: r.regiNo,
      reqYmd: new Date().toISOString().slice(0,10).replace(/-/g,''),
      delYn: 'Y',
    }).catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const m = msg.match(/ERR-\d+[^.]*\./)?.[0] ?? msg.slice(0,100);
    console.log(`[${t.label}] ❌ ${m}`);
  }
}
