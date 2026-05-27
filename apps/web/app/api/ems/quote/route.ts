import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getShippingQuote, type QuoteParams, EmsApiError } from '@/lib/ems/client';
import { usdToBoprcKrw } from '@/lib/ems/insurance';
import {
  getEmsUsdKrwRate,
  getEmsUsdKrwRateNumber,
} from '@/lib/ems/exchange-rate-store';

export const preferredRegion = 'icn1'; // 우체국 API 접근을 위해 서울 리전 고정

function createAdminSupabase() {
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srk) return null;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    srk,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

async function resolveInsuranceBoprc(
  searchParams: URLSearchParams,
  body?: Partial<QuoteParams & { insurance_usd?: number | string }>,
): Promise<{ boyn?: 'Y' | 'N'; boprc?: number }> {
  const boynParam = body?.boyn ?? searchParams.get('boyn');
  const insuranceUsdRaw =
    body?.insurance_usd ?? searchParams.get('insurance_usd');
  const insuranceUsd = insuranceUsdRaw != null ? parseFloat(String(insuranceUsdRaw)) : NaN;

  if (boynParam === 'Y' && insuranceUsd > 0) {
    const db = createAdminSupabase();
    const rateInfo = await getEmsUsdKrwRate(db ?? undefined);
    return {
      boyn: 'Y',
      boprc: usdToBoprcKrw(insuranceUsd, getEmsUsdKrwRateNumber(rateInfo)),
    };
  }

  const boprcParam = body?.boprc ?? searchParams.get('boprc');
  if (boynParam === 'Y' && boprcParam) {
    return { boyn: 'Y', boprc: parseInt(String(boprcParam), 10) };
  }
  if (boynParam === 'N') return { boyn: 'N', boprc: 0 };
  return {};
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
    const insurance = await resolveInsuranceBoprc(new URLSearchParams(), body);
    const result = await getShippingQuote({ ...(body as QuoteParams), ...insurance });
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
    const insurance = await resolveInsuranceBoprc(s);

    const params: QuoteParams = {
      premiumcd, em_ee, countrycd, totweight,
      boxlength: s.get('boxlength') ? parseFloat(s.get('boxlength')!) : undefined,
      boxwidth:  s.get('boxwidth')  ? parseFloat(s.get('boxwidth')!)  : undefined,
      boxheight: s.get('boxheight') ? parseFloat(s.get('boxheight')!) : undefined,
      boyn: insurance.boyn ?? (boynParam === 'Y' ? 'Y' : boynParam === 'N' ? 'N' : undefined),
      boprc: insurance.boprc ?? (boprcParam ? parseInt(boprcParam, 10) : undefined),
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
