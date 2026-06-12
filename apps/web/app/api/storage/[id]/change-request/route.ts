import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function createSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
}

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/storage/[id]/change-request
 *
 * 즉시 적용 타입 (DB 자동 변경 → 관리자 작업지시서 생성):
 *   CAPACITY_CHANGE  — storage_type_id·capacity_score 즉시 변경
 *   MERGE_SLOTS      — 리터 기반 용량 검증 → 소스 슬롯 즉시 CANCELLED
 *
 * 관리자 승인 필요 타입:
 *   CONVERT_TO_LONG_TERM, TRANSFER_ITEMS, ADD_SLOT
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id: storage_id } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 본인 스토리지 조회 (capacity 정보 포함)
  const { data: storage, error: sErr } = await supabase
    .from("customer_storages")
    .select("id, storage_mode, plan_type, storage_type_id, capacity_score, used_score")
    .eq("id", storage_id)
    .eq("user_id", user.id)
    .single();

  if (sErr || !storage) {
    return NextResponse.json({ error: "스토리지를 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await req.json() as {
    request_type: string;
    requested_type_id?: string;
    requested_type_code?: string;
    requested_plan_type?: string;
    customer_note?: string;
    target_storage_id?: string;
    source_storage_ids?: string[];
  };

  const VALID_TYPES = ["CAPACITY_CHANGE", "CONVERT_TO_LONG_TERM", "ADD_SLOT", "TRANSFER_ITEMS", "MERGE_SLOTS"];
  if (!VALID_TYPES.includes(body.request_type)) {
    return NextResponse.json({ error: "유효하지 않은 요청 타입입니다." }, { status: 400 });
  }

  // ────────────────────────────────────────────────────────
  // CAPACITY_CHANGE: 즉시 적용
  // ────────────────────────────────────────────────────────
  if (body.request_type === "CAPACITY_CHANGE") {
    if (!body.requested_type_id) {
      return NextResponse.json({ error: "requested_type_id 가 필요합니다." }, { status: 400 });
    }

    // 새 타입 용량 조회
    const { data: newType } = await supabase
      .from("storage_types")
      .select("id, code, volume_liter, max_parcels")
      .eq("id", body.requested_type_id)
      .single();

    if (!newType) {
      return NextResponse.json({ error: "해당 보관 타입을 찾을 수 없습니다." }, { status: 404 });
    }

    // ── 업그레이드 전용 검증 ──────────────────────────────
    const currentVolume = storage.capacity_score ?? 0;

    // 다운그레이드 차단
    if (currentVolume > 0 && (newType.volume_liter ?? 0) <= currentVolume) {
      return NextResponse.json(
        { error: "현재 용량보다 큰 사이즈로만 변경 가능합니다." },
        { status: 422 }
      );
    }

    // 현재가 최대 사이즈인지 확인 (더 큰 타입이 없으면 최대)
    const { count: biggerCount } = await supabase
      .from("storage_types")
      .select("id", { count: "exact", head: true })
      .gt("volume_liter", currentVolume);

    if (biggerCount === 0) {
      return NextResponse.json(
        {
          error: "현재 최대 용량 사이즈입니다. 슬롯을 추가해주세요.",
          suggest_add_slot: true,
        },
        { status: 422 }
      );
    }
    // ────────────────────────────────────────────────────

    // customer_storages 즉시 업데이트
    const { error: upErr } = await supabase
      .from("customer_storages")
      .update({
        storage_type_id: newType.id,
        capacity_score:  newType.volume_liter,
        updated_at:      new Date().toISOString(),
      })
      .eq("id", storage_id);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // 작업지시서 생성 (관리자가 물리적으로 슬롯 재배치해야 함)
    const { data: workOrder, error: woErr } = await supabase
      .from("storage_change_requests")
      .insert({
        user_id:              user.id,
        storage_id,
        request_type:         "CAPACITY_CHANGE",
        requested_type_id:    body.requested_type_id,
        requested_type_code:  newType.code,
        customer_note:        body.customer_note ?? null,
      })
      .select()
      .single();

    if (woErr) {
      console.error("[change-request CAPACITY_CHANGE]", woErr);
    }

    return NextResponse.json({
      request: workOrder,
      applied: true,
      message: `보관함 용량이 ${newType.code}(${newType.volume_liter}L)로 변경되었습니다.`,
    }, { status: 201 });
  }

  // ────────────────────────────────────────────────────────
  // MERGE_SLOTS: 리터 기반 검증 후 즉시 적용
  // ────────────────────────────────────────────────────────
  if (body.request_type === "MERGE_SLOTS") {
    const sourceIds = body.source_storage_ids ?? [];
    if (sourceIds.length < 1) {
      return NextResponse.json({ error: "합칠 슬롯(source_storage_ids)이 1개 이상 필요합니다." }, { status: 400 });
    }
    if (sourceIds.includes(storage_id)) {
      return NextResponse.json({ error: "현재 보관함은 소스 목록에 포함할 수 없습니다." }, { status: 400 });
    }

    // 소스 슬롯 소유권 + 사용량 조회
    const { data: sourceSlots } = await supabase
      .from("customer_storages")
      .select("id, used_score, capacity_score, plan_type")
      .eq("user_id", user.id)
      .in("id", sourceIds)
      .neq("status", "CANCELLED");

    if (!sourceSlots || sourceSlots.length !== sourceIds.length) {
      return NextResponse.json({ error: "소스 슬롯 중 소유하지 않거나 유효하지 않은 항목이 있습니다." }, { status: 403 });
    }

    // 리터 기반 용량 검증
    // target: capacity_score = volume_liter (plan type의 총 용량)
    const targetCapacity = storage.capacity_score ?? 0;
    const targetUsed = storage.used_score ?? 0;
    const totalSourceUsed = sourceSlots.reduce((acc, s) => acc + (s.used_score ?? 0), 0);

    if (targetCapacity > 0 && (targetUsed + totalSourceUsed) > targetCapacity) {
      return NextResponse.json({
        error: `대표 보관함의 남은 용량(${targetCapacity - targetUsed}L)이 합칠 물품의 사용량(${totalSourceUsed}L)보다 작습니다.`,
        target_capacity:  targetCapacity,
        target_used:      targetUsed,
        source_used:      totalSourceUsed,
        short_by:         (targetUsed + totalSourceUsed) - targetCapacity,
      }, { status: 422 });
    }

    // 소스 슬롯 즉시 CANCELLED
    const { error: cancelErr } = await supabase
      .from("customer_storages")
      .update({
        status:     "CANCELLED",
        updated_at: new Date().toISOString(),
      })
      .in("id", sourceIds);

    if (cancelErr) {
      return NextResponse.json({ error: cancelErr.message }, { status: 500 });
    }

    // 작업지시서 생성 (관리자가 물리적으로 물품 이전해야 함)
    const { data: workOrder, error: woErr } = await supabase
      .from("storage_change_requests")
      .insert({
        user_id:            user.id,
        storage_id,
        request_type:       "MERGE_SLOTS",
        source_storage_ids: sourceIds,
        customer_note:      body.customer_note ?? null,
      })
      .select()
      .single();

    if (woErr) {
      console.error("[change-request MERGE_SLOTS]", woErr);
    }

    return NextResponse.json({
      request:          workOrder,
      applied:          true,
      cancelled_slots:  sourceIds.length,
      message:          `${sourceIds.length}개 슬롯이 합쳐졌습니다. 관리자가 물품을 이전합니다.`,
    }, { status: 201 });
  }

  // ────────────────────────────────────────────────────────
  // TRANSFER_ITEMS: 대상 스토리지 검증 (관리자 승인 필요)
  // ────────────────────────────────────────────────────────
  if (body.request_type === "TRANSFER_ITEMS") {
    if (!body.target_storage_id) {
      return NextResponse.json({ error: "이동 대상 보관함(target_storage_id)이 필요합니다." }, { status: 400 });
    }
    if (body.target_storage_id === storage_id) {
      return NextResponse.json({ error: "현재 보관함과 동일한 곳으로는 이동할 수 없습니다." }, { status: 400 });
    }
    const { data: targetStorage } = await supabase
      .from("customer_storages")
      .select("id")
      .eq("id", body.target_storage_id)
      .eq("user_id", user.id)
      .neq("status", "CANCELLED")
      .maybeSingle();
    if (!targetStorage) {
      return NextResponse.json({ error: "이동 대상 보관함을 찾을 수 없습니다." }, { status: 404 });
    }
  }

  // 중복 PENDING 요청 방지 (승인 필요 타입만)
  const { data: existing } = await supabase
    .from("storage_change_requests")
    .select("id")
    .eq("storage_id", storage_id)
    .eq("request_type", body.request_type)
    .eq("status", "PENDING")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "이미 처리 대기 중인 동일 요청이 있습니다." },
      { status: 409 }
    );
  }

  // 그 외 (CONVERT_TO_LONG_TERM, TRANSFER_ITEMS, ADD_SLOT) → 관리자 승인 대기
  const { data, error } = await supabase
    .from("storage_change_requests")
    .insert({
      user_id:              user.id,
      storage_id,
      request_type:         body.request_type,
      requested_type_id:    body.requested_type_id ?? null,
      requested_type_code:  body.requested_type_code ?? null,
      requested_plan_type:  body.requested_plan_type ?? null,
      customer_note:        body.customer_note ?? null,
      target_storage_id:    body.target_storage_id ?? null,
      source_storage_ids:   body.source_storage_ids ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[change-request POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ request: data }, { status: 201 });
}

/**
 * GET /api/storage/[id]/change-request
 * 해당 스토리지의 변경 요청 목록 조회
 */
export async function GET(req: NextRequest, { params }: Params) {
  void req;
  const { id: storage_id } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("storage_change_requests")
    .select("id, request_type, status, customer_note, admin_note, created_at, processed_at, requested_type_code, source_storage_ids")
    .eq("storage_id", storage_id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
}
