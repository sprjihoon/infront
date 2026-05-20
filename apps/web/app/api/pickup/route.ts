import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { insertOrder, mockInsertOrder } from '@/lib/epost/client';

export const preferredRegion = 'icn1'; // 우체국 API 접근을 위해 서울 리전 고정

// 인프론트 물류센터 정보 (환경변수 우선)
const CENTER_NAME    = process.env.INFRONT_CENTER_NAME    ?? '인프론트';
const CENTER_ZIPCODE = process.env.INFRONT_CENTER_ZIPCODE ?? '';
const CENTER_ADDR1   = process.env.INFRONT_CENTER_ADDR1   ?? '';
const CENTER_ADDR2   = process.env.INFRONT_CENTER_ADDR2   ?? '';
const CENTER_PHONE   = (process.env.INFRONT_CENTER_PHONE  ?? '').replace(/-/g, '');
const OFFICE_SER     = '260537802'; // 공급지코드 (인프론트)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      pickup_address,
      pickup_address_detail,
      pickup_zipcode,
      pickup_phone,
      pickup_date,
      pickup_notes,
      goods_name,
      weight,
      volume,
      test_mode,
      item_condition,
      pre_invoice_items,
    } = body as {
      pickup_address: string;
      pickup_address_detail?: string;
      pickup_zipcode: string;
      pickup_phone: string;
      pickup_date: string;
      pickup_notes?: string;
      goods_name?: string;
      weight?: number;
      volume?: number;
      test_mode?: boolean;
      item_condition?: string;
      pre_invoice_items?: object[];
    };

    // 필수 검증
    if (!pickup_address || !pickup_zipcode || !pickup_phone || !pickup_date) {
      return NextResponse.json(
        { error: '수거 주소, 우편번호, 연락처, 수거 희망일은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!CENTER_ZIPCODE || !CENTER_ADDR1) {
      return NextResponse.json(
        { error: '물류센터 정보가 설정되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 500 }
      );
    }

    // Supabase 클라이언트 (인증 확인)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 고객 정보 조회 (트리거 생성 전 가입 계정 대비 자동 생성)
    let { data: customer } = await supabase
      .from('customers')
      .select('id, name, customer_code')
      .eq('id', user.id)
      .single();

    if (!customer) {
      const seq = Date.now() % 10000;
      const code = `SPB-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(seq).padStart(4,'0')}`;
      const { data: created } = await supabase
        .from('customers')
        .insert({ id: user.id, email: user.email ?? '', customer_code: code })
        .select('id, name, customer_code')
        .single();
      customer = created;
    }

    if (!customer) {
      return NextResponse.json({ error: '고객 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 주문번호 생성 (parcel 기준)
    const orderNo = `SPB-${Date.now()}`;

    const custNo = (process.env.EPOST_CUSTOMER_ID ?? '').trim();
    const apprNo = (process.env.EPOST_APPROVAL_NO ?? '').trim();
    const hasSecurityKey = !!process.env.EPOST_SECURITY_KEY;
    const isTest = test_mode || !hasSecurityKey || !custNo;

    // 우체국 소포 신청 파라미터
    // 수거(반품소포): rec* = 고객(수거지), ord* = 인프론트 센터(도착지)
    const epostParams = {
      custNo: custNo || 'TEST',
      apprNo: apprNo || '0000000000',
      payType: '2' as const,    // 착불 (센터가 부담)
      reqType: '2' as const,    // 반품소포 (고객→센터)
      officeSer: OFFICE_SER,
      orderNo,
      // 도착지: 인프론트 물류센터
      ordCompNm: CENTER_NAME,
      ordNm: CENTER_NAME,
      ordZip: CENTER_ZIPCODE,
      ordAddr1: CENTER_ADDR1,
      ordAddr2: CENTER_ADDR2 || '없음',
      ordMob: CENTER_PHONE,
      // 출발지(수거지): 고객
      recNm: customer.name || '고객',
      recZip: pickup_zipcode.replace(/-/g, ''),
      recAddr1: pickup_address,
      recAddr2: pickup_address_detail || '없음',
      recTel: pickup_phone.replace(/-/g, '').substring(0, 12),
      // 상품 정보
      contCd: '025',
      goodsNm: goods_name || '해외배송 물품',
      weight: typeof weight === 'number' && weight > 0 ? Math.floor(weight) : 2,
      volume: typeof volume === 'number' && volume > 0 ? Math.floor(volume) : 60,
      microYn: 'N' as const,
      delivMsg: pickup_notes,
      testYn: isTest ? 'Y' as const : 'N' as const,
      printYn: 'Y' as const,
      inqTelCn: pickup_phone.replace(/-/g, '').substring(0, 12),
    };

    let epostResult;
    if (isTest) {
      console.log('[PICKUP] 테스트 모드로 실행 (실제 API 미호출)');
      epostResult = mockInsertOrder();
    } else {
      epostResult = await insertOrder(epostParams);
    }

    // parcels 테이블에 저장
    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .insert({
        customer_id: user.id,
        status: 'PENDING_PICKUP',
        pickup_tracking_no: epostResult.regiNo,
        pickup_address,
        pickup_address_detail: pickup_address_detail ?? null,
        pickup_zipcode,
        pickup_phone,
        pickup_date,
        pickup_notes: pickup_notes ?? null,
        pickup_requested_at: new Date().toISOString(),
        epost_req_no: epostResult.reqNo,
        epost_res_no: epostResult.resNo,
        epost_pickup_date: epostResult.resDate,
        epost_price: epostResult.price,
        notes: goods_name ?? null,
        // 물품 내역 (선택 입력)
        ...(item_condition && { item_condition }),
        ...(pre_invoice_items?.length && { pre_invoice_items }),
        registered_by: 'CUSTOMER',
      })
      .select()
      .single();

    if (parcelError) {
      console.error('[PICKUP] parcel insert error:', parcelError);
      return NextResponse.json({ error: '수거 신청 저장에 실패했습니다.' }, { status: 500 });
    }

    // 알림 생성
    await supabase.from('notifications').insert({
      customer_id: user.id,
      parcel_id: parcel.id,
      type: 'INBOUND',
      title: '수거 예약 완료',
      body: `운송장번호 ${epostResult.regiNo}로 수거가 예약되었습니다. 수거 예정일: ${epostResult.resDate?.substring(0, 8) ?? '미정'}`,
    }).throwOnError();

    return NextResponse.json({
      success: true,
      parcel_id: parcel.id,
      tracking_no: epostResult.regiNo,
      pickup_date: epostResult.resDate,
      price: epostResult.price,
      post_office: epostResult.regiPoNm,
      is_test: isTest,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[PICKUP] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
