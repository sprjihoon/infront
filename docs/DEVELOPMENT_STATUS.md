# 인프론트 개발 현황

> **최종 갱신:** 2026-05-28  
> **총 커밋:** 134 · **DB 마이그레이션:** `001` ~ `022` (020·021은 미적용/작업 중)

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
├── apps/sql/       # Postgres DDL (001~021)
├── supabase/       # Supabase CLI 설정
└── docs/           # 개발·설계 문서
```

**핵심 연동:** Supabase (Auth/DB/RLS) · 토스페이먼츠 · 우체국 ePost API (국내수거/EMS) · tracker.delivery (타택배 추적) · Cloudflare Stream (영상, 예정)

---

## Phase 1 — 고객 핵심 플로우 ✅ 완료

| 영역 | 상태 | 비고 |
|------|------|------|
| Supabase 스키마 + RLS | ✅ | `001`~`017` 적용 기준 |
| 회원가입 → 고객번호·입고주소 자동 발급 | ✅ | `018` 트리거 중복 호출 수정 |
| 수거 신청 (우체국 ePost) | ✅ | SEED128, 다박스·박스 규격 선택 |
| 수거 취소 + GetResInfo 상태 조회 | ✅ | `PICKUP_CANCELLED` 상태 |
| **수거 취소 안정성 강화** | ✅ | ERR-211(reqNo 누락) graceful 처리, `||` fallback 수정 — `api/pickup/[id]/route.ts` |
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

## Phase 1.5 — 최근 완료 (커밋 기준)

2025~2026년에 Phase 1 이후 추가·보완된 기능입니다.

### 고객 웹 (`apps/web`)

| 기능 | 상태 | 관련 커밋/파일 |
|------|------|----------------|
| 홈 액션 대시보드 | ✅ | "지금 할 일" 카드, 결제·검수·출고 안내 |
| 일반/고급 입력 모드 전역 토글 | ✅ | 수거·등록 단계별 UI |
| 홈 물품 카드 UX | ✅ | 외 N건·수량 표시, 레이아웃 간소화 |
| 신청 완료 주문 취소 | ✅ | 출고 플로우 보완 |
| 우체국 공식 요금표·이용 가이드 | ✅ | `/pricing`, `/guide` |
| 실측값 기반 견적 확정 | ✅ | 관리자 실측 → 고객 결제 |
| 결제 후 EMS 자동 접수 | ✅ | `payment/confirm` → ePost InsertOrder |
| EMS 보험 옵션 | ✅ | `016_orders_insurance.sql`, 견적·접수 연동 |
| 고객 알림 | ✅ | 단계별 in-app 알림 |
| 주문 상세·마이페이지 | ✅ | 브랜드 컬러, 내역 수정 저장 |
| 국제 추적 Cron | ✅ | `vercel.json` → `/api/cron/sync-intl-tracking` (6시간) |
| **EMS 보험료/배송료 분리 표시** | ✅ | 보험 포함 시 배송료·보험료 각각 표시 — `shipping-calc/page.tsx`, `SidebarCalculator.tsx` (이중 API 호출) |
| **배송비 계산 결과 섹션 순서 조정** | ✅ | 비용 비교표 → 통관 정보 순으로 변경 |
| **인보이스 단가·품목명 필수 입력** | ✅ | 단가 0이하/빈값 시 빨간 테두리·오류 메시지, `shipping-request/page.tsx` |
| **USD-KRW 환율 동기화 환경변수** | ✅ | `PUBLIC_DATA_API_KEY`, `CRON_SECRET` — 관세청 주간환율 Cron 연동 |

### 관리자 (`apps/admin`)

| 기능 | 상태 | 관련 커밋/파일 |
|------|------|----------------|
| EMS/K-Packet 접수 | ✅ | `/api/admin/ems/apply` |
| 배송 라벨 출력 | ✅ | 보험·세관 필드 포함 |
| 견적 원가·마진 분리 | ✅ | `019_orders_quote_margin.sql` |
| 대시보드 통계 카드 | ✅ | 입고·주문·반품 집계 |

---

## 버그픽스 이력

### 2026-05-28 — SEED128 암호화 핵심 버그 수정 (커밋 `5b8774a`)

> **모든 수거 신청 API 호출이 실패하던 근본 원인**

| 버그 | 원인 | 수정 파일 |
|------|------|-----------|
| **모든 InsertOrder 호출 실패** (ERR-311 / ERR-322 / ERR-521 등) | SEED128 룩업 테이블 `SS1[109]` 값 오류: `0x04000404` → **`0x04040400`** (EPost 공식 PHP/Java 레퍼런스 기준). 이 단 하나의 상수 오류로 암호화된 페이로드가 EPost 서버에서 올바르게 복호화되지 않아, 항상 쓰레기 데이터가 검증되며 다양한 에러 코드가 무작위로 반환됐음 | `lib/epost/seed128.ts` — SS1 Uint32Array 109번째 항목 수정 |
| `inqTelCn` 필드 매핑 오류 | `buildReturnPickupOrderParams`에서 문의전화(`inqTelCn`)를 수거지 전화(`pickupPhone`)로 잘못 할당 | `lib/epost/pickup-order.ts` — `centerPhone`으로 수정 |

**왜 단독 테스트는 통과했는가**: 기존 테스트 벡터(`"123abc가나다"`)가 암호화 중 `SS1[109]` 항목을 우연히 한 번도 접근하지 않아 버그가 숨겨짐. 실제 한국어 주소·주문번호를 포함한 API 호출에서는 해당 항목이 사용되면서 오류 발생.

**검증**: `seed128Encrypt('123abc가나다', '1234567890abcdefghijkl')` 결과가 PHP 레퍼런스와 동일한 `8522ad534acc61cb88090b7e62c5183b`로 일치. 수정 후 `insertOrder` 실 호출 → `regiNo=7890101134491` 정상 반환 확인.

---

### 2026-05-27 — 우체국 ePost API 관련

| 버그 | 원인 | 수정 파일 |
|------|------|-----------|
| 수거 취소 ERR-211: reqNo 값이 없습니다 | EPost API 파서가 reqNo를 인식 못 하는 경우 취소 화면이 막힘 | `api/pickup/[id]/route.ts` — ERR-211·필수항목누락 오류 시 DB만 취소 처리(graceful) |
| reqNo/resNo 빈 문자열 fallback 누락 | `tracking_events[0].reqNo`가 `""` 이면 `??` 연산자가 DB 값으로 폴백하지 않음 | `||` 연산자로 교체, `String()` 변환 추가 |
| getResInfo ERR-111: reqYmd 값이 없습니다 | UTC 날짜 사용 — KST 기준 새벽 0~9시에 날짜가 하루 이전으로 계산됨 | `api/pickup/route.ts` — `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })` 으로 변경 |
| `buildKeyedPlaintext` required 필드 silent skip | required 필드 값이 `undefined`/`null`이면 오류 없이 건너뛰어 EPost에 필드 누락 전송 | `lib/epost/seed128.ts` — required + undefined 조합 시 즉시 throw |

---

## Phase 2 — 진행 중 / 미커밋 작업 (2026-05-27 기준)

아래는 **로컬 작업 중**이거나 **커밋됐으나 README 미반영** 항목입니다.

### 입고 자동 동기화 (핵심 진행 중)

국내 입고 전 구간(수거 중·배송 중) 상태를 API로 자동 갱신합니다.

| 구분 | API | 대상 |
|------|-----|------|
| `PICKUP` | 우체국 GetResInfo | 앱 수거 신청 물품 |
| `DIRECT` | tracker.delivery | 물품등록·타택배 |

**구현 파일**

- `apps/web/lib/parcels/inbound-sync.ts` — 배치 동기화 로직
- `apps/admin/lib/parcels/inbound-sync.ts` — admin용 (동일 로직)
- `apps/web/app/api/cron/sync-inbound/route.ts` — Vercel Cron (KST 평일, ICN1)
- `apps/admin/app/api/admin/parcels/sync-inbound/route.ts` — 수동 동기화
- `apps/admin/components/parcels/ParcelsSyncButton.tsx` — UI 트리거
- `apps/admin/components/parcels/InboundSyncSchedulePanel.tsx` — 스케줄 설정 UI
- `apps/admin/lib/epost/client.ts` — admin ePost 클라이언트
- `apps/admin/lib/tracking/client.ts` — tracker.delivery 연동
- `apps/web/lib/business-days/kr.ts` — KST 평일·공휴일 판단

**DB**

- `020_parcel_inbound_source.sql` — `parcels.inbound_source` (`PICKUP` / `DIRECT`)
- `021_inbound_sync_schedule.sql` — `admin_config.inbound_sync_schedule` (기본 10:00·13:00·15:00 KST)

**Cron (`vercel.json`)**

```json
{ "path": "/api/cron/sync-inbound", "schedule": "0 0-9 * * *" }
```

> UTC 0~9시 = KST 09~18시 범위. 스케줄 패널에서 시각·enabled 제어.

### 관리자 고객 관리 (신규)

- `apps/admin/app/(dashboard)/customers/page.tsx` — 고객 검색·목록
- `apps/admin/app/(dashboard)/customers/[code]/page.tsx` — 고객별 물품·주문

### 기타 미커밋

- `apps/admin/lib/parcel-status.ts`, `apps/web/lib/parcel-shippable.ts` — 상태·출고 가능 판단
- `apps/admin/lib/parcels/fields.ts` — 물품 필드 정규화
- admin 입고·주문·택배 페이지 UI 보완
- web 스토리지·배송신청·요금 페이지 소폭 수정

---

## Phase 2 — 아직 예정

README 로드맵과 동일. 입고 동기화 완료 후 우선순위 제안 순입니다.

1. **관리자 입고 처리** — 오픈박스 영상 업로드 (Cloudflare Stream)
2. **검수 결과 입력** — 사진 업로드, 발송 가능/불가/보류
3. **견적 확정 → QUOTE_SENT 알림** — 마진 필드(019) UI 연동
4. **반품 전체 워크플로우** — 시점별 처리
5. **고객 물품 타임라인** — 입고영상·검품사진·출고영상
6. **검수검품·빈박스 배송 신청 UI**

---

## Phase 3 — 예정

- FCM 푸시 알림
- EMS/K-Packet 운송장 자동 등록·고객 알림 (국제 추적 Cron 확장)
- Capacitor WebView 앱 (iOS/Android)
- 통계 대시보드 (매출·국가별·서비스별)

---

## DB 마이그레이션 현황

| 파일 | 내용 | 상태 |
|------|------|------|
| `001`~`017` | 초기 스키마, 수거, EMS, 추적, 반품 등 | ✅ 프로덕션 기준 |
| `016_orders_insurance.sql` | 주문 보험 옵션 | ✅ |
| `017_orders_intl_tracking.sql` | 국제 추적 필드 | ✅ |
| `018_fix_handle_new_user.sql` | 가입 트리거 수정 | ✅ |
| `019_orders_quote_margin.sql` | 견적 EMS 원가·마진 | 🔄 코드 반영, README 미반영 |
| `020_parcel_inbound_source.sql` | 입고 경로 구분 | 🔄 미적용 |
| `021_inbound_sync_schedule.sql` | admin_config 스케줄 | 🔄 미적용 |

---

## API 엔드포인트 추가 (최근)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/cron/sync-inbound` | 입고 전 구간 Cron (CRON_SECRET) |
| POST | `/api/admin/parcels/sync-inbound` | admin 수동 입고 동기화 |
| GET/PATCH | `/api/admin/settings/inbound-sync` | 동기화 스케줄 설정 |
| POST | `/api/admin/ems/apply` | admin EMS/K-Packet 접수 |
| POST | `/api/payment/confirm` | 결제 + EMS 자동 접수 |

---

## 환경변수 (추가·중요)

| 변수 | 용도 |
|------|------|
| `CRON_SECRET` | Vercel Cron 인증 |
| `EPOST_*` | 우체국 계약소포 (ICN1 리전 필수) |
| `EPOST_TRACE_SERVICE_KEY` | EMS 행방조회 OpenAPI |
| `SUPABASE_SERVICE_ROLE_KEY` | admin·cron 서버 작업 |

---

## 다음 작업 체크리스트

- [ ] `020`, `021` SQL Supabase 적용
- [ ] 입고 동기화 로컬 변경 커밋·배포
- [x] README Phase 1.5·입고 동기화 섹션 반영
- [x] EMS 보험료/배송료 분리 표시
- [x] 인보이스 단가·품목명 필수 입력 강화
- [x] USD-KRW 환율 동기화 환경변수 설정 (`PUBLIC_DATA_API_KEY`, `CRON_SECRET`)
- [x] 수거 취소 ERR-211 graceful 처리 + reqNo fallback 버그 수정
- [x] getResInfo reqYmd UTC→KST 수정
- [x] `buildKeyedPlaintext` required 필드 undefined silent skip 수정
- [x] **SEED128 SS1[109] 상수 오류 수정** — 모든 수거 신청 API 정상화 (`5b8774a`)
- [ ] admin 견적 화면에 `quote_ems_cost` / `shipping_margin` 입력 UI
- [ ] 입고 동기화 Cron 프로덕션 동작 확인 (KST 평일 3회)
- [ ] 고객 관리 페이지 네비게이션 연결 (`DashboardNav`)

---

## 변경 이력 (문서)

| 날짜 | 변경 |
|------|------|
| 2026-05-27 | 최초 작성 — Phase 1 완료, Phase 1.5·입고 동기화 진행 현황 정리 |
| 2026-05-27 | Phase 1.5 추가: 보험료 분리, 인보이스 필수값, 환율 환경변수. 버그픽스: 수거 취소 ERR-211/reqNo/reqYmd/seed128 |
|| 2026-05-28 | **SEED128 SS1[109] 핵심 버그 수정** — 수거 신청 API 전면 정상화. inqTelCn 매핑 수정 |
