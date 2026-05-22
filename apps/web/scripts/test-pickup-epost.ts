/**
 * 우체국 수거 InsertOrder 다박스·규격 검증 스크립트
 * Usage: npx tsx --env-file=.env.local scripts/test-pickup-epost.ts [--live]
 *   --live  testYn=N 실접수 후 즉시 cancelOrder (운송장 실발급)
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  resolvePickupBoxList,
  pickupBoxSummary,
  PICKUP_BOX_SIZES,
  type PickupBoxSizeCode,
} from '../lib/epost/pickup-boxes';
import { insertOrder, cancelOrder, normalizeEpostPhone, formatEpostOrderNo } from '../lib/epost/client';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i <= 0) continue;
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch {
    console.warn('⚠ .env.local 없음 — 환경변수가 이미 설정되어 있어야 합니다.');
  }
}

loadEnv();

const LIVE = process.argv.includes('--live');
const OFFICE_SER = '260537802';

function centerConfig() {
  return {
    name: process.env.INFRONT_CENTER_NAME ?? '인프론트',
    ordNm: process.env.INFRONT_CENTER_ORD_NM ?? '인프론트',
    zip: (process.env.INFRONT_CENTER_ZIPCODE ?? '').replace(/\D/g, ''),
    addr1: process.env.INFRONT_CENTER_ADDR1 ?? '',
    addr2: process.env.INFRONT_CENTER_ADDR2?.trim() || '없음',
    phone: normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE),
  };
}

/** 테스트용 수거지 (실접수 시에도 취소 예정) */
const PICKUP = {
  recNm: '홍길동',
  recZip: '41142',
  recAddr1: '대구광역시 동구 동촌로 1',
  recAddr2: '상세주소 101호',
  recTel: '01012345678',
};

type Created = {
  orderNo: string;
  spec: string;
  regiNo: string;
  reqNo: string;
  resNo: string;
  price: string;
};

async function submitBox(
  boxSeq: number,
  total: number,
  sizeCode: PickupBoxSizeCode,
  testYn: 'Y' | 'N',
): Promise<Created> {
  const [spec] = resolvePickupBoxList({ box_count: 1, box_size: sizeCode });
  const center = centerConfig();
  if (!center.phone) throw new Error('INFRONT_CENTER_PHONE 미설정');

  const params = {
    custNo: (process.env.EPOST_CUSTOMER_ID ?? '').trim(),
    apprNo: (process.env.EPOST_APPROVAL_NO ?? '').trim(),
    payType: '2' as const,
    reqType: '2' as const,
    officeSer: OFFICE_SER,
    orderNo: formatEpostOrderNo('SPB', boxSeq),
    ordCompNm: center.ordNm,
    ordNm: center.ordNm,
    ordZip: center.zip,
    ordAddr1: center.addr1,
    ordAddr2: center.addr2,
    ordMob: center.phone,
    recNm: PICKUP.recNm,
    recZip: PICKUP.recZip,
    recAddr1: PICKUP.recAddr1,
    recAddr2: PICKUP.recAddr2,
    recTel: PICKUP.recTel,
    recMob: PICKUP.recTel,
    contCd: '025',
    goodsNm: total > 1 ? `PICKUP${boxSeq}of${total}` : 'PICKUP',
    weight: spec.weight,
    volume: spec.volume,
    microYn: spec.microYn,
    testYn,
    printYn: 'Y' as const,
    inqTelCn: PICKUP.recTel,
  };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    params.orderNo = formatEpostOrderNo('SPB', boxSeq);
    try {
      const result = await insertOrder(params);
      return {
        orderNo: params.orderNo,
        spec: pickupBoxSummary(spec),
        regiNo: result.regiNo,
        reqNo: result.reqNo,
        resNo: result.resNo ?? '',
        price: result.price,
      };
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

async function cancelCreated(items: Created[]) {
  const custNo = (process.env.EPOST_CUSTOMER_ID ?? '').trim();
  const apprNo = (process.env.EPOST_APPROVAL_NO ?? '').trim();
  const reqYmd = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  for (const item of items) {
    if (item.reqNo.startsWith('MOCK-')) continue;
    try {
      await cancelOrder({
        custNo,
        apprNo,
        reqType: '2',
        payType: '2',
        reqNo: item.reqNo,
        resNo: item.resNo,
        regiNo: item.regiNo,
        reqYmd,
        delYn: 'Y',
      });
      console.log(`  ✓ 취소 완료: ${item.regiNo}`);
    } catch (e) {
      console.error(`  ✗ 취소 실패 ${item.regiNo}:`, e instanceof Error ? e.message : e);
    }
  }
}

function assertRegiNo(regiNo: string, label: string) {
  if (!regiNo || regiNo.length < 10) throw new Error(`${label}: regiNo 없음 (${regiNo})`);
  if (regiNo.startsWith('MOCK-') || regiNo.startsWith('700000000000')) {
    throw new Error(`${label}: MOCK 운송장 — 실 API 미호출 (${regiNo})`);
  }
}

async function runScenario(
  name: string,
  boxes: PickupBoxSizeCode[],
  testYn: 'Y' | 'N',
): Promise<Created[]> {
  console.log(`\n▶ ${name} (testYn=${testYn}, ${boxes.length}박스)`);
  const specs = resolvePickupBoxList({ boxes: boxes.map((size_code) => ({ size_code })) });
  specs.forEach((s, i) => console.log(`  박스${i + 1}: ${pickupBoxSummary(s)}`));

  const created: Created[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const c = await submitBox(i + 1, boxes.length, boxes[i], testYn);
    console.log(`  ✓ 박스${i + 1} regiNo=${c.regiNo} price=${c.price}원`);
    if (testYn === 'N' || LIVE) assertRegiNo(c.regiNo, `박스${i + 1}`);
    created.push(c);
    if (i < boxes.length - 1) await new Promise((r) => setTimeout(r, 500));
  }

  const regiNos = created.map((c) => c.regiNo);
  if (new Set(regiNos).size !== regiNos.length) {
    throw new Error('운송장번호 중복 — 박스마다 별도 regiNo 필요');
  }
  return created;
}

async function main() {
  console.log('=== 우체국 수거 API 검증 ===');
  console.log(`모드: ${LIVE ? 'LIVE (실접수→취소)' : 'TEST API (testYn=Y)'}`);
  const center = centerConfig();
  console.log(`센터 연락처: ${center.phone ? `${center.phone.length}자리` : '없음'}`);

  const required = ['EPOST_API_KEY', 'EPOST_SECURITY_KEY', 'EPOST_CUSTOMER_ID', 'EPOST_APPROVAL_NO', 'INFRONT_CENTER_ZIPCODE', 'INFRONT_CENTER_ADDR1', 'INFRONT_CENTER_PHONE'];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error('필수 환경변수 누락:', missing.join(', '));
    process.exit(1);
  }

  // 1) resolvePickupBoxList 단위 검증
  const list3 = resolvePickupBoxList({ box_count: 3, box_size: 'SMALL' });
  if (list3.length !== 3 || list3[0].weight !== 2) throw new Error('resolvePickupBoxList box_count 실패');

  const mixed = resolvePickupBoxList({
    boxes: [{ size_code: 'MICRO' }, { size_code: 'MEDIUM' }],
  });
  if (mixed[0].microYn !== 'N' || mixed[1].weight !== 2) throw new Error('resolvePickupBoxList boxes 실패');
  console.log('✓ resolvePickupBoxList OK');

  const testYn: 'Y' | 'N' = LIVE ? 'N' : 'Y';
  const allCreated: Created[] = [];

  try {
    allCreated.push(...(await runScenario('단일 극소(MICRO)', ['MICRO'], testYn)));
    allCreated.push(...(await runScenario('2박스 동일(MICRO×2)', ['MICRO', 'MICRO'], testYn)));
    allCreated.push(...(await runScenario('2박스 혼합(MICRO+SMALL)', ['MICRO', 'SMALL'], testYn)));

    console.log('\n=== 결과 요약 ===');
    console.log(`총 ${allCreated.length}건 운송장 발급`);
    allCreated.forEach((c, i) => console.log(`  ${i + 1}. ${c.regiNo} (${c.spec})`));

    if (LIVE) {
      console.log('\n▶ 실접수 취소 중...');
      await cancelCreated(allCreated);
    } else {
      console.log('\n💡 실운송장 검증: npx tsx --env-file=.env.local scripts/test-pickup-epost.ts --live');
    }

    console.log('\n✅ 모든 시나리오 통과');
  } catch (e) {
    console.error('\n❌ 실패:', e instanceof Error ? e.message : e);
    if (LIVE && allCreated.length) {
      console.log('▶ 부분 취소 시도...');
      await cancelCreated(allCreated);
    }
    process.exit(1);
  }
}

main();
