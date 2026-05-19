import { NextRequest, NextResponse } from 'next/server';
import { getShippingQuote, type QuoteParams, EmsApiError } from '@/lib/ems/client';

function isMock() {
  return (process.env.EMS_MOCK ?? '').trim().toLowerCase() === 'true';
}

/** 지역 구분별 EMS 기본 요금 계산 (Mock용) */
function mockFee(premiumcd: string, countrycd: string, totweight: number): number {
  const z1 = ['JP','CN','TW','HK','MO'];
  const z2 = ['US','CA','AU','NZ','SG','TH','VN','MY','PH','GB','DE','FR'];
  const isZ1 = z1.includes(countrycd);
  const isZ2 = z2.includes(countrycd);

  if (premiumcd === '14') {
    // K-Packet
    return Math.round(5000 + Math.max(0, totweight - 300) / 100 * 1000);
  }
  const base  = isZ1 ? 14000 : isZ2 ? 22000 : 28000;
  const per500 = isZ1 ? 3500 : isZ2 ? 5500 : 7500;
  const steps  = Math.ceil(Math.max(0, totweight - 500) / 500);
  const fee    = base + steps * per500;
  return premiumcd === '32' ? Math.round(fee * 1.15) : fee; // EMS프리미엄 15% 할증
}

/**
 * POST /api/ems/quote
 * EMS / K-Packet 배송비 예상 견적 조회
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<QuoteParams>;
    const required: (keyof QuoteParams)[] = ['premiumcd', 'em_ee', 'countrycd', 'totweight'];
    const missing = required.filter(k => !body[k]);
    if (missing.length) {
      return NextResponse.json({ error: `필수 항목 누락: ${missing.join(', ')}` }, { status: 400 });
    }

    const p = body as QuoteParams;
    if (isMock()) {
      return NextResponse.json({ totalFee: mockFee(p.premiumcd, p.countrycd, p.totweight), mock: true });
    }

    const result = await getShippingQuote(p);
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof EmsApiError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[EMS Quote POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET /api/ems/quote?premiumcd=31&em_ee=em&countrycd=JP&totweight=1000 */
export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const premiumcd = s.get('premiumcd') ?? '';
    const em_ee     = s.get('em_ee')     ?? '';
    const countrycd = s.get('countrycd') ?? '';
    const totweight = parseInt(s.get('totweight') ?? '0', 10);

    if (!premiumcd || !em_ee || !countrycd || !totweight) {
      return NextResponse.json({ error: '필수 파라미터: premiumcd, em_ee, countrycd, totweight' }, { status: 400 });
    }

    if (isMock()) {
      return NextResponse.json({ totalFee: mockFee(premiumcd, countrycd, totweight), mock: true });
    }

    const params: QuoteParams = {
      premiumcd, em_ee, countrycd, totweight,
      boxlength: s.get('boxlength') ? parseFloat(s.get('boxlength')!) : undefined,
      boxwidth:  s.get('boxwidth')  ? parseFloat(s.get('boxwidth')!)  : undefined,
      boxheight: s.get('boxheight') ? parseFloat(s.get('boxheight')!) : undefined,
    };
    const result = await getShippingQuote(params);
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof EmsApiError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[EMS Quote GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
