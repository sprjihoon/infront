/**
 * SEED128 + epost testYn='Y' 호출로 암호화 동작 검증
 * run: npx tsx apps/web/scripts/test-epost-enc.mjs
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env.local 로드
for (const line of readFileSync(path.join(__dirname, '../.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i <= 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const { insertOrder, normalizeEpostZip, normalizeEpostAddr1, requireEpostPhone } = await import('../lib/epost/client.ts');

const custNo = process.env.EPOST_CUSTOMER_ID?.trim() ?? '';
const apprNo = process.env.EPOST_APPROVAL_NO?.trim() ?? '';
const centerZip = (process.env.INFRONT_CENTER_ZIPCODE ?? '41142').replace(/\D/g, '');
const centerAddr1 = normalizeEpostAddr1(process.env.INFRONT_CENTER_ADDR1 ?? '대구광역시 동구 동촌로 1');
const centerPhone = process.env.INFRONT_CENTER_PHONE?.replace(/\D/g, '') ?? '01000000000';

console.log('=== epost 암호화 테스트 (testYn=Y) ===');
console.log({ custNo, apprNo, centerZip, centerAddr1Short: centerAddr1.slice(0, 20), centerPhone });

const params = {
  custNo,
  apprNo,
  payType: '2',
  reqType: '2',
  officeSer: '260537802',
  ordCompNm: '인프론트',
  ordNm: '인프론트',
  inqTelCn: centerPhone,
  ordZip: centerZip,
  ordAddr1: centerAddr1,
  ordAddr2: '없음',  // 계약값
  ordMob: requireEpostPhone(centerPhone, '센터폰'),
  // 고객 수거지 (테스트용 - 실제 사용자 주소)
  recNm: '홍길동',
  recZip: '41100',
  recAddr1: '대구광역시 동구 안심로 188',
  recAddr2: '제3층',
  recTel: requireEpostPhone(centerPhone, '수거폰'),
  contCd: '025',
  goodsNm: '수거테스트',
  weight: 2,
  volume: 15000,
  microYn: 'N',
  retVisitYmd: '20260604',
  printYn: 'Y',
  orderNo: `TEST${Date.now()}`,
  testYn: 'Y',  // epost 테스트 모드
};

console.log('\n파라미터:', {
  recZip: params.recZip,
  recAddr1: params.recAddr1,
  recAddr2: params.recAddr2,
  orderNo: params.orderNo,
});

try {
  console.log('\nepost 호출 중 (testYn=Y)...');
  const result = await insertOrder(params);
  console.log('✅ 성공!', result);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.log('❌ 실패:', msg);
  if (msg.includes('ERR-311')) {
    console.log('→ ERR-311: recZip 관련 문제. SEED128 암호화 또는 필드값 문제.');
  } else if (msg.includes('ERR-') || msg.includes('EPost')) {
    console.log('→ epost가 응답함 (암호화는 OK, 다른 검증 오류)');
  } else {
    console.log('→ 네트워크 또는 암호화 자체 문제');
  }
}
