import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { insertOrder, mockInsertOrder, cancelOrder } from '@/lib/epost/client';
import type { InsertOrderResponse } from '@/lib/epost/types';
import {
  resolvePickupBoxList,
  pickupBoxSummary,
  PICKUP_MAX_BOX_COUNT,
  type PickupBoxInput,
  type PickupBoxSizeCode,
} from '@/lib/epost/pickup-boxes';

export const preferredRegion = 'icn1'; // 우체국 API 접근을 위해 서울 리전 고정

const CENTER_NAME    = process.env.INFRONT_CENTER_NAME    ?? '인프론트';
const CENTER_ZIPCODE = process.env.INFRONT_CENTER_ZIPCODE ?? '';
const CENTER_ADDR1   = process.env.INFRONT_CENTER_ADDR1   ?? '';
const CENTER_ADDR2   = process.env.INFRONT_CENTER_ADDR2   ?? '';
const CENTER_PHONE   = (process.env.INFRONT_CENTER_PHONE  ?? '').replace(/-/g, '');
const OFFICE_SER     = '260537802'; // 공급지코드 (인프론트)

interface CreatedPickup {
  parcel_id: string;
  tracking_no: string;
  box_seq: number;
  price: string;
  box_spec: string;
}

async function rollbackEpostOrders(
  created: Array<{ result: InsertOrderResponse; orderNo: string }>,
  custNo: string,
  apprNo: string,
) {
  for (const { result, orderNo } of created) {
    if (!result.reqNo || result.reqNo.startsWith('MOCK-')) continue;
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
      console.error('[PICKUP] rollback cancel failed:', orderNo, e);
    }
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
      pickup_address: string;
      pickup_address_detail?: string;
      pickup_zipcode: string;
      pickup_phone: string;
      pickup_date: string;
      pickup_notes?: string;
      goods_name?: string;
      test_mode?: boolean;
      item_condition?: string;
      pre_invoice_items?: object[];
      boxes?: PickupBoxInput[];
      box_count?: number;
      box_size?: PickupBoxSizeCode;
    };

    if (!pickup_address || !pickup_zipcode || !pickup_phone || !pickup_date) {
      return NextResponse.json(
        { error: '수거 주소, 우편번호, 연락처, 수거 희망일은 필수입니다.' },
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

    if (boxSpecs.length > PICKUP_MAX_BOX_COUNT) {
      return NextResponse.json(
        { error: `수거 박스는 최대 ${PICKUP_MAX_BOX_COUNT}개까지 신청할 수 있습니다.` },
        { status: 400 }
      );
    }

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

    const custNo = (process.env.EPOST_CUSTOMER_ID ?? '').trim();
    const apprNo = (process.env.EPOST_APPROVAL_NO ?? '').trim();
    const hasSecurityKey = !!process.env.EPOST_SECURITY_KEY;
    const isTest = test_mode || !hasSecurityKey || !custNo;

    const batchId = randomUUID();
    const totalBoxes = boxSpecs.length;
    const baseTs = Date.now();

    const epostCreated: Array<{ result: InsertOrderResponse; orderNo: string; boxSeq: number }> = [];
    const parcelCreated: CreatedPickup[] = [];

    let sharedResDate = '';
    let sharedPostOffice = '';

    for (let i = 0; i < boxSpecs.length; i++) {
      const spec = boxSpecs[i];
      const boxSeq = i + 1;
      const orderNo = `SPB-${baseTs}-${boxSeq}`;
      const boxLabel = totalBoxes > 1 ? ` (${boxSeq}/${totalBoxes})` : '';
      const goodsNm = goods_name
        ? `${goods_name}${boxLabel}`
        : `해외배송 물품${boxLabel}`;

      const epostParams = {
        custNo: custNo || 'TEST',
        apprNo: apprNo || '0000000000',
        payType: '2' as const,
        reqType: '2' as const,
        officeSer: OFFICE_SER,
        orderNo,
        ordCompNm: CENTER_NAME,
        ordNm: CENTER_NAME,
        ordZip: CENTER_ZIPCODE,
        ordAddr1: CENTER_ADDR1,
        ordAddr2: CENTER_ADDR2 || '없음',
        ordMob: CENTER_PHONE,
        recNm: customer.name || '고객',
        recZip: pickup_zipcode.replace(/-/g, ''),
        recAddr1: pickup_address,
        recAddr2: pickup_address_detail || '없음',
        recTel: pickup_phone.replace(/-/g, '').substring(0, 12),
        contCd: '025',
        goodsNm,
        weight: spec.weight,
        volume: spec.volume,
        microYn: spec.microYn,
        delivMsg: pickup_notes,
        testYn: isTest ? ('Y' as const) : ('N' as const),
        printYn: 'Y' as const,
        inqTelCn: pickup_phone.replace(/-/g, '').substring(0, 12),
      };

      let epostResult: InsertOrderResponse;
      if (isTest) {
        console.log(`[PICKUP] 테스트 모드 박스 ${boxSeq}/${totalBoxes}`, spec);
        epostResult = mockInsertOrder();
      } else {
        epostResult = await insertOrder(epostParams);
      }

      epostCreated.push({ result: epostResult, orderNo, boxSeq });

      if (!sharedResDate) sharedResDate = epostResult.resDate;
      if (!sharedPostOffice && epostResult.regiPoNm) sharedPostOffice = epostResult.regiPoNm;

      const boxNote = totalBoxes > 1
        ? `[수거 ${boxSeq}/${totalBoxes}] ${pickupBoxSummary(spec)}`
        : pickupBoxSummary(spec);

      const { data: parcel, error: parcelError } = await supabase
        .from('parcels')
        .insert({
          customer_id: user.id,
          status: 'PENDING_PICKUP',
          pickup_tracking_no: epostResult.regiNo,
          tracking_no: epostResult.regiNo,
          courier: '우체국택배',
          tracking_carrier_id: 'kr.epost',
          pickup_address,
          pickup_address_detail: pickup_address_detail ?? null,
          pickup_zipcode,
          pickup_phone,
          pickup_date,
          pickup_notes: pickup_notes ?? null,
          pickup_requested_at: new Date().toISOString(),
          epost_req_no: epostResult.reqNo,
          epost_res_no: epostResult.resNo,
          epost_order_no: orderNo,
          epost_pickup_date: epostResult.resDate,
          epost_price: epostResult.price,
          notes: goods_name ? `${boxNote} · ${goods_name}` : boxNote,
          pickup_batch_id: totalBoxes > 1 ? batchId : null,
          pickup_box_seq: boxSeq,
          pickup_box_count: totalBoxes,
          pickup_weight_kg: spec.weight,
          pickup_volume_cm: spec.volume,
          pickup_micro_yn: spec.microYn,
          ...(boxSeq === 1 && item_condition && { item_condition }),
          ...(boxSeq === 1 && pre_invoice_items?.length && { pre_invoice_items }),
          registered_by: 'CUSTOMER',
        })
        .select('id')
        .single();

      if (parcelError || !parcel) {
        console.error('[PICKUP] parcel insert error:', parcelError);
        if (!isTest && epostCreated.length > 0) {
          await rollbackEpostOrders(epostCreated, custNo, apprNo);
        }
        return NextResponse.json(
          { error: `박스 ${boxSeq} 저장에 실패했습니다. 이전 접수는 취소되었을 수 있습니다.` },
          { status: 500 }
        );
      }

      parcelCreated.push({
        parcel_id: parcel.id,
        tracking_no: epostResult.regiNo,
        box_seq: boxSeq,
        price: epostResult.price,
        box_spec: pickupBoxSummary(spec),
      });
    }

    const trackingList = parcelCreated.map((p) => p.tracking_no).join(', ');
    const totalPrice = parcelCreated.reduce((s, p) => s + (parseInt(p.price, 10) || 0), 0);

    await supabase.from('notifications').insert({
      customer_id: user.id,
      parcel_id: parcelCreated[0].parcel_id,
      type: 'INBOUND',
      title: totalBoxes > 1 ? `수거 예약 완료 (${totalBoxes}박스)` : '수거 예약 완료',
      body: totalBoxes > 1
        ? `운송장 ${totalBoxes}건 (${trackingList})으로 수거가 예약되었습니다.`
        : `운송장번호 ${trackingList}로 수거가 예약되었습니다. 수거 예정일: ${sharedResDate?.substring(0, 8) ?? '미정'}`,
    }).throwOnError();

    return NextResponse.json({
      success: true,
      box_count: totalBoxes,
      pickup_batch_id: totalBoxes > 1 ? batchId : null,
      parcel_id: parcelCreated[0].parcel_id,
      parcel_ids: parcelCreated.map((p) => p.parcel_id),
      tracking_no: parcelCreated[0].tracking_no,
      tracking_nos: parcelCreated.map((p) => p.tracking_no),
      parcels: parcelCreated,
      pickup_date: sharedResDate,
      price: String(totalPrice),
      post_office: sharedPostOffice,
      is_test: isTest,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[PICKUP] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
