import { NextRequest, NextResponse } from 'next/server';
import { getShippingQuote, type QuoteParams, EmsApiError } from '@/lib/ems/client';

/**
 * POST /api/ems/quote
 * EMS / K-Packet 배송비 예상 견적 조회
 *
 * Body:
 *   premiumcd  string  31=EMS / 32=EMS프리미엄 / 14=K-Packet
 *   em_ee      string  em=비서류 / ee=서류 / rl=K-Packet
 *   countrycd  string  국가코드 (JP, US, CN ...)
 *   totweight  number  총중량(g)
 *   boxlength? number  가로(cm)
 *   boxwidth?  number  세로(cm)
 *   boxheight? number  높이(cm)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<QuoteParams>;

    const required: (keyof QuoteParams)[] = ['premiumcd', 'em_ee', 'countrycd', 'totweight'];
    const missing = required.filter(k => !body[k]);
    if (missing.length) {
      return NextResponse.json(
        { error: `필수 항목 누락: ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    const result = await getShippingQuote(body as QuoteParams);
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
    const params: QuoteParams = {
      premiumcd: s.get('premiumcd') ?? '',
      em_ee:     s.get('em_ee')     ?? '',
      countrycd: s.get('countrycd') ?? '',
      totweight: parseInt(s.get('totweight') ?? '0', 10),
      boxlength: s.get('boxlength') ? parseFloat(s.get('boxlength')!) : undefined,
      boxwidth:  s.get('boxwidth')  ? parseFloat(s.get('boxwidth')!)  : undefined,
      boxheight: s.get('boxheight') ? parseFloat(s.get('boxheight')!) : undefined,
    };

    const missing = (['premiumcd','em_ee','countrycd'] as (keyof QuoteParams)[])
      .filter(k => !params[k]);
    if (missing.length || !params.totweight) {
      return NextResponse.json({ error: `필수 파라미터: premiumcd, em_ee, countrycd, totweight` }, { status: 400 });
    }

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
