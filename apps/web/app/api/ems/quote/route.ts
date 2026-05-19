import { NextRequest, NextResponse } from 'next/server';
import { getShippingQuote, type QuoteParams, EmsApiError } from '@/lib/ems/client';

// ─── 가견적 단가표 (우체국 EMS API가 해외 IP에서 차단되는 경우 폴백용) ───────
// 국내 서버(KR 리전)에 프록시 구축 후 EMS_MOCK=false 로 실제 API로 전환
const FORCE_MOCK = true; // 현재 Vercel(US) → 한국 EMS API 직접 연결 불가

function mockFee(premiumcd: string, countrycd: string, totweight: number): number {
  const z1 = ['JP', 'CN', 'TW', 'HK', 'MO'];
  const z2 = ['US', 'CA', 'AU', 'NZ', 'SG', 'TH', 'VN', 'MY', 'PH', 'GB', 'DE', 'FR', 'NL', 'IT', 'ES'];
  const isZ1 = z1.includes(countrycd);
  const isZ2 = z2.includes(countrycd);

  if (premiumcd === '14') {
    // K-Packet (최대 2kg): 300g 기준 5,000원, 100g당 1,000원 추가
    return Math.round(5000 + Math.max(0, totweight - 300) / 100 * 1000);
  }
  // EMS / EMS 프리미엄
  const base   = isZ1 ? 14000 : isZ2 ? 22000 : 28000;
  const per500 = isZ1 ? 3500  : isZ2 ? 5500  : 7500;
  const steps  = Math.ceil(Math.max(0, totweight - 500) / 500);
  const base_fee = base + steps * per500;
  // EMS 프리미엄 15% 할증
  return premiumcd === '32' ? Math.round(base_fee * 1.15) : base_fee;
}

function isMockActive(): boolean {
  if (FORCE_MOCK) return true;
  const v = (process.env.EMS_MOCK ?? '').replace(/[\r\n\s]/g, '').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * POST /api/ems/quote
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
    if (isMockActive()) {
      return NextResponse.json({ totalFee: mockFee(p.premiumcd, p.countrycd, p.totweight), mock: true });
    }
    const result = await getShippingQuote(p);
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof EmsApiError) return NextResponse.json({ error: e.message }, { status: 400 });
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[EMS Quote POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/ems/quote?premiumcd=31&em_ee=em&countrycd=JP&totweight=1000
 */
export async function GET(req: NextRequest) {
  try {
    const s         = req.nextUrl.searchParams;
    const premiumcd = s.get('premiumcd') ?? '';
    const em_ee     = s.get('em_ee')     ?? '';
    const countrycd = s.get('countrycd') ?? '';
    const totweight = parseInt(s.get('totweight') ?? '0', 10);

    if (!premiumcd || !em_ee || !countrycd || !totweight) {
      return NextResponse.json({ error: '필수 파라미터: premiumcd, em_ee, countrycd, totweight' }, { status: 400 });
    }

    if (isMockActive()) {
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
    if (e instanceof EmsApiError) return NextResponse.json({ error: e.message }, { status: 400 });
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[EMS Quote GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
