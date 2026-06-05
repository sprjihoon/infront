# 인프론트 개발 현황

> **최종 갱신:** 2026-06-04  
> **DB 마이그레이션:** `001` ~ `038` (+ `999_mock_seed.sql`)

이 문서는 [README.md](../README.md)의 로드맵·기능 표를 보완하는 **상세 개발 일지**입니다.  
기능 단위로 완료/진행/예정을 추적하고, README는 온보딩·아키텍처 개요용으로 유지합니다.

---

## 문서 운영 규칙

| 문서 | 용도 | 갱신 시점 |
|------|------|-----------|
| `docs/DEVELOPMENT_STATUS.md` (이 파일) | 기능별 상세 현황, 최근 작업, 미커밋 작업 | 기능 완료·배포 직후 |
| `README.md` | 서비스 소개, API 목록, Phase 로드맵 체크리스트 | Phase 전환·대표 기능 완료 시 |
| `apps/sql/*.sql` | DB 스키마 변경 이력 (파일명 = 순번) | 마이그레이션 추가 시 |
| (선택) `CHANGELOG.md` | 릴리스 노트 | 프로덕션 배포 시 |

---

## 프로젝트 구조 요약

```
infront/
├── apps/web/       # 고객 웹 (infront.kr) — Next.js 16
├── apps/admin/     # 관리자 (admin.infront.kr) — Next.js 16
├── apps/sql/       # Postgres DDL (001~038 + 999_mock_seed)
├── supabase/       # Supabase CLI 설정
└── docs/           # 개발·설계 문서
```

**핵심 연동:** Supabase (Auth/DB/RLS) · 토스페이먼츠 · 우체국 ePost API (국내수거/EMS) · tracker.delivery (타택배 추적) · Cloudflare Stream (영상)

---

## Phase 1 — 고객 핵심 플로우 ✅ 완료

| 영역 | 상태 | 비고 |
|------|------|------|
| Supabase 스키마 + RLS | ✅ | `001`~`017` 적용 기준 |
| 회원가입 → 고객번호·입고주소 자동 발급 | ✅ | `018` 트리거 중복 호출 수정 |
| 수거 신청 (우체국 ePost) | ✅ | SEED128, 다박스·박스 규격 선택 |
| 수거 취소 + GetResInfo 상태 조회 | ✅ | `PICKUP_CANCELLED` 상태 |
| **수거 취소 안정성 강화** | ✅ | ERR-211(reqNo 누락) graceful 처리, `||` fallback 수정 |
| 스토리지 | ✅ | 상태 필터, 검색, 다중 선택 |
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
| reqNo/resNo 빈 문자열 fallback 누락 | `??` 연산자가 빈 문자열을 건너뜀 | `||` 연산자로 교체 |
| getResInfo ERR-111: reqYmd UTC 날짜 | UTC 기준 날짜 — KST 새벽에 하루 이전으로 계산 | `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })` |
| `buildKeyedPlaintext` required 필드 silent skip | required+undefined 조합 시 오류 없이 건너뜀 | 즉시 throw로 수정 |

---

## Phase 2 — 진행 중

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

## Phase 2 — 아직 예정

README 로드맵과 동일. 피킹·출고 완료 후 우선순위 제안 순입니다.

1. **입고 자동 동기화 완료** — GetResInfo + tracker.delivery Cron 프로덕션 확인
2. **관리자 입고 처리** — 오픈박스 영상 업로드 (Cloudflare Stream)
3. **검수 결과 입력** — 사진 업로드, 발송 가능/불가/보류
4. **견적 확정 → QUOTE_SENT 알림** — 마진 필드(019) UI 연동
5. **반품 전체 워크플로우** — 시점별 처리
6. **고객 물품 타임라인** — 입고영상·검품사진·출고영상
7. **고객 관리 페이지 완성** — 네비게이션 연결

---

## Phase 3 — 예정

- FCM 푸시 알림
- EMS/K-Packet 운송장 자동 등록·고객 알림 (국제 추적 Cron 확장)
- Capacitor WebView 앱 (iOS/Android)
- 통계 대시보드 (매출·국가별·서비스별)
- 검수검품·빈박스 배송 신청 UI

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

---

## 다음 작업 체크리스트

- [ ] 입고 동기화 Cron 프로덕션 동작 확인 (KST 평일 3회)
- [ ] admin 견적 화면에 `quote_ems_cost` / `shipping_margin` 입력 UI
- [ ] 고객 관리 페이지 네비게이션 연결 (`DashboardNav`)
- [ ] 오픈박스 영상 업로드 (Cloudflare Stream) — 입고처리 화면
- [ ] 검수 결과 입력 UI + 사진 업로드
- [ ] QUOTE_SENT 알림 발송 트리거

---

## 변경 이력 (문서)

| 날짜 | 변경 |
|------|------|
| 2026-05-27 | 최초 작성 — Phase 1 완료, Phase 1.5·입고 동기화 진행 현황 정리 |
| 2026-05-28 | SEED128 SS1[109] 핵심 버그 수정. inqTelCn 매핑 수정 |
| 2026-06-04 | Phase 1.6 스토리지 시스템, Phase 1.7 피킹·출고 워크플로우 완료 반영. 전체 마이그레이션 현황 갱신 (001~038) |
