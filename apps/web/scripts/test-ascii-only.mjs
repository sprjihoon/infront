/**
 * 한글 없이 순수 ASCII 파라미터로 epost 테스트
 * 성공 시: SEED128 자체는 OK, 한글 인코딩이 문제
 * 실패 시: 다른 원인 (contCd, 인증 등)
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
const centerPhone = normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE);

// 완전히 ASCII만 사용 (한글 없음)
const params = {
  custNo,
  apprNo,
  payType: '2',
  reqType: '2',
  officeSer: '260537802',
  ordCompNm: 'Infront',       // ASCII only
  ordNm: 'Infront',           // ASCII only
  inqTelCn: centerPhone,
  ordZip: '41142',
  ordAddr1: '1 Dongchon-ro',  // ASCII only
  ordAddr2: 'Eomul',          // ASCII only (없음 대신)
  ordMob: centerPhone,
  recNm: 'HongGilDong',       // ASCII only
  recZip: '41100',
  recAddr1: '188 Ansim-ro',   // ASCII only
  recAddr2: '3F',             // ASCII only
  recTel: centerPhone,
  contCd: '025',
  goodsNm: 'TestGoods',       // ASCII only
  weight: 2,
  volume: 15000,
  microYn: 'N',
  retVisitYmd: '20260604',
  printYn: 'Y',
  orderNo: `TESTA${Date.now()}`,
  testYn: 'Y',
};

console.log('=== 순수 ASCII 파라미터 테스트 (testYn=Y) ===');
console.log('recZip:', params.recZip, '| recAddr1:', params.recAddr1);

try {
  console.log('\nepost 호출 중...');
  const result = await insertOrder(params);
  console.log('✅ 성공!', result);
  console.log('\n→ ASCII만 사용하면 성공 = 한글 UTF-8 인코딩이 문제');
  
  // 바로 취소
  try {
    await cancelOrder({
      custNo, apprNo,
      reqType: '2', payType: '2',
      reqNo: result.reqNo, resNo: result.resNo ?? '',
      regiNo: result.regiNo,
      reqYmd: new Date().toISOString().slice(0,10).replace(/-/g,''),
      delYn: 'Y',
    });
    console.log('취소 완료');
  } catch (ce) {
    console.warn('취소 실패 (수동 취소 필요):', result.regiNo);
  }
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.log('❌ 실패:', msg.slice(0, 200));
  
  if (msg.includes('ERR-311')) {
    console.log('\n→ ASCII로도 ERR-311 → contCd, officeSer 등 다른 필드가 문제');
  } else if (msg.includes('ERR-')) {
    console.log('\n→ 다른 epost 에러 코드:', msg.match(/ERR-\d+/)?.[0]);
  } else {
    console.log('\n→ 네트워크 또는 인증 문제');
  }
}
