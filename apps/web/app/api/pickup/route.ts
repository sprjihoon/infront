import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import {
  insertOrder,
  mockInsertOrder,
  cancelOrder,
  getResInfo,
  normalizeEpostPhone,
  normalizeEpostZip,
  normalizeEpostAddr1,
  resolveEpostRecAddr2,
} from '@/lib/epost/client';
import type { InsertOrderResponse } from '@/lib/epost/types';
import {
  resolvePickupBoxList,
  pickupBoxSummary,
  formatPickupOrderNo,
  type PickupBoxInput,
  type PickupBoxSizeCode,
} from '@/lib/epost/pickup-boxes';
import { buildReturnPickupOrderParams } from '@/lib/epost/pickup-order';

export const preferredRegion = 'icn1';

const CENTER_ORD_NM  = process.env.INFRONT_CENTER_ORD_NM  ?? '인프론트';
const CENTER_ZIPCODE = normalizeEpostZip(process.env.INFRONT_CENTER_ZIPCODE ?? '');
const CENTER_ADDR1   = (process.env.INFRONT_CENTER_ADDR1   ?? '').trim();
const CENTER_ADDR2   = (process.env.INFRONT_CENTER_ADDR2   ?? '').trim();
const OFFICE_SER     = '260537802';

function centerPhone() {
  return normalizeEpostPhone(process.env.INFRONT_CENTER_PHONE);
}

async function rollbackEpostOrder(
  result: InsertOrderResponse,
  custNo: string,
  apprNo: string,
) {
  if (!result.reqNo || result.reqNo.startsWith('MOCK-')) return;
  try {
    await cancelOrder({
      custNo,
      apprNo,
      reqType: '2',
      payType: '2',
      reqNo: result.reqNo,
      resNo: result.resNo ?? '',
      regiNo: result.regiNo,
      reqYmd: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      delYn: 'Y',
    });
  } catch (e) {
    console.error('[PICKUP] rollback cancel failed:', result.regiNo, e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      pickup_address,
      pickup_address_detail,
      pickup_zipcode,
      pickup_phone,
      pickup_name,
      pickup_address_id,
      pickup_date,
      pickup_notes,
      goods_name,
      test_mode,
      item_condition,
      pre_invoice_items,
      boxes,
      box_count,
      box_size,
    } = body as {
      pickup_address?: string;
      pickup_address_detail?: string;
      pickup_zipcode?: string;
      pickup_phone?: string;
      pickup_name?: string;
      pickup_address_id?: string;
      pickup_date: string;
      pickup_notes?: string;
      goods_name?: string;
      test_mode?: boolean;
      item_condition?: string;
      pre_invoice_items?: object[];
      boxes?: PickupBoxInput[];
      box_size?: PickupBoxSizeCode;
      box_count?: number;
    };

    if (!pickup_phone?.trim() || !pickup_date) {
      return NextResponse.json(
        { error: '수거 연락처, 수거 희망일은 필수입니다.' },
        { status: 400 }
      );
    }

    let boxSpecs;
    try {
      boxSpecs = resolvePickupBoxList({ boxes, box_count, box_size });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : '박스 규격이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const spec = boxSpecs[0];

    if (!CENTER_ZIPCODE || !CENTER_ADDR1) {
      return NextResponse.json(
        { error: '물류센터 정보가 설정되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 500 }
      );
    }

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

    let { data: customer } = await supabase
      .from('customers')
      .select('id, name, customer_code')
      .eq('id', user.id)
      .single();

    if (!customer) {
      const seq = Date.now() % 10000;
      const code = `SPB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(seq).padStart(4, '0')}`;
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

    let recAddr1 = normalizeEpostAddr1(pickup_address);
    let recZip = normalizeEpostZip(pickup_zipcode);
    let recAddr2Raw = pickup_address_detail;
    let recNm = pickup_name?.trim() || customer.name?.trim() || '고객';
    let recPhoneRaw = pickup_phone;

    console.log('[PICKUP] 클라이언트 입력값', {
      pickup_address,
      pickup_zipcode,
      pickup_address_id,
      recAddr1_init: recAddr1,
      recZip_init: recZip,
    });

    if (pickup_address_id) {
      const { data: savedAddr, error: addrErr } = await supabase
        .from('customer_addresses')
        .select('name, phone, zipcode, address, address_detail')
        .eq('id', pickup_address_id)
        .eq('customer_id', user.id)
        .eq('type', 'pickup')
        .maybeSingle();

      console.log('[PICKUP] DB 주소 조회', {
        found: !!savedAddr,
        dbAddr: savedAddr?.address,
        dbZip: savedAddr?.zipcode,
        addrErr: addrErr?.message,
      });

      if (savedAddr) {
        const savedAddr1 = normalizeEpostAddr1(savedAddr.address);
        if (savedAddr1.length >= 2) recAddr1 = savedAddr1;
        const savedZip = normalizeEpostZip(savedAddr.zipcode);
        if (savedZip.length === 5) recZip = savedZip;
        if (savedAddr.address_detail != null) recAddr2Raw = savedAddr.address_detail;
        if (savedAddr.name?.trim()) recNm = savedAddr.name.trim();
        if (savedAddr.phone?.trim()) recPhoneRaw = savedAddr.phone.trim();
      }
    }

    console.log('[PICKUP] 최종 수거지 값', {
      recAddr1,
      recZip,
      recNm,
      hasPhone: !!recPhoneRaw,
    });

    if (recZip.length !== 5) {
      return NextResponse.json(
        { error: '수거지 우편번호가 없습니다. 주소 검색으로 다시 선택해주세요.' },
        { status: 400 }
      );
    }
    if (recAddr1.length < 2) {
      return NextResponse.json(
        { error: '수거지 도로명/지번 주소가 없습니다. 주소록에서 주소 검색 후 다시 저장해주세요.' },
        { status: 400 }
      );
    }

    const custNo = (process.env.EPOST_CUSTOMER_ID ?? '').trim();
    const apprNo = (process.env.EPOST_APPROVAL_NO ?? '').trim();
    const hasEpostCreds =
      !!process.env.EPOST_API_KEY?.trim() &&
      !!process.env.EPOST_SECURITY_KEY?.trim() &&
      !!custNo &&
      !!apprNo;
    const isTest = test_mode === true || !hasEpostCreds;

    const recAddr2 = resolveEpostRecAddr2(recAddr2Raw);

    const centerMob = centerPhone();
    if (!isTest && !centerMob) {
      return NextResponse.json(
        { error: '물류센터 연락처(INFRONT_CENTER_PHONE)가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const pickupZip = recZip;
    const centerZip = CENTER_ZIPCODE;
    if (
      !isTest &&
      pickupZip === centerZip &&
      recAddr1 === normalizeEpostAddr1(CENTER_ADDR1)
    ) {
      return NextResponse.json(
        { error: '수거 주소는 물류센터 주소와 달라야 합니다. 고객님 댁 주소를 입력해주세요.' },
        { status: 400 }
      );
    }

    const parcelId = randomUUID();
    const orderNo = formatPickupOrderNo(customer.customer_code ?? undefined, parcelId);
    const goodsNm = goods_name?.trim() || '해외배송 물품';
    const boxNote = pickupBoxSummary(spec);

    const epostParams = buildReturnPickupOrderParams({
      custNo: custNo || 'TEST',
      apprNo: apprNo || '0000000000',
      officeSer: OFFICE_SER,
      orderNo,
      center: {
        ordNm: CENTER_ORD_NM,
        zip: CENTER_ZIPCODE,
        addr1: CENTER_ADDR1,
        addr2: '',  // 우체국 계약에 recAddr2='없음'으로 등록됨 — CENTER_ADDR2는 라벨 출력용
        phone: centerMob,
      },
      pickup: {
        name: recNm,
        zip: recZip,
        addr1: recAddr1,
        addr2: recAddr2Raw,
        phone: recPhoneRaw,
      },
      goodsNm,
      weight: spec.weight,
      volume: spec.volume,
      delivMsg: pickup_notes,
      testYn: isTest ? 'Y' : 'N',
    });

    if (!isTest) {
      console.log('[PICKUP] epost 반품소포', {
        ordZip: epostParams.ordZip,
        ordAddr1: epostParams.ordAddr1,
        recZip: epostParams.recZip,
        recAddr1: epostParams.recAddr1,
        recNm: epostParams.recNm,
      });
    }

    let epostResult: InsertOrderResponse;
    let orderNoUsed = orderNo;
    if (isTest) {
      console.log('[PICKUP] 테스트 모드', spec);
      epostResult = mockInsertOrder();
    } else {
      try {
        epostResult = await insertOrder({ ...epostParams, orderNo: orderNoUsed });
      } catch (firstErr) {
        try {
          orderNoUsed = formatPickupOrderNo(customer.customer_code ?? undefined, randomUUID());
          await new Promise((r) => setTimeout(r, 800));
          epostResult = await insertOrder({ ...epostParams, orderNo: orderNoUsed });
        } catch (e) {
          console.error('[PICKUP] epost insert failed:', firstErr, e);
          const msg = e instanceof Error ? e.message : '우체국 API 오류';
          return NextResponse.json({ error: msg }, { status: 502 });
        }
      }

      const reqYmd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      getResInfo({ reqType: '2', orderNo: orderNoUsed, reqYmd })
        .then((info) => console.log('[PICKUP] getResInfo OK:', info.treatStusCd, info.regiNo))
        .catch((err) => console.warn('[PICKUP] getResInfo skip:', err instanceof Error ? err.message : err));
    }

    const trackingEvents = [{
      timestamp: new Date().toISOString(),
      status: 'BOOKED',
      description: '수거예약 완료',
      location: epostResult.regiPoNm,
      reqNo: epostResult.reqNo,
      resNo: epostResult.resNo,
      apprNo: epostParams.apprNo,
      reqType: epostParams.reqType,
      payType: epostParams.payType,
      source: 'epost_pickup',
    }];

    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .insert({
        id: parcelId,
        customer_id: user.id,
        status: 'PENDING_PICKUP',
        pickup_tracking_no: epostResult.regiNo,
        tracking_no: epostResult.regiNo,
        courier: '우체국택배',
        tracking_carrier_id: 'kr.epost',
        inbound_source: 'PICKUP',
        pickup_address: recAddr1,
        pickup_address_detail: recAddr2 === '없음' ? null : recAddr2,
        pickup_zipcode: recZip,
        pickup_phone: recPhoneRaw,
        pickup_date,
        pickup_notes: pickup_notes ?? null,
        pickup_requested_at: new Date().toISOString(),
        epost_req_no: epostResult.reqNo,
        epost_res_no: epostResult.resNo,
        epost_order_no: orderNoUsed,
        epost_pickup_date: epostResult.resDate,
        epost_price: epostResult.price,
        tracking_events: trackingEvents,
        notes: goods_name ? `${boxNote} · ${goods_name}` : boxNote,
        pickup_box_count: 1,
        pickup_weight_kg: spec.weight,
        pickup_volume_cm: spec.volume,
        pickup_micro_yn: 'N',
        ...(item_condition && { item_condition }),
        ...(pre_invoice_items?.length && { pre_invoice_items }),
        registered_by: 'CUSTOMER',
      })
      .select('id')
      .single();

    if (parcelError || !parcel) {
      console.error('[PICKUP] parcel insert error:', parcelError);
      if (!isTest) await rollbackEpostOrder(epostResult, custNo, apprNo);
      return NextResponse.json({ error: '수거 정보 저장에 실패했습니다.' }, { status: 500 });
    }

    await supabase.from('notifications').insert({
      customer_id: user.id,
      parcel_id: parcel.id,
      type: 'INBOUND',
      title: '수거 예약 완료',
      body: `운송장번호 ${epostResult.regiNo}로 수거가 예약되었습니다. 수거 예정일: ${epostResult.resDate?.substring(0, 8) ?? '미정'}`,
    }).throwOnError();

    return NextResponse.json({
      success: true,
      box_count: 1,
      parcel_id: parcel.id,
      parcel_ids: [parcel.id],
      tracking_no: epostResult.regiNo,
      tracking_nos: [epostResult.regiNo],
      parcels: [{
        parcel_id: parcel.id,
        tracking_no: epostResult.regiNo,
        box_seq: 1,
        price: epostResult.price,
        box_spec: boxNote,
      }],
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
