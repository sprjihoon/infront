# 인프론트 개발 현황

> **최종 갱신:** 2026-06-23  
> **DB 마이그레이션:** `001` ~ `066` (+ `999_mock_seed.sql`)

이 문서는 [README.md](../README.md)의 로드맵·기능 표를 보완하는 **상세 개발 일지**입니다.  
기능 단위로 완료/진행/예정을 추적하고, README는 온보딩·아키텍처 개요용으로 유지합니다.

---

## 아키텍처 핵심 결정 사항

### 보관 서비스 통합 (구 `/warehouse` 제거)

고객 Web의 `/warehouse`·`/warehouse/[id]` 페이지는 **2026-06-16 제거**되었으며 `/storage`로 **301 리다이렉트**합니다. 물품 목록·출고 연동은 `/storage`·`/storage/[id]`가 담당합니다.

```
고객 물품 수거/직접발송
         ↓
    parcels 테이블
         ↓
    /storage · /storage/[id]  (블록 보관함 + 물품 목록)
```

**남은 통합 작업 (선택):**
- `customer_storage_items.parcel_id` FK 추가 → 기존 소포와 명시적 연결

---

## Phase 3 — 고객 보관 서비스 (완료된 항목)

> PDF 기반 스토리지 결제·보관 서비스 구현. KG Inicis 계약 기준.

| 단계 | 상태 | 비고 |
|------|------|------|
| DB 스키마 (`040`~`043`) | ✅ | `customer_storages`, `customer_storage_items`, `storage_payments`, `storage_recurring_profiles`, `storage_escalation_logs`, `PENDING_PAYMENT` 상태 추가 |
| 수거 박스 요금 DB (`044`) | ✅ | `pickup_box_fees` — 관리자가 설정 가능, 크기별 동적 요금 |
| Web 고객 스토리지 대시보드 | ✅ | `/storage`, `/storage/[id]`, `/storage/new` |
| Admin 고객 보관 관리 | ✅ | `/customer-storages`, `/customer-storages/[id]` |
| Admin 수거 요금 설정 | ✅ | `/settings/pickup-fees` — 박스 크기별 요금 인라인 편집 |
| 수거비 동적 계산 | ✅ | 하드코딩 3,000원 제거 → DB `pickup_box_fees` 기준 |
| 단기보관 결제 API | ✅ | `/api/storage/pay/prepare` (KG Inicis), `/api/inicis/storage-return` |
| 결제 성공/실패 페이지 | ✅ | `/storage/payment/success`, `/storage/payment/fail` |
| 하단 네비 "스토리지" 탭 연결 | ✅ | `/warehouse` → `/storage` 로 변경 |

### DB 마이그레이션 적용 방법 (CLI)
```bash
supabase db query --linked --file apps/sql/040_customer_storages.sql
supabase db query --linked --file apps/sql/041_storage_payments.sql
supabase db query --linked --file apps/sql/042_storage_recurring_profiles.sql
supabase db query --linked --file apps/sql/043_storage_status_pending_payment.sql
supabase db query --linked --file apps/sql/044_pickup_box_fees.sql
```

---

## 개발 로드맵 (우선순위 순)

> **범례:** ✅ 완료 · 🔄 진행 중 · 🔲 예정 · ⏸ 다음 단계 (계약/조건 필요)

### Phase 3.5 — 구 웨어하우스 → 스토리지 통합 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| `/storage` 통합 뷰 | ✅ | 캐러셀·물품 목록·출고 연동 |
| `/warehouse` 페이지 제거 | ✅ | `next.config` → `/storage` 리다이렉트 |
| 앱 내 `/warehouse` 링크 정리 | ✅ | 홈·출고·알림·주문 등 → `/storage` |
| `parcel-display` warehouse 전용 필터 제거 | ✅ | `getParcelDisplaySummary` 등 공용 유지 |

---

### Phase 4 — 장기보관 빌링 (6순위) 🔲

> 월정액 자동결제. **KG Inicis 빌링(정기결제) 계약 완료 후 실연동**  
> `storage_recurring_profiles` 스키마는 이미 준비됨(`042.sql`). 로직 먼저 개발.

| 항목 | 상태 | 비고 |
|------|------|------|
| 빌링 로직 설계 | 🔲 | 매월 n일 자동청구, 실패 시 에스컬레이션 연동 |
| BillKey 발급·저장 흐름 | 🔲 | KG Inicis 빌링 API, `storage_recurring_profiles` 활용 |
| 월정액 Cron | 🔲 | `/api/cron/storage-billing` |
| 관리자 빌링 현황 | 🔲 | 자동결제 성공/실패 목록 |
| **실연동 조건** | ⏸ | **KG Inicis 빌링 계약 완료 후 진행** |

---

### Phase 5 — 단기→장기 전환 cron (7순위) 🔲

> Phase 4 직후 진행. 단기보관 임계점 도달 시 자동 플랜 전환.

| 항목 | 상태 | 비고 |
|------|------|------|
| 전환 조건 정의 | 🔲 | 보관 기간 n주 초과 또는 고객 명시 전환 요청 |
| 전환 cron | 🔲 | `/api/cron/storage-convert` |
| 고객 전환 알림 | 🔲 | 이메일/인앱 알림 (D-7, D-3, D-1) |
| **선행 조건** | ⏸ | **Phase 4 장기보관 빌링 완료 후 진행** |

---

### Phase 6 — 결제 실패 에스컬레이션 cron (4순위) 🔲

> 결제 실패 시 D+0/3/7/14/30 단계별 자동 처리 Cron

| 항목 | 상태 | 비고 |
|------|------|------|
| 에스컬레이션 cron 엔드포인트 | 🔲 | `/api/cron/storage-escalation` |
| D+0: 즉시 재시도 + 알림 | 🔲 | `storage_escalation_logs` 활용 |
| D+3·D+7: 재시도 + 경고 | 🔲 | |
| D+14: SUSPENDED 처리 | 🔲 | 보관함 접근 제한 + 출고 안내 |
| D+30: OVERDUE + 운영팀 에스컬레이션 | 🔲 | |
| 관리자 에스컬레이션 현황 뷰 | 🔲 | `storage_escalation_logs` 테이블 활용 |
| 재결제 시도 링크 발송 | 🔲 | 이메일/알림 연동 |

---

### Phase 7 — 해외배송 오픈 확인비 (5순위) 🔲

> 기존 해외배송 흐름에 "보관 물품 오픈 확인" 서비스 요금 추가. 기존 기능 확장.

| 항목 | 상태 | 비고 |
|------|------|------|
| 오픈확인 서비스 옵션 추가 | 🔲 | `/shipping-request` step 2에서 선택 |
| 견적 API 항목 반영 | 🔲 | `/api/ems/quote` 확장 |
| 결제 단계 포함 처리 | 🔲 | 기존 배송 결제 흐름 확장 |
| 관리자 처리 플로우 | 🔲 | 오픈 후 사진 업로드 → 고객 확인 |

---

### Phase 8 — 글로벌 결제 (8순위) ⏸ 다음 개발 단계

> ⚠️ **별도 글로벌 PG 계약 완료 후 착수하는 다음 개발 단계입니다.**  
> 현재 개발 사이클에서는 진행하지 않습니다. 계약 완료 시 별도 스프린트로 분리.

| 항목 | 상태 | 비고 |
|------|------|------|
| 글로벌 PG 벤더 선정·계약 | ⏸ | PayPal / Stripe / Alipay 등 검토 |
| 해외 카드 결제 흐름 | ⏸ | 계약 후 착수 |
| 다국어 결제 UI (KO/EN) | ⏸ | 계약 후 착수 |
| 다중 통화 (USD, CNY, EUR) | ⏸ | 계약 후 착수 |
| 위챗페이·알리페이 | ⏸ | 계약 후 착수 |
| 환율 기반 결제 금액 | ⏸ | USD/KRW 실시간 환율 적용 |

> 현재 KG Inicis(국내) 기반 서비스 안정화 및 Phase 3~7 완료를 우선합니다.

---

## 문서 운영 규칙

| 문서 | 용도 | 갱신 시점 |
|------|------|-----------|
| `docs/DEVELOPMENT_STATUS.md` (이 파일) | 기능별 상세 현황, 최근 작업, 미커밋 작업 | 기능 완료·배포 직후 |
| `README.md` | 서비스 소개, API 목록, Phase 로드맵 체크리스트 | Phase 전환·대표 기능 완료 시 |
| `apps/sql/*.sql` | DB 스키마 변경 이력 (파일명 = 순번) | 마이그레이션 추가 시 |
| (선택) `CHANGELOG.md` | 릴리스 노트 | 프로덕션 배포 시 |

---

## 전체 디렉토리 구조

```
infront/
├── apps/web/       # 고객 웹 (infront.kr) — Next.js 16
├── apps/admin/     # 관리자 (admin.infront.kr) — Next.js 16
├── apps/sql/       # Postgres DDL (001~060 + 999_mock_seed)
├── supabase/       # Supabase CLI 설정
└── docs/           # 개발·설계 문서
```

**핵심 연동:** Supabase (Auth/DB/RLS) · KG Inicis (국내 결제/빌링) · 우체국 ePost API (국내수거/EMS) · tracker.delivery (타택배 추적) · Cloudflare Stream (영상)

---

## Phase 1 — 고객 핵심 플로우 ✅ 완료

| 영역 | 상태 | 비고 |
|------|------|------|
| Supabase 스키마 + RLS | ✅ | `001`~`017` 적용 기준 |
| 회원가입 → 고객번호·입고주소 자동 발급 | ✅ | `018` 트리거 중복 호출 수정 |
| 수거 신청 (우체국 ePost) | ✅ | SEED128, 다박스·박스 규격 선택 |
| 수거 취소 + GetResInfo 상태 조회 | ✅ | `PICKUP_CANCELLED` 상태 |
| **수거 취소 안정성 강화** | ✅ | ERR-211(reqNo 누락) graceful 처리, `\|\|` fallback 수정 |
| 스토리지 (웨어하우스) | ✅ | 상태 필터, 검색, 다중 선택 |
| 물품 직접 등록 | ✅ | 타택배·직접 발송 경로 |
| 해외배송 신청 (다단계) | ✅ | 다중 박스, 인보이스, 주소록 |
| EMS/K-Packet 견적 | ✅ | 사이드바 계산기 + `/shipping-calc` |
| 주문 생성·배송현황 | ✅ | `/orders`, 6탭 하단 네비 |
| 결제 (Toss) | ✅ | confirm API |
| 서비스 카탈로그 DB | ✅ | 검수·포장·박스배송 코드 |
| 반품·검수 결과 DB | ✅ | UI 일부, 워크플로우 미완 |
| 관리자 기본 CRUD | ✅ | 입고·주문·반품 목록/상세 |
| 관리자 EMS 접수 API | ✅ | 세관신고 매핑 |

---

## Phase 1.5 — 결제·운영 자동화 ✅ 완료

### 고객 웹 (`apps/web`)

| 기능 | 상태 | 관련 커밋/파일 |
|------|------|----------------|
| 홈 액션 대시보드 | ✅ | "지금 할 일" 카드, 결제·검수·출고 안내 |
| 일반/고급 입력 모드 전역 토글 | ✅ | 수거·등록 단계별 UI |
| 신청 완료 주문 취소 | ✅ | 출고 플로우 보완 |
| 우체국 공식 요금표·이용 가이드 | ✅ | `/pricing`, `/guide` |
| 실측값 기반 견적 확정 | ✅ | 관리자 실측 → 고객 결제 |
| 결제 후 EMS 자동 접수 | ✅ | `payment/confirm` → ePost InsertOrder |
| EMS 보험 옵션 | ✅ | `016_orders_insurance.sql`, 견적·접수 연동 |
| 고객 알림 | ✅ | 단계별 in-app 알림 |
| 국제 추적 Cron | ✅ | `vercel.json` → `/api/cron/sync-intl-tracking` (6시간) |
| **EMS 보험료/배송료 분리 표시** | ✅ | 보험 포함 시 배송료·보험료 각각 표시 |
| **인보이스 단가·품목명 필수 입력** | ✅ | 단가 0이하/빈값 시 빨간 테두리·오류 메시지 |
| **USD-KRW 환율 동기화** | ✅ | 관세청 주간환율 Cron 연동 |

### 관리자 (`apps/admin`)

| 기능 | 상태 |
|------|------|
| EMS/K-Packet 접수 | ✅ |
| 배송 라벨 출력 | ✅ |
| 견적 원가·마진 분리 | ✅ |
| 대시보드 통계 카드 | ✅ |

---

## Phase 1.6 — 스토리지 관리 시스템 ✅ 완료

| 기능 | 상태 | 관련 SQL/파일 |
|------|------|--------------|
| 스토리지 로케이션 DB | ✅ | `026~031.sql` |
| 로케이션 현황·상세 페이지 | ✅ | Zone 그리드, 리터 용량 바 |
| 입고처리 전용 페이지 + 내부 바코드 | ✅ | `032.sql`, `/inbound` |
| 스토리지 타입 용량·요금 관리 UI | ✅ | `/storage/manage` |
| 리터=포인트 자동 배정 | ✅ | `033~035.sql`, 단계적 업사이징 + 분할 배정 |
| parcel_size_code MINI/STANDARD/LONG/XL/OVERSIZE 통일 | ✅ | `035_parcel_size_code_migrate.sql` |
| 수거신청 시점 size code 자동 저장 | ✅ | `api/pickup/route.ts` |
| 로케이션 이동처리 전용 페이지 | ✅ | `/transfer`, 바코드 2-스캔 |
| 소포 위치 이동 이력 타임라인 | ✅ | `parcel_location_events` |
| 스토리지 타입 가격·용량 인라인 편집 | ✅ | 주간요금/상한요금/최대건수 |
| 국내배송 계산기 사이드바 위젯 | ✅ | `SidebarDomesticCalculator.tsx` |

---

## Phase 1.7 — 피킹·출고 워크플로우 ✅ 완료

| 기능 | 상태 | 관련 SQL/파일 |
|------|------|--------------|
| 아이템 단위 보관 위치 | ✅ | `036.sql` — `parcel_barcodes.storage_location_id` |
| 주문 상태 확장 (PICKING/PICKING_DONE/OUTBOUND_WAIT) | ✅ | `037_outbound_picking.sql` |
| 피킹 아이템 상태 (WAITING/DONE/HOLD/NOT_FOUND) | ✅ | `038_picking_item_tracking.sql` |
| 피킹 스캔 로그 테이블 | ✅ | `picking_scan_logs` |
| 출고 세션 테이블 | ✅ | `038_outbound_sessions.sql` — `outbound_sessions` |
| 관리자 피킹 목록 `/picking` | ✅ | PAID 주문 목록 (국제/국내 통합) |
| 관리자 피킹 상세 `/picking/[id]` | ✅ | 바코드 스캔 → 물품별 상태 처리 |
| 관리자 출고 목록 `/outbound` | ✅ | PICKING_DONE 주문 출고 대기 |
| 관리자 출고 세션 `/outbound/[id]` | ✅ | 박스 스캔, 영상 업로드 |
| Cloudflare Stream 출고 영상 업로드 | ✅ | tus 청크 업로드 |
| 국내 주문 목록·상세·라벨 | ✅ | `/domestic-orders/*` |
| 패킹 슬립 출력 | ✅ | `/orders/[id]/packing-slip` |
| 테스트용 목업 시드 | ✅ | `999_mock_seed.sql` |

### 피킹·출고 흐름

```
PAID
  ↓ [관리자] 피킹 시작
PICKING  ← 창고 직원이 물품 위치 이동
  ↓ [관리자] 전체 아이템 스캔 완료 (DONE/HOLD/NOT_FOUND)
PICKING_DONE
  ↓ [관리자] 출고 세션 생성
OUTBOUND_WAIT  ← 포장·측정·영상 촬영
  ↓ [관리자] 출고 완료 + EMS/ePost 접수
IN_TRANSIT
```

---

## DB 마이그레이션 전체 현황

| 파일 | 내용 | 상태 |
|------|------|------|
| `001`~`017` | 초기 스키마, 수거, EMS, 추적, 반품 등 | ✅ |
| `018_fix_handle_new_user.sql` | 가입 트리거 수정 | ✅ |
| `019_orders_quote_margin.sql` | 견적 EMS 원가·마진 | ✅ |
| `020_parcel_inbound_source.sql` | 입고 경로 구분 | ✅ |
| `021_inbound_sync_schedule.sql` | admin_config 스케줄 | ✅ |
| `022_ems_usd_krw_rate.sql` | 환율 Cron | ✅ |
| `023_orders_duty_ddp.sql` | DDP 옵션 | ✅ |
| `024_domestic_orders.sql` | 국내 배송 주문 | ✅ |
| `025_domestic_orders_v2.sql` | 국내 배송 확장 | ✅ |
| `026~031` | 스토리지 로케이션/Zone/타입/뷰 | ✅ |
| `032_parcel_barcodes.sql` | 내부 바코드 | ✅ |
| `033_storage_capacity.sql` | 로케이션 용량 상한 | ✅ |
| `034_parcel_size_code.sql` | size code 컬럼 | ✅ |
| `035_parcel_location_history.sql` | 위치 이동 이력 | ✅ |
| `035_parcel_size_code_migrate.sql` | size code 마이그레이션 | ✅ |
| `036_parcel_barcode_location.sql` | 아이템 단위 위치 | ✅ |
| `037_outbound_picking.sql` | 피킹·출고 상태 확장 | ✅ |
| `038_outbound_sessions.sql` | 출고 세션 테이블 | ✅ |
| `038_picking_item_tracking.sql` | 피킹 아이템 추적 | ✅ |
| `039_parcel_media_bucket.sql` | 미디어 스토리지 버킷 | ✅ |
| `040_customer_storages.sql` | 고객 보관 서비스 스키마 | ✅ |
| `041_storage_payments.sql` | 보관 결제 테이블 | ✅ |
| `042_storage_recurring_profiles.sql` | 정기결제 프로파일 | ✅ |
| `043_storage_status_pending_payment.sql` | PENDING_PAYMENT 상태 추가 | ✅ |
| `044_pickup_box_fees.sql` | 수거 박스 크기별 요금 | ✅ |
| `045_capacity_item_count.sql` | 용량 시스템 리팩터 — 최대 건수 기반 용량 점수 전환 | ✅ |
| `046_parcel_storage_link.sql` | `parcels.customer_storage_id` FK, auto_link 트리거 | ✅ |
| `047_mock_parcel_items.sql` + `047b` | MOCK 데이터 pre_invoice_items 채우기 | ✅ (개발용) |
| `048_parcel_storage_link_shippable.sql` | SHIPPABLE 상태 소포 customer_storage_id 자동 연결 | ✅ |
| `049_storage_card_color.sql` | `customer_storages.card_color` — 블록 색상 선택 | ✅ |
| `050_storage_type_price_per_month.sql` | `storage_types.price_per_month` 장기보관 월정액 | ✅ |
| `051_oversize_price_fix.sql` | OVERSIZE 29,900원/월 확정, price_max NULL 처리 | ✅ |
| `053_storage_transfer_items.sql` | `target_storage_id` + `TRANSFER_ITEMS` 변경요청 타입 | ✅ |
| `054_storage_merge_slots.sql` | `source_storage_ids UUID[]` + `MERGE_SLOTS` 타입 | ✅ |
| `055_capacity_score_numeric.sql` | `capacity_score`/`used_score` INTEGER → NUMERIC(8,2) | ✅ |
| `056_customer_storages_storage_type_id.sql` | `customer_storages.storage_type_id` FK 추가 | ✅ |
| `057_storage_type_names.sql` | 블록 명칭 변경 (파인트/싱글/더블/패밀리/하프블록) | ✅ |
| `058_inbound_putaway_flow.sql` | 입고 2단계: `planned_storage_location_id`, 적치 사진 | ✅ |
| `059_putaway_photo_customer_rls.sql` | 고객 RLS: 본인 소포 `PUTAWAY_PHOTO` 조회 허용 | ✅ |
| `060_claim_available_location.sql` | `claim_available_location()` — `SKIP LOCKED` 원자적 선점 | ✅ |
| `061_shop_orders.sql` | `shop_orders` 테이블 — 비회원 포장대행 결제 주문 | ✅ |
| `062_backfill_recipient_addr.sql` | `orders.recipient_addr1/2/3` 백필 (기존 주문 정규화) | ✅ |
| `063_shop_orders_cancel_fields.sql` | `shop_orders` 취소(`cancelled_at`, `cancel_msg`) + `admin_memo` 컬럼 추가 | ✅ |
| `064_payment_type_expand.sql` | `storage_payments` — `LONG_TERM_FIRST` 타입, `WAITING_VBANK` 상태, 가상계좌 컬럼 추가 | ✅ |
| `065_customer_avatar.sql` | `customers.avatar_url` + `avatars` Storage 버킷 RLS | ✅ |
| `066_social_login.sql` | 소셜 로그인 — `customers.email` NULL 허용, `login_provider` 컬럼, `handle_new_user` 트리거 업데이트 | ✅ |
| `999_mock_seed.sql` | 테스트 목업 데이터 | ✅ (개발용) |

---

## 버그픽스 이력

### 2026-05-28 — SEED128 암호화 핵심 버그 수정 (커밋 `5b8774a`)

> **모든 수거 신청 API 호출이 실패하던 근본 원인**

| 버그 | 원인 | 수정 파일 |
|------|------|-----------|
| **모든 InsertOrder 호출 실패** (ERR-311 / ERR-322 / ERR-521 등) | SEED128 룩업 테이블 `SS1[109]` 값 오류: `0x04000404` → **`0x04040400`** | `lib/epost/seed128.ts` — SS1[109] 수정 |
| `inqTelCn` 필드 매핑 오류 | `buildReturnPickupOrderParams`에서 문의전화를 수거지 전화로 잘못 할당 | `lib/epost/pickup-order.ts` — `centerPhone`으로 수정 |

### 2026-05-27 — 우체국 ePost API 관련

| 버그 | 원인 | 수정 파일 |
|------|------|-----------|
| 수거 취소 ERR-211: reqNo 값이 없습니다 | EPost 파서 reqNo 인식 실패 | `api/pickup/[id]/route.ts` — ERR-211 graceful 처리 |
| reqNo/resNo 빈 문자열 fallback 누락 | `??` 연산자가 빈 문자열을 건너뜀 | `\|\|` 연산자로 교체 |
| getResInfo ERR-111: reqYmd UTC 날짜 | UTC 기준 날짜 — KST 새벽에 하루 이전으로 계산 | `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })` |
| `buildKeyedPlaintext` required 필드 silent skip | required+undefined 조합 시 오류 없이 건너뜀 | 즉시 throw로 수정 |

---

## 기타 진행 중 작업

### 입고 자동 동기화

국내 입고 전 구간(수거 중·배송 중) 상태를 API로 자동 갱신합니다.

| 구분 | API | 대상 |
|------|-----|------|
| `PICKUP` | 우체국 GetResInfo | 앱 수거 신청 물품 |
| `DIRECT` | tracker.delivery | 물품등록·타택배 |

**구현 파일**

- `apps/web/lib/parcels/inbound-sync.ts` — 배치 동기화 로직
- `apps/admin/lib/parcels/inbound-sync.ts` — admin용
- `apps/web/app/api/cron/sync-inbound/route.ts` — Vercel Cron (KST 평일, ICN1)
- `apps/admin/app/api/admin/parcels/sync-inbound/route.ts` — 수동 동기화
- `apps/admin/components/parcels/InboundSyncSchedulePanel.tsx` — 스케줄 설정 UI

**Cron (`vercel.json`)**

```json
{ "path": "/api/cron/sync-inbound", "schedule": "0 0-9 * * *" }
```

### 관리자 고객 관리 (진행 중)

- `apps/admin/app/(dashboard)/customers/page.tsx` — 고객 검색·목록
- `apps/admin/app/(dashboard)/customers/[code]/page.tsx` — 고객별 물품·주문

---

## API 엔드포인트 (최근 추가)

| Method | Path | 설명 |
|--------|------|------|
| GET, PATCH | `/api/admin/picking/[id]` | 피킹 세션 조회/상태 업데이트 |
| POST, PATCH | `/api/admin/picking/[id]/scan` | 피킹 바코드 스캔 처리 |
| PATCH | `/api/admin/picking/[id]/items` | 피킹 아이템 일괄 업데이트 |
| GET, PATCH | `/api/admin/outbound/[id]` | 출고 세션 조회/업데이트 |
| POST, PATCH | `/api/admin/outbound/[id]/session` | 출고 세션 생성/완료 |
| POST, PATCH | `/api/admin/outbound/[id]/stream-upload` | Cloudflare Stream 영상 업로드 |
| GET | `/api/admin/outbound/scan` | 출고 바코드 스캔 |
| GET, POST, PATCH | `/api/admin/domestic-orders/[id]` | 국내 주문 조회/업데이트 |
| GET | `/api/cron/sync-inbound` | 입고 전 구간 Cron (CRON_SECRET) |
| POST | `/api/admin/parcels/sync-inbound` | admin 수동 입고 동기화 |
| GET, PATCH | `/api/admin/settings/inbound-sync` | 동기화 스케줄 설정 |
| GET, POST | `/api/storage` | 고객 보관 서비스 목록/생성 |
| GET, PATCH | `/api/storage/[id]` | 보관 서비스 상세/업데이트 |
| GET, POST | `/api/storage/[id]/items` | 보관 아이템 목록/추가 |
| GET | `/api/storage/plans` | 보관 플랜 목록 |
| GET | `/api/storage/box-fees` | 수거 박스 요금 목록 |
| POST | `/api/storage/pay/prepare` | KG Inicis 결제 준비 |
| POST | `/api/inicis/storage-return` | KG Inicis 결제 콜백 |
| GET | `/api/admin/customer-storages` | 관리자 보관 서비스 목록 |
| GET, PATCH | `/api/admin/customer-storages/[id]` | 관리자 보관 서비스 상세 |
| PATCH | `/api/admin/customer-storages/[id]/items/[itemId]` | 관리자 아이템 상태 업데이트 |
| GET, PATCH | `/api/admin/pickup-box-fees` | 수거 박스 요금 관리 |

---

## 변경 이력 (문서)

| 날짜 | 변경 |
|------|------|
| 2026-05-27 | 최초 작성 — Phase 1 완료, Phase 1.5·입고 동기화 진행 현황 정리 |
| 2026-05-28 | SEED128 SS1[109] 핵심 버그 수정. inqTelCn 매핑 수정 |
| 2026-06-04 | Phase 1.6 스토리지 시스템, Phase 1.7 피킹·출고 워크플로우 완료 반영. 전체 마이그레이션 현황 갱신 (001~038) |
| 2026-06-09 | Phase 3 고객 보관 서비스 완료 현황 반영 (040~044). 수거비 동적 계산, Admin 요금 설정 UI. Phase 4~8 로드맵 추가 및 번호 재정렬 (4=장기빌링, 5=단기→장기전환cron, 6=에스컬레이션, 7=오픈확인비, 8=글로벌결제). 웨어하우스+보관 서비스 통합 아키텍처 결정 사항 추가 |
| 2026-06-18 | DB 마이그레이션 현황 갱신 (045~060). 성능 최적화 1단계 반영: `/api/storage/dashboard` 통합 엔드포인트, `storage_types` 1시간 캐시, 스토리지 페이지 API 요청 4개→1개 |
| 2026-06-21 | 소셜 로그인 구현 (카카오/네이버/구글/애플). DB 마이그레이션 `066_social_login.sql`. Supabase Edge Function `naver-auth` 배포 |
| 2026-06-23 | KG Inicis MID `infront227` 발급. 실결제 환경변수 설정. 심사용 결제 라우트 전면 정비 (INIpayTest 제거, signKey 일관성, 프로덕션 JS URL 고정). DB 마이그레이션 현황 갱신 (061~066) |
