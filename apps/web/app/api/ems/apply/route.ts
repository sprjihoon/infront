import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { applyEms, mockApplyEms, type EmsApplyParams } from '@/lib/ems/client';

const USE_MOCK = process.env.EMS_MOCK === 'true';

// 인프론트 발송인 정보
const SENDER = {
  name:    process.env.INFRONT_SENDER_NAME     ?? 'Infront',
  zipcode: process.env.INFRONT_SENDER_ZIPCODE  ?? '',
  addr1:   process.env.INFRONT_SENDER_ADDR1    ?? '',
  addr2:   process.env.INFRONT_SENDER_ADDR2    ?? '',
  addr3:   process.env.INFRONT_SENDER_ADDR3    ?? '',
  tel1:    process.env.INFRONT_SENDER_TEL1     ?? '82',
  tel2:    process.env.INFRONT_SENDER_TEL2     ?? '',
  tel3:    process.env.INFRONT_SENDER_TEL3     ?? '',
  tel4:    process.env.INFRONT_SENDER_TEL4     ?? '',
};

/**
 * POST /api/ems/apply
 * EMS / K-Packet 국제발송 신청
 *
 * 요청 Body:
 *   parcel_id   string  DB 소포 ID
 *   premiumcd   string  31=EMS / 32=EMS프리미엄 / 14=K-Packet
 *   em_ee       string  em=비서류 / ee=서류 / rl=K-Packet
 *   countrycd   string  목적국 국가코드
 *   totweight   number  총중량(g)
 *   boxlength   number  가로(cm)
 *   boxwidth    number  세로(cm)
 *   boxheight   number  높이(cm)
 *   receivename      string
 *   receivezipcode?  string
 *   receiveaddr1     string  주/도
 *   receiveaddr2     string  시/군
 *   receiveaddr3     string  상세주소
 *   receivetelno?    string
 *   receivemail?     string
 *   contents    string  품목명(영문, ;구분)
 *   number      string  개수(;구분)
 *   weight      string  순중량g(;구분)
 *   value       string  가격USD(;구분)
 *   hs_code     string  HS코드(;구분)
 *   origin      string  생산지코드(;구분)
 *   currunitcd  string  USD or EUR
 *   EM_gubun?   string  기본값 "Merchandise"
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { parcel_id, ...rest } = body as { parcel_id?: string } & Partial<EmsApplyParams>;

    // 필수 필드 검증
    const required = [
      'premiumcd','em_ee','countrycd','totweight',
      'boxlength','boxwidth','boxheight',
      'receivename','receiveaddr1','receiveaddr2','receiveaddr3',
      'contents','number','weight','value','hs_code','origin','currunitcd',
    ];
    const missing = required.filter(k => !rest[k as keyof typeof rest]);
    if (missing.length) {
      return NextResponse.json({ error: `필수 항목 누락: ${missing.join(', ')}` }, { status: 400 });
    }

    // 발송인 정보 주입 (인프론트 창고)
    const applyParams: EmsApplyParams = {
      ...(rest as EmsApplyParams),
      sender:        SENDER.name,
      senderzipcode: SENDER.zipcode,
      senderaddr1:   SENDER.addr1,
      senderaddr2:   SENDER.addr2,
      senderaddr3:   SENDER.addr3,
      sendertelno1:  SENDER.tel1,
      sendertelno2:  SENDER.tel2,
      sendertelno3:  SENDER.tel3,
      sendertelno4:  SENDER.tel4,
      EM_gubun:      rest.EM_gubun ?? 'Merchandise',
      boyn:          rest.boyn ?? 'N',
      orderno:       parcel_id ? `SPB-${parcel_id}` : undefined,
    };

    const result = USE_MOCK
      ? mockApplyEms(applyParams)
      : await applyEms(applyParams);

    // DB 업데이트 — parcels 테이블에 EMS 등기번호 저장
    if (parcel_id) {
      await supabase
        .from('parcels')
        .update({
          ems_regino:        result.regino,
          ems_receive_seq:   result.receiveseq,
          ems_req_no:        result.reqno,
          ems_fee:           parseInt(result.prerecevprc, 10),
          ems_country:       rest.countrycd,
          ems_premium_cd:    rest.premiumcd,
          status:            'ems_applied',
          updated_at:        new Date().toISOString(),
        })
        .eq('id', parcel_id);

      // 알림 생성
      const { data: parcel } = await supabase
        .from('parcels')
        .select('customer_id')
        .eq('id', parcel_id)
        .single();

      if (parcel?.customer_id) {
        await supabase.from('notifications').insert({
          customer_id: parcel.customer_id,
          type:        'ems_applied',
          title:       'EMS 발송 신청 완료',
          body:        `등기번호 ${result.regino} / 예상요금 ${parseInt(result.prerecevprc).toLocaleString()}원`,
          data:        { parcel_id, regino: result.regino },
        });
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[EMS Apply]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
