/**
 * 피킹 / 출고처리 테스트용 목업 데이터 삽입 스크립트
 * 실행: node scripts/seed-mock.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SUPABASE_URL = "https://xycypbmjsmkbhvwkmbxy.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5Y3lwYm1qc21rYmh2d2ttYnh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA5MTM0MCwiZXhwIjoyMDk0NjY3MzQwfQ.a2xCdpfI_eeNev1DULFfL15kX8tQdUWTAa5lD3Ko9fg";

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const headers = {
  "Content-Type": "application/json",
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  Prefer: "return=minimal",
};

function daysAgo(n) {
  return new Date(Date.now() - n * 86400_000).toISOString();
}
function hoursAgo(n) {
  return new Date(Date.now() - n * 3600_000).toISOString();
}

async function restInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt);
  }
}

async function main() {
  console.log("\n목업 데이터 삽입 시작...\n");

  // ── 기존 고객 조회 ──────────────────────────────────────
  const { data: customers, error: custErr } = await db
    .from("customers")
    .select("id, email, name, customer_code")
    .order("created_at", { ascending: true })
    .limit(3);

  if (custErr || !customers?.length) {
    console.error("customers 테이블에 데이터가 없습니다.");
    console.log("Supabase 대시보드에서 테스트 계정을 먼저 생성하거나 앱에서 회원가입 후 다시 실행하세요.");
    process.exit(1);
  }

  const c1 = customers[0];
  const c2 = customers[1] ?? customers[0];
  console.log("사용할 고객:");
  customers.forEach((c) => console.log(`  - ${c.name ?? c.email} (${c.customer_code})`));
  console.log();

  const now = Date.now();
  const P1 = randomUUID(), P2 = randomUUID(), P3 = randomUUID(),
        P4 = randomUUID(), P5 = randomUUID();
  const O1 = randomUUID(), O2 = randomUUID(), O3 = randomUUID();
  const D1 = randomUUID();

  // ── 기존 로케이션 조회 ───────────────────────────────────
  const { data: locations } = await db
    .from("storage_locations")
    .select("id, code")
    .order("code", { ascending: true })
    .limit(5);

  const locs = locations ?? [];
  if (locs.length > 0) {
    console.log("사용할 로케이션:");
    locs.forEach((l) => console.log(`  - ${l.code}`));
  } else {
    console.log("  (로케이션 없음 — 소포에 위치 미지정으로 생성됨)");
  }
  console.log();

  // ── 1. 소포 (로케이션 할당) ──────────────────────────────
  const parcelRows = [
    { id: P1, customer_id: c1.id, tracking_no: `MOCK-JP-${now}-1`, status: "INBOUND", item_count: 2, weight_actual: 850,  inbound_at: daysAgo(2), storage_location_id: locs[0]?.id ?? null },
    { id: P2, customer_id: c1.id, tracking_no: `MOCK-JP-${now}-2`, status: "INBOUND", item_count: 1, weight_actual: 420,  inbound_at: daysAgo(2), storage_location_id: locs[1]?.id ?? locs[0]?.id ?? null },
    { id: P3, customer_id: c2.id, tracking_no: `MOCK-US-${now}-1`, status: "INBOUND", item_count: 2, weight_actual: 1200, inbound_at: daysAgo(3), storage_location_id: locs[2]?.id ?? locs[0]?.id ?? null },
    { id: P4, customer_id: c2.id, tracking_no: `MOCK-US-${now}-2`, status: "INBOUND", item_count: 2, weight_actual: 680,  inbound_at: daysAgo(3), storage_location_id: locs[3]?.id ?? locs[0]?.id ?? null },
    { id: P5, customer_id: c1.id, tracking_no: `MOCK-KR-${now}-1`, status: "INBOUND", item_count: 2, weight_actual: 540,  inbound_at: daysAgo(1), storage_location_id: locs[4]?.id ?? locs[0]?.id ?? null },
  ];
  await restInsert("parcels", parcelRows);
  console.log("  parcels (5)");

  const { data: pRows } = await db.from("parcels").select("id, tracking_no").in("id", [P1, P2, P3, P4, P5]);
  const tMap = Object.fromEntries((pRows ?? []).map((r) => [r.id, r.tracking_no]));

  // ── 2. 바코드 ────────────────────────────────────────────
  const barcodes = [
    { parcel_id: P1, barcode_no: `${tMap[P1]}-01`, seq: 1, item_name: "Nintendo Switch 게임팩" },
    { parcel_id: P1, barcode_no: `${tMap[P1]}-02`, seq: 2, item_name: "피규어 세트" },
    { parcel_id: P2, barcode_no: `${tMap[P2]}-01`, seq: 1, item_name: "코스메틱 세트" },
    { parcel_id: P3, barcode_no: `${tMap[P3]}-01`, seq: 1, item_name: "운동화 (Nike Air)" },
    { parcel_id: P3, barcode_no: `${tMap[P3]}-02`, seq: 2, item_name: "반팔 티셔츠" },
    { parcel_id: P4, barcode_no: `${tMap[P4]}-01`, seq: 1, item_name: "백팩" },
    { parcel_id: P4, barcode_no: `${tMap[P4]}-02`, seq: 2, item_name: "지갑" },
    { parcel_id: P5, barcode_no: `${tMap[P5]}-01`, seq: 1, item_name: "스킨케어 세트" },
    { parcel_id: P5, barcode_no: `${tMap[P5]}-02`, seq: 2, item_name: "마스크팩 10매" },
  ];
  await restInsert("parcel_barcodes", barcodes);
  console.log("  parcel_barcodes (9)");

  // ── 3. 해외 주문 ──────────────────────────────────────────
  const c1Name = c1.name ?? c1.email;
  const c2Name = c2.name ?? c2.email;

  const baseOrder = {
    picking_started_at: null,
    picking_done_at: null,
  };

  const orderRows = [
    {
      ...baseOrder,
      id: O1, customer_id: c1.id,
      order_no: `SPB-ORD-MOCK-${now}-1`,
      status: "PAID", shipping_method: "EMS",
      recipient_name: c1Name, recipient_phone: "090-1234-5678",
      recipient_country: "JP", recipient_address: "東京都渋谷区 1-2-3",
      item_list: [
        { name: "Nintendo Switch 게임팩", qty: 1 },
        { name: "피규어 세트", qty: 1 },
        { name: "코스메틱 세트", qty: 1 },
      ],
      created_at: daysAgo(2), updated_at: new Date().toISOString(),
    },
    {
      ...baseOrder,
      id: O2, customer_id: c2.id,
      order_no: `SPB-ORD-MOCK-${now}-2`,
      status: "PICKING", shipping_method: "EMS_PREMIUM",
      recipient_name: c2Name, recipient_phone: "+1-555-0100",
      recipient_country: "US", recipient_address: "123 Main St, New York, NY 10001",
      item_list: [
        { name: "운동화 (Nike Air)", qty: 1 },
        { name: "반팔 티셔츠", qty: 1 },
        { name: "백팩", qty: 1 },
        { name: "지갑", qty: 1 },
      ],
      picking_started_at: hoursAgo(0.5),
      created_at: daysAgo(3), updated_at: new Date().toISOString(),
    },
    {
      ...baseOrder,
      id: O3, customer_id: c1.id,
      order_no: `SPB-ORD-MOCK-${now}-3`,
      status: "PICKING_DONE", shipping_method: "KPACKET",
      recipient_name: c1Name, recipient_phone: "090-9999-1111",
      recipient_country: "JP", recipient_address: "大阪府大阪市中央区 5-10",
      item_list: [{ name: "코스메틱 세트", qty: 2 }],
      picking_started_at: hoursAgo(2),
      picking_done_at: hoursAgo(1),
      created_at: daysAgo(4), updated_at: new Date().toISOString(),
    },
  ];
  await restInsert("orders", orderRows);
  console.log("  orders (3)");

  // ── 4. order_parcels ─────────────────────────────────────
  await restInsert("order_parcels", [
    { order_id: O1, parcel_id: P1 },
    { order_id: O1, parcel_id: P2 },
    { order_id: O2, parcel_id: P3 },
    { order_id: O2, parcel_id: P4 },
  ]);
  console.log("  order_parcels (4)");

  // ── 5. 국내 주문 ─────────────────────────────────────────
  await restInsert("domestic_orders", [
    {
      id: D1, customer_id: c1.id,
      recipient_name: c1Name, recipient_phone: "010-9999-1234",
      recipient_zip: "06292",
      recipient_addr1: "서울시 강남구 테헤란로 521",
      recipient_addr2: "",
      parcel_ids: [P5],
      status: "PENDING",
      items_desc: "스킨케어 세트, 마스크팩",
      delivery_msg: "부재 시 경비실에 맡겨주세요",
      created_at: daysAgo(1), updated_at: new Date().toISOString(),
    },
  ]);
  console.log("  domestic_orders (1)");

  // ── 결과 ─────────────────────────────────────────────────
  const locStr = (idx) => locs[idx]?.code ?? locs[0]?.code ?? "미지정";
  console.log(`
완료!

[피킹 지시서 /picking 에 표시]
  PAID    : SPB-ORD-MOCK-${now}-1  (${c1Name}, JP, 3개)  로케이션: ${locStr(0)}, ${locStr(1)}
  PICKING : SPB-ORD-MOCK-${now}-2  (${c2Name}, US, 4개)  로케이션: ${locStr(2)}, ${locStr(3)}
  PENDING : 국내주문  (${c1Name}, 국내, 2개)  로케이션: ${locStr(4)}

[출고처리 /outbound 에 표시]
  PICKING_DONE : SPB-ORD-MOCK-${now}-3  (${c1Name}, JP)

[피킹 스캔 테스트용 바코드 - 주문 MOCK-${now}-1]
  ${tMap[P1]}-01  Nintendo Switch 게임팩  (로케이션: ${locStr(0)})
  ${tMap[P1]}-02  피규어 세트             (로케이션: ${locStr(0)})
  ${tMap[P2]}-01  코스메틱 세트           (로케이션: ${locStr(1)})
`);
}

main().catch((e) => {
  console.error("오류:", e.message ?? e);
  process.exit(1);
});
