import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import {
  insertOrder,
  mockInsertOrder,
  cancelOrder,
  getResInfo,
  resolveEpostCancelReqYmd,
  normalizeEpostPhone,
  normalizeEpostZip,
  normalizeEpostAddr1,
  inferPickupAddressDetail,
  resolveEpostPickupAddr2,
  requireEpostPhone,
  splitPickupAddressForEpost,
  normalizeEpostPickupAddr2,
  extractEpostZipFromAddress,
} from '@/lib/epost/client';
import type { InsertOrderResponse } from '@/lib/epost/types';
import { validatePreInvoiceItems } from '@/lib/pre-invoice-validation';
import {
  resolvePickupBoxList,
  pickupBoxSummary,
  formatPickupOrderNo,
  type PickupBoxInput,
  type PickupBoxSizeCode,
} from '@/lib/epost/pickup-boxes';
import { buildReturnPickupOrderParams } from '@/lib/epost/pickup-order';
import { normalizeEpostRetVisitYmd } from '@/lib/epost/pickup-date';
import { resolveInfrontCenterFromEnv } from '@/lib/epost/center-config';

export const preferredRegion = 'icn1';

const OFFICE_SER = '260537802';

/** 요청마다 env 재조회 — 모듈 로드 시점/인코딩 깨짐 방지 */
function getCenterConfig() {
  return resolveInfrontCenterFromEnv();
}

/** insert 실패 후에도 우체국에 접수됐을 수 있음 — getResInfo로 regiNo 복구 */
async function recoverPickupInsertFromEpost(
  orderNo: string,
  retVisitYmd: string,
  custNo: string,
): Promise<InsertOrderResponse | null> {
  const reqYmdCandidates = [
    retVisitYmd,
    resolveEpostCancelReqYmd({}),
  ];
  const seen = new Set<string>();
  for (const reqYmd of reqYmdCandidates) {
    if (!reqYmd || seen.has(reqYmd)) continue;
    seen.add(reqYmd);
    try {
      const info = await getResInfo({ custNo, reqType: '2', orderNo, reqYmd });
      const regiNo = info.regiNo?.trim() ?? '';
      if (regiNo.length >= 10) {
        console.log('[PICKUP] epost insert recovered via getResInfo', { orderNo, reqYmd, regiNo });
        return {
          reqNo: info.reqNo,
          resNo: info.resNo,
          regiNo,
          regiPoNm: info.regiPoNm,
          resDate: info.resDate,
          price: info.price,
          vTelNo: info.vTelNo,
        };
      }
    } catch (e) {
      console.warn(
        '[PICKUP] getResInfo recovery miss',
        orderNo,
        reqYmd,
        e instanceof Error ? e.message : e,
      );
    }
  }
  return null;
}

function isAmbiguousEpostInsertError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('연결하지 못했습니다') ||
    msg.includes('fetch failed') ||
    msg.includes('ERR-311') ||
    msg.includes('응답 시간 초과')
  );
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
      reqYmd: resolveEpostCancelReqYmd({ epostPickupDate: result.resDate }),
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

    const invoiceErr = validatePreInvoiceItems(
      (pre_invoice_items ?? []) as { name_en?: string; quantity?: number; unit_price_usd?: number; hs_code?: string }[],
    );
    if (invoiceErr) {
      return NextResponse.json({ error: invoiceErr }, { status: 400 });
    }

    let retVisitYmd: string;
    try {
      retVisitYmd = normalizeEpostRetVisitYmd(pickup_date);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : '수거 희망일이 올바르지 않습니다.' },
        { status: 400 },
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
    const center = getCenterConfig();
    const centerZip = normalizeEpostZip(center.zip);
    const centerAddr1 = normalizeEpostAddr1(center.addr1);

    if (centerZip.length !== 5 || centerAddr1.length < 2) {
      return NextResponse.json(
        { error: '물류센터(동대구우체국) 주소가 올바르지 않습니다. INFRONT_CENTER_* 환경변수를 확인해주세요.' },
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

      if (!savedAddr) {
        return NextResponse.json(
          { error: '선택한 수거지 주소를 찾을 수 없습니다. 마이페이지 주소록에서 다시 선택해주세요.' },
          { status: 400 },
        );
      }

      const savedAddr1 = normalizeEpostAddr1(savedAddr.address);
      if (savedAddr1.length >= 2) recAddr1 = savedAddr1;
      const savedZip = normalizeEpostZip(savedAddr.zipcode);
      if (savedZip.length === 5) recZip = savedZip;
      if (savedAddr.name?.trim()) recNm = savedAddr.name.trim();
      if (savedAddr.phone?.trim()) recPhoneRaw = savedAddr.phone.trim();
      // 주소록 DB가 기준 — 화면 값은 DB에 상세주소가 없을 때만 보완
      const detailFromDb = inferPickupAddressDetail(
        savedAddr.address,
        savedAddr.address_detail,
      );
      const detailFromClient = (pickup_address_detail ?? '').trim();
      recAddr2Raw =
        detailFromDb ||
        detailFromClient ||
        inferPickupAddressDetail(recAddr1, recAddr2Raw) ||
        '';
    } else {
      recAddr2Raw =
        (pickup_address_detail ?? '').trim() ||
        inferPickupAddressDetail(recAddr1, recAddr2Raw) ||
        '';
    }

    // 주소록 ID 없이 동일 우편번호·도로명이면 저장된 수거지와 매칭
    if (!pickup_address_id && recZip.length === 5 && recAddr1.length >= 2) {
      const { data: candidates } = await supabase
        .from('customer_addresses')
        .select('id, address, address_detail')
        .eq('customer_id', user.id)
        .eq('type', 'pickup')
        .eq('zipcode', recZip);
      const hit = candidates?.find(
        (row) => normalizeEpostAddr1(row.address) === recAddr1,
      );
      if (hit) {
        const inferred = inferPickupAddressDetail(hit.address, hit.address_detail);
        if (inferred.length >= 2) recAddr2Raw = inferred;
      }
    }

    if (recZip.length !== 5) {
      const fromAddr =
        extractEpostZipFromAddress(recAddr1) ||
        extractEpostZipFromAddress(pickup_address);
      if (fromAddr.length === 5) recZip = fromAddr;
    }

    console.log('[PICKUP] 최종 수거지 값', {
      recAddr1,
      recZip,
      recNm,
      recAddr2: (recAddr2Raw ?? '').trim(),
      hasPhone: !!recPhoneRaw,
      pickup_address_id: pickup_address_id ?? null,
    });

    if (recZip.length !== 5) {
      return NextResponse.json(
        {
          error:
            '수거지 우편번호가 없습니다. 마이페이지 → 주소록에서 주소 검색으로 우편번호를 포함해 다시 저장한 뒤 수거지를 선택해주세요.',
        },
        { status: 400 }
      );
    }
    if (recAddr1.length < 2) {
      return NextResponse.json(
        { error: '수거지 도로명/지번 주소가 없습니다. 주소록에서 주소 검색 후 다시 저장해주세요.' },
        { status: 400 }
      );
    }

    const pickupSplit = splitPickupAddressForEpost(recAddr1, recAddr2Raw);
    recAddr1 = pickupSplit.addr1;
    const recAddr2ForEpost = normalizeEpostPickupAddr2(pickupSplit.addr2);
    if (recAddr2ForEpost !== pickupSplit.addr2.trim()) {
      console.log('[PICKUP] recAddr2 normalized for EPOST', {
        from: pickupSplit.addr2,
        to: recAddr2ForEpost,
      });
    }

    const custNo = (process.env.EPOST_CUSTOMER_ID ?? '').trim();
    const apprNo = (process.env.EPOST_APPROVAL_NO ?? '').trim();
    const hasEpostCreds =
      !!process.env.EPOST_API_KEY?.trim() &&
      !!process.env.EPOST_SECURITY_KEY?.trim() &&
      !!custNo &&
      !!apprNo;
    const isTest = test_mode === true || !hasEpostCreds;

    if (!isTest && recAddr2ForEpost.length < 2) {
      const short = (recAddr2Raw ?? '').trim();
      const hint = pickup_address_id
        ? '마이페이지 → 주소록 관리 → 수거배송지에서 상세주소(2글자 이상, 예: 3층·302호)를 입력·저장한 뒤 다시 선택해주세요.'
        : '수거 신청 화면에서 상세주소(동·호수, 층)를 2글자 이상 입력해주세요.';
      const tooShort =
        short.length === 1 && /^\d$/.test(short)
          ? `상세주소 "${short}"만으로는 부족합니다. 예: ${short}층, ${short}02호. `
          : short.length === 1
            ? '상세주소는 2글자 이상이어야 합니다. '
            : '';
      return NextResponse.json(
        { error: `${tooShort}수거지 상세주소가 없습니다. ${hint}` },
        { status: 400 }
      );
    }

    // 수거 화면에서 보완 입력한 상세주소를 주소록에 반영 (다음 접수부터 그대로 사용)
    if (pickup_address_id && recAddr2ForEpost.length >= 2) {
      const addrPatch: { address_detail: string; zipcode?: string } = {
        address_detail: recAddr2ForEpost,
      };
      const { data: zipRow } = await supabase
        .from('customer_addresses')
        .select('zipcode')
        .eq('id', pickup_address_id)
        .eq('customer_id', user.id)
        .eq('type', 'pickup')
        .maybeSingle();
      if (normalizeEpostZip(zipRow?.zipcode).length !== 5 && recZip.length === 5) {
        addrPatch.zipcode = recZip;
      }
      await supabase
        .from('customer_addresses')
        .update(addrPatch)
        .eq('id', pickup_address_id)
        .eq('customer_id', user.id)
        .eq('type', 'pickup');
    }

    let centerMob = '';
    let recPhoneEpost = '';
    if (!isTest) {
      try {
        centerMob = requireEpostPhone(
          center.phone || process.env.INFRONT_CENTER_PHONE,
          '센터 연락처(INFRONT_CENTER_PHONE)',
        );
        recPhoneEpost = requireEpostPhone(recPhoneRaw, '수거 연락처(recTel)');
      } catch (e) {
        const msg = e instanceof Error ? e.message : '연락처 형식 오류';
        const status = msg.includes('INFRONT_CENTER') ? 500 : 400;
        return NextResponse.json({ error: msg }, { status });
      }
    } else {
      centerMob = center.phone || '01000000000';
      recPhoneEpost = normalizeEpostPhone(recPhoneRaw) || '01000000000';
    }

    const pickupZip = recZip;
    if (
      !isTest &&
      pickupZip === centerZip &&
      recAddr1 === centerAddr1
    ) {
      return NextResponse.json(
        { error: '수거 주소는 물류센터 주소와 달라야 합니다. 고객님 댁 주소를 입력해주세요.' },
        { status: 400 }
      );
    }

    const boxNote = pickupBoxSummary(spec);
    const pickupDateIso = `${retVisitYmd.slice(0, 4)}-${retVisitYmd.slice(4, 6)}-${retVisitYmd.slice(6, 8)}`;
    const recentSince = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentPickup } = await supabase
      .from('parcels')
      .select(
        'id, pickup_tracking_no, epost_order_no, epost_res_date, epost_price, epost_req_no, epost_res_no',
      )
      .eq('customer_id', user.id)
      .eq('status', 'PENDING_PICKUP')
      .eq('pickup_zipcode', recZip)
      .eq('pickup_address', recAddr1)
      .eq('pickup_date', pickupDateIso)
      .gte('pickup_requested_at', recentSince)
      .order('pickup_requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentPickup?.pickup_tracking_no) {
      console.log('[PICKUP] duplicate submit blocked — recent parcel', recentPickup.id);
      return NextResponse.json({
        success: true,
        duplicate_guard: true,
        box_count: 1,
        parcel_id: recentPickup.id,
        parcel_ids: [recentPickup.id],
        tracking_no: recentPickup.pickup_tracking_no,
        tracking_nos: [recentPickup.pickup_tracking_no],
        parcels: [{
          parcel_id: recentPickup.id,
          tracking_no: recentPickup.pickup_tracking_no,
          box_seq: 1,
          price: recentPickup.epost_price ?? '0',
          box_spec: boxNote,
        }],
        pickup_date: retVisitYmd,
        epost_res_date: recentPickup.epost_res_date ?? '',
        price: recentPickup.epost_price ?? '0',
        post_office: '',
        is_test: false,
      });
    }

    const parcelId = randomUUID();
    const orderNo = formatPickupOrderNo(customer.customer_code ?? undefined, parcelId);
    const goodsNm = goods_name?.trim() || '해외배송 물품';

    const epostParams = buildReturnPickupOrderParams({
      custNo: custNo || 'TEST',
      apprNo: apprNo || '0000000000',
      officeSer: OFFICE_SER,
      orderNo,
      center: {
        ordNm: center.ordNm,
        zip: centerZip,
        addr1: centerAddr1,
        addr2: '',
        phone: centerMob,
      },
      pickup: {
        name: recNm,
        zip: recZip,
        addr1: recAddr1,
        addr2: recAddr2ForEpost,
        phone: recPhoneEpost,
      },
      goodsNm,
      weight: spec.weight,
      volume: spec.volume,
      delivMsg: pickup_notes,
      retVisitYmd,
      testYn: isTest ? 'Y' : 'N',
    });

    if (!isTest) {
      console.log('[PICKUP] epost 반품소포 (ord=센터, rec=수거지)', {
        retVisitYmd: epostParams.retVisitYmd,
        ordZip: epostParams.ordZip,
        ordAddr1: epostParams.ordAddr1,
        ordAddr2: epostParams.ordAddr2,
        ordMob: epostParams.ordMob,
        recZip: epostParams.recZip,
        recAddr1: epostParams.recAddr1,
        recAddr2: epostParams.recAddr2,
        recTel: epostParams.recTel,
        recNm: epostParams.recNm,
      });
    }

    let epostResult: InsertOrderResponse;
    let orderNoUsed = orderNo;
    if (isTest) {
      console.log('[PICKUP] 테스트 모드', spec);
      epostResult = mockInsertOrder();
    } else {
      const firstOrderNo = orderNoUsed;
      try {
        epostResult = await insertOrder({ ...epostParams, orderNo: orderNoUsed });
      } catch (firstErr) {
        console.warn('[PICKUP] epost insert failed, trying getResInfo recovery', firstOrderNo, firstErr);
        const recovered = await recoverPickupInsertFromEpost(firstOrderNo, retVisitYmd, custNo);
        if (recovered) {
          epostResult = recovered;
          orderNoUsed = firstOrderNo;
        } else {
          console.error('[PICKUP] epost insert failed (no recovery):', firstErr);
          const msg = firstErr instanceof Error ? firstErr.message : '우체국 API 오류';
          let hint = '';
          if (isAmbiguousEpostInsertError(firstErr)) {
            hint =
              ' 우체국에 이미 접수되었을 수 있습니다. 마이페이지에서 수거 내역을 확인하고, 같은 버튼을 다시 누르지 마세요.';
          } else if (msg.includes('ordMob') || (msg.includes('ERR-522') && msg.includes('ordMob'))) {
            hint = ' 센터 연락처(INFRONT_CENTER_PHONE)를 숫자만 입력했는지 확인해주세요. (예: 01012345678)';
          } else if (msg.includes('recAddr2')) {
            hint = ' 수거지 상세주소(동·호수·층)를 2글자 이상 입력했는지 확인해주세요.';
          } else if (msg.includes('recAddr1') || (msg.includes('ERR-311') && msg.includes('recAddr1'))) {
            hint = ' 수거지 도로명 주소를 주소 검색으로 다시 저장해주세요.';
          } else if (msg.includes('recZip')) {
            hint =
              ' 수거지를 주소 검색으로 다시 저장해주세요. (상세주소는 2글자 이상·「3층」만 입력 시 「제3층」으로 저장됨)';
          } else if (msg.includes('orderNo') || (msg.includes('ERR-522') && msg.includes('orderNo'))) {
            hint = ' 잠시 후 다시 시도해주세요. (메모가 길면 접수 메시지를 짧게 입력해주세요.)';
          }
          return NextResponse.json(
            { error: msg + hint, maybe_booked: isAmbiguousEpostInsertError(firstErr) },
            { status: 502 },
          );
        }
      }

      const reqYmd = resolveEpostCancelReqYmd({ epostPickupDate: epostResult.resDate });
      getResInfo({ reqType: '2', orderNo: orderNoUsed, reqYmd })
        .then((info) => console.log('[PICKUP] getResInfo OK:', info.treatStusCd, info.regiNo, 'reqYmd=', reqYmd))
        .catch((err) => console.warn('[PICKUP] getResInfo skip:', err instanceof Error ? err.message : err, { orderNo: orderNoUsed, reqYmd }));
    }

    const { testYn: _omitTestYn, ...epostInsertSnapshot } = epostParams;
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
      epost_insert: epostInsertSnapshot,
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
        pickup_address_detail: recAddr2ForEpost || null,
        pickup_zipcode: recZip,
        pickup_phone: recPhoneRaw,
        pickup_date: `${retVisitYmd.slice(0, 4)}-${retVisitYmd.slice(4, 6)}-${retVisitYmd.slice(6, 8)}`,
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
      body: `운송장번호 ${epostResult.regiNo}로 수거가 예약되었습니다. 방문 희망일: ${retVisitYmd.slice(0, 4)}-${retVisitYmd.slice(4, 6)}-${retVisitYmd.slice(6, 8)}`,
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
      pickup_date: retVisitYmd,
      epost_res_date: epostResult.resDate,
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
