import { NextRequest, NextResponse } from 'next/server';
import { getShippingQuote, type QuoteParams, EmsApiError } from '@/lib/ems/client';

export const preferredRegion = 'icn1'; // 우체국 API 접근을 위해 서울 리전 고정

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
    const result = await getShippingQuote(body as QuoteParams);
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

    const boynParam = s.get('boyn');
    const boprcParam = s.get('boprc');

    const params: QuoteParams = {
      premiumcd, em_ee, countrycd, totweight,
      boxlength: s.get('boxlength') ? parseFloat(s.get('boxlength')!) : undefined,
      boxwidth:  s.get('boxwidth')  ? parseFloat(s.get('boxwidth')!)  : undefined,
      boxheight: s.get('boxheight') ? parseFloat(s.get('boxheight')!) : undefined,
      boyn: boynParam === 'Y' ? 'Y' : boynParam === 'N' ? 'N' : undefined,
      boprc: boprcParam ? parseInt(boprcParam, 10) : undefined,
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
