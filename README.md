# 인프론트 (Infront)

> 국내 수거 → 창고 입고 → 검수 → 합포장/재포장 → 국제배송 대행 플랫폼

---

## 📖 서비스 소개

**인프론트**는 고객이 국내에서 구매한 물품을 창고로 수거·보관하고, 검수·포장 후 해외로 발송하는 비대면 배송대행 서비스입니다.

- 고객은 **웹(infront.kr)** 또는 **WebView 앱(iOS/Android)**으로 접수합니다.
- 관리자·운영자는 **admin.infront.kr**에서 입고·검품·포장·출고·정산을 관리합니다.
- 결제는 **토스페이먼츠** 위젯으로 처리하며, 물류는 **우체국 API(국내수거 + EMS/K-Packet)**와 연동됩니다.
- **입고 오픈박스 영상 · 출고 패킹 영상**은 Cloudflare Stream에 업로드되어 고객에게 투명하게 공유됩니다. (핵심 신뢰 자산)

---

## 🔄 수거 및 배송 플로우

```
수거신청 (주소 + 날짜만)
       ↓
창고 입고 · 보관 (스토리지에서 상태 확인)
       ↓
스토리지에서 물품 선택 (체크박스, 다중 선택 가능)
       ↓
[N개 물품 해외배송 신청] 버튼
       ↓
해외배송 신청 플로우 (다단계)
  Step 1. 물품 확인
  Step 2. 배송 방법 + 포장 옵션 선택
  Step 3. 해외 배송지 선택 / 입력
  Step 4. 인보이스 (세관신고 물품 목록)
       ↓
창고 검수 → 견적 확정 알림 (QUOTE_SENT)
       ↓
고객 결제 (Toss) → 포장 → EMS 접수 → 발송
```

### 💡 결제 타이밍 정책

> **결제는 항상 견적 확정 후 진행합니다.**

수거 신청 시점에는 실제 무게·부피를 알 수 없으므로, 창고 입고 후 실측 기준으로 정확한 견적을 산출하여 고객에게 알림을 발송합니다. 예상 요금은 신청 단계에서 참고용으로만 제공됩니다.

---

## 📦 서비스 카탈로그

### 해외배송

| 코드 | 서비스명 | 특징 |
|------|---------|------|
| `EMS` | EMS | 일반 국제우편, 3~7일 |
| `EMS_PREMIUM` | EMS 프리미엄 | FedEx 특송, 2~4일, 최대 70kg (2026.4~ UPS→FedEx) |
| `KPACKET` | K-Packet | 소형 경량 화물, 7~15일, 2kg 이하 |

### 포장 서비스

| 코드 | 서비스명 | 설명 | 요금 |
|------|---------|------|------|
| `SAFE_PACK` | 안전포장 | 에어캡, 완충재 추가 | +3,000원 |
| `REPACK` | 재포장 | 새 박스로 교체 | +2,000원 |
| `CONSOLIDATE` | 합포장 | 여러 물품을 하나로 합치기 | +2,000원 |

### 검수검품 서비스

| 코드 | 서비스명 | 설명 | 요금 |
|------|---------|------|------|
| `BASIC_INSPECT` | 기본 검수 | 외관 사진 촬영 (기본 포함) | 무료 |
| `DETAIL_INSPECT` | 상세 검수 | 전체 사진 + 체크리스트 | +3,000원 |
| `CLOTHING_INSPECT` | 의류 검수 | 펼침/라벨/전후면 촬영 | +2,000원 |

검수 후 불량 발견 시 즉시 반품 신청으로 연계 가능합니다.

### 빈 박스 배송 서비스

박스를 구하지 못한 고객에게 빈 박스를 국내 배송해드리는 서비스입니다.

| 코드 | 서비스명 | 규격 | 요금 |
|------|---------|------|------|
| `BOX_S` | 소형 박스 배송 | 20×20×20cm 이하 | 3,000원 |
| `BOX_M` | 중형 박스 배송 | 40×30×30cm 이하 | 4,000원 |
| `BOX_L` | 대형 박스 배송 | 60×50×50cm 이하 | 5,000원 |

### 반품 서비스

창고에 보관된 물품을 국내 판매자에게 반품 처리해드리는 서비스입니다.

| 시점 | 설명 |
|------|------|
| 수거 전 | 수거 취소 요청 |
| 배송 중 (수거 후~입고 전) | 창고 도착 즉시 반품 처리 |
| 창고 도착 후 | 입고된 물품 반품 신청 |
| 검수 후 즉시 | 검수 결과 화면에서 원클릭 반품 |
| 해외 도착 후 | 고객이 우리 창고로 직접 발송 후 처리 |

> **반품 처리 범위:** 창고 → 국내 판매자 발송. 환불 처리는 고객-판매자 간 직접 진행.

---

## 🔄 서비스 전체 플로우

```
고객 접수 (수거신청)
    ↓
우체국 방문수거 (국내 택배)
    ↓
인프론트 창고 입고
    ↓  📹 오픈박스 영상 촬영
기본 검수 (사진 촬영) — 옵션: 상세검수 / 의류검수
    ↓  📷 물품 전체 사진
    ├── [반품 요청 시] → 국내 판매자에게 반품 발송
    └── [해외배송 진행] → 아래 계속
합포장 / 재포장 / 안전포장 처리
    ↓  📷 포장 전/후 사진
실측 무게 · 부피 확인
    ↓
국제배송비 + 서비스 요금 확정 → 고객 견적 알림 (QUOTE_SENT)
    ↓
고객 결제 (토스페이먼츠)
    ↓  📹 출고 패킹 영상 촬영
EMS / EMS프리미엄 / K-Packet 접수
    ↓
해외 수취인에게 배송
```

---

## 🗂 프로젝트 구조

```
infront/
├── apps/
│   ├── web/              # Next.js 16 고객 웹앱 (infront.kr)
│   ├── admin/            # Next.js 관리자 콘솔 (admin.infront.kr)
│   ├── mobile-cap/       # Capacitor WebView 앱 쉘 (iOS / Android) — 예정
│   │   ├── ios/          # Xcode 프로젝트
│   │   ├── android/      # Android 프로젝트
│   │   └── capacitor.config.ts
│   ├── edge/             # Supabase Edge Functions (Deno) — 예정
│   └── sql/              # Postgres DDL 및 마이그레이션 (001~044)
├── docs/                 # 개발 현황·설계 문서
│   └── DEVELOPMENT_STATUS.md
├── vercel.json
└── README.md
```

---

## 🔗 서비스 URL

| 서비스 | URL | 설명 |
|---|---|---|
| 고객 웹 | infront-app.vercel.app | Next.js 고객 포털 (`apps/web`) |
| 관리자 | admin.infront.kr | 관리자·운영 콘솔 (`apps/admin`) |
| iOS 앱 | App Store | Capacitor WebView (`apps/mobile-cap`) |
| Android 앱 | Google Play | Capacitor WebView (`apps/mobile-cap`) |

---

## 🧩 기술 스택

### 고객 웹 · 앱 (`apps/web` + `apps/mobile-cap`)

| 분류 | 기술 |
|------|------|
| Framework | Next.js 16.2 (App Router), React 19 |
| UI | Tailwind CSS 4, Lucide Icons, 모바일 퍼스트 (max-w-600px) |
| 상태관리 | TanStack Query (React Query) |
| 인증 | Supabase SSR (`@supabase/ssr`) |
| 결제 | Toss Payments SDK (`@tosspayments/tosspayments-sdk`) |
| 앱 래핑 | Capacitor (WebView — iOS/Android) |
| 배포 | Vercel (ICN1 Seoul 리전) |

### 관리자 (`apps/admin`)

| 분류 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router) |
| UI | Tailwind CSS 4 |
| 인증 | 이메일 화이트리스트 (`ADMIN_EMAILS` 환경변수) |
| DB 접근 | Supabase Service Role Key (RLS 우회) |
| 영상 업로드 | tus-js-client (Cloudflare Stream 청크 업로드) — 예정 |
| 영상 재생 | hls.js (HLS 스트리밍) — 예정 |

### 공통 백엔드 · 외부 연동

| 분류 | 기술 |
|------|------|
| Database & Auth | Supabase (Postgres + RLS + Auth) |
| 물류 (국내) | 우체국 ePost API — 방문수거, 취소, 상태조회 (SEED128) · tracker.delivery (타택배 추적) |
| 물류 (국제) | EMS / EMS프리미엄 / K-Packet API |
| 주소 검색 | 다음 우편번호 API |
| 결제 | Toss Payments |
| 영상 CDN | Cloudflare Stream — 예정 |
| 사진 스토리지 | Supabase Storage — 예정 |
| Push 알림 | Firebase Cloud Messaging (FCM) — 예정 |

---

## 🖥 고객 웹앱 페이지 구조 (`apps/web`)

### 메인 앱 (`/(main)`) — 로그인 필요

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/home` | 홈 | 액션 대시보드, 최근 배송 현황, 창고 요약, 빠른 링크 |
| `/pickup` | 수거 신청 | 우체국 ePost 방문수거 신청, 주소 선택 |
| `/warehouse` | 스토리지 | 입고 물품 목록, 상태 필터, 다중 선택 |
| `/warehouse/[id]` | 물품 상세 | 인라인 수정, 추적, 부가 서비스 |
| `/shipping-request` | 출고 신청 | 다단계 플로우 (물품→옵션→주소→인보이스) |
| `/orders` | 배송현황 | 주문 목록, 상태 표시, 운송장 조회 |
| `/storage` | 보관 서비스 | 고객 보관함 목록, 상태 확인 |
| `/storage/new` | 보관 신청 | 플랜 선택 · 수거 정보 입력 · KG Inicis 결제 |
| `/storage/[id]` | 보관 상세 | 아이템 목록, 사진, 결제 현황 |
| `/storage/payment/success` | 보관 결제 성공 | KG Inicis 단건결제 결과 처리 |
| `/storage/payment/fail` | 보관 결제 실패 | 결제 실패·취소 처리 |
| `/mypage` | MY | 프로필, 고객번호, 입고주소 확인 |
| `/addresses` | 주소록 | 수거지·해외 배송지 관리 |
| `/register-parcel` | 물품 등록 | 수동 물품 등록 |
| `/return-request` | 반품 신청 | 반품 요청 UI |
| `/shipping-calc` | 배송비 계산 | 해외 배송비 예상 계산기 |
| `/pricing` | 해외배송 가격표 | 우체국 공식 EMS/K-Packet 요금표 |
| `/domestic-rates` | 국내배송 가격표 | 창구접수 등기소포 요금·규격·무게 안내 |
| `/guide` | 이용 가이드 | 서비스 이용 안내 |
| `/notices` | 공지사항 | 공지 목록 |
| `/notifications` | 알림 | in-app 알림 목록 |
| `/postcode` | 주소 검색 | 다음 우편번호 검색 래퍼 |
| `/payment/success` | 결제 성공 | Toss 결제 결과 처리 |
| `/payment/fail` | 결제 실패 | Toss 결제 실패 처리 |
| `/login`, `/signup` | 인증 | Supabase 이메일 인증 |

**하단 탭바 (6탭):** 홈 / 수거신청 / 스토리지 / 출고신청 / 배송현황 / MY

**사이드바 위젯 (xl+ 데스크탑):**
- 해외배송 경로 (`/shipping-request` 등): EMS · K-Packet 요금 계산기 + 통관 정보
- 국내배송 경로 (`/domestic-shipping`, `/domestic-rates`): 창구접수 등기소포 계산기 (도서산간 체크박스)
- `/shipping-calc`: 해외배송 요율표·통관 정보 패널

### 포장대행 서비스 (`/shop`) — 로그인 불필요 (독립 서비스)

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/shop` | 상품 목록 | S/M/L/XL 박스 포장대행, KO/EN 바이링구얼, KG Inicis 결제 |
| `/shop/checkout` | 결제 폼 | 주문정보 입력, 다음 우편번호 주소 검색, 이용약관 동의 |
| `/shop/payment/success` | 결제 성공 | KG Inicis 결제 완료 처리 |
| `/shop/payment/fail` | 결제 실패 | 결제 실패·취소 처리 |
| `/shop/payment/close` | 결제 창 닫기 | INIpay 팝업 종료 처리 |
| `/shop/terms` | 이용약관 | 포장대행 서비스 이용약관 (독립 페이지) |
| `/shop/privacy` | 개인정보처리방침 | 포장대행 서비스 개인정보처리방침 (독립 페이지) |

---

## 🛠 고객 API 라우트 (`apps/web/app/api/`)

### 메인 서비스 API

| 엔드포인트 | 메서드 | 역할 |
|-----------|--------|------|
| `/api/pickup` | POST | 우체국 수거 신청 |
| `/api/pickup/[id]` | DELETE | 수거 취소 (ePost + DB) |
| `/api/pickup/[id]/status` | GET | 수거 상태 조회 (GetResInfo) |
| `/api/parcels` | POST | 물품 등록 |
| `/api/parcels/[id]` | PATCH | 물품 수정 |
| `/api/parcels/[id]/service-requests` | GET, POST | 물품별 부가 서비스 |
| `/api/parcels/sync-tracking` | POST | 국내 추적 이벤트 동기화 |
| `/api/orders` | GET, POST | 주문 목록 조회 / 생성 |
| `/api/ems/nations` | GET | EMS 배송 가능 국가 목록 |
| `/api/ems/quote` | GET, POST | EMS/K-Packet 배송비 견적 |
| `/api/ems/apply` | POST | EMS 접수 등록 |
| `/api/ems/exchange-rate` | GET | USD/KRW 환율 조회 |
| `/api/payment/confirm` | POST | Toss 결제 승인 + EMS 자동 접수 |
| `/api/return-requests` | GET, POST | 반품 신청 |
| `/api/domestic-orders` | GET, POST | 국내 주문 목록 / 생성 |
| `/api/cron/sync-inbound` | GET | 입고 전 구간 자동 동기화 (Vercel Cron) |
| `/api/cron/sync-intl-tracking` | GET | 국제 운송장 추적 동기화 (Vercel Cron) |
| `/api/cron/sync-usd-krw-rate` | GET | USD/KRW 환율 갱신 (Vercel Cron, 주 1회) |

### 보관 서비스 API

| 엔드포인트 | 메서드 | 역할 |
|-----------|--------|------|
| `/api/storage` | GET, POST | 고객 보관함 목록 조회 / 신청 |
| `/api/storage/[id]` | GET, PATCH | 보관함 상세 / 상태 변경 |
| `/api/storage/[id]/items` | GET, POST | 보관 아이템 목록 / 추가 |
| `/api/storage/plans` | GET | 보관 플랜 목록 (storage_plan_config) |
| `/api/storage/box-fees` | GET | 수거 박스 크기별 요금 조회 (pickup_box_fees) |
| `/api/storage/pay/prepare` | POST | 보관 서비스 결제 준비 |
| `/api/inicis/prepare` | POST | KG Inicis PC 결제 서명 생성 |
| `/api/inicis/return` | POST | KG Inicis PC 결제 결과 처리 |
| `/api/inicis/mobile-prepare` | POST | KG Inicis 모바일 결제 준비 |
| `/api/inicis/mobile-return` | POST | KG Inicis 모바일 결제 결과 처리 |
| `/api/inicis/storage-return` | POST | KG Inicis 보관 서비스 결제 결과 처리 |

### 포장대행 서비스 API

| 엔드포인트 | 메서드 | 역할 |
|-----------|--------|------|
| `/api/shop/confirm` | POST | KG Inicis 포장대행 결제 승인 처리 |

---

## 🏢 관리자 콘솔 페이지 구조 (`apps/admin`)

| 경로 | 페이지 | 상태 |
|------|--------|------|
| `/login` | 관리자 로그인 | ✅ |
| `/dashboard` | 대시보드 | ✅ (입고·주문·반품 집계) |
| `/parcels` | 입고 물품 목록 | ✅ (상태 필터, 검색, 입고 동기화) |
| `/parcels/[id]` | 물품 상세 | ✅ (위치이력, 로케이션 이동) |
| `/inbound` | 입고처리 | ✅ (바코드 스캔, 사진촬영, 자동 로케이션 배정) |
| `/inbound/[id]/barcodes` | 바코드 발행 | ✅ |
| `/picking` | 피킹 목록 | ✅ (결제완료 주문 목록) |
| `/picking/[id]` | 피킹 상세 | ✅ (바코드 스캔, 물품별 피킹 상태) |
| `/outbound` | 출고 목록 | ✅ (출고대기 주문 목록) |
| `/outbound/[id]` | 출고 세션 | ✅ (박스 스캔, 출고 영상 업로드) |
| `/transfer` | 로케이션 이동처리 | ✅ (바코드 스캔 2번으로 즉시 이동) |
| `/orders` | 국제 주문 목록 | ✅ |
| `/orders/[id]` | 주문 상세 | ✅ |
| `/orders/[id]/label` | 배송 라벨 | ✅ (보험·세관 필드) |
| `/orders/[id]/packing-slip` | 패킹 슬립 | ✅ |
| `/domestic-orders` | 국내 주문 목록 | ✅ |
| `/domestic-orders/[id]` | 국내 주문 상세 | ✅ |
| `/domestic-orders/[id]/label` | 국내 배송 라벨 | ✅ |
| `/customers` | 고객 관리 | 🔄 (고객별 물품·주문 조회) |
| `/customers/[code]` | 고객 상세 | 🔄 |
| `/returns` | 반품 신청 목록 | ✅ |
| `/storage` | 로케이션 현황 | ✅ (Zone별 현황, 타입 뱃지, 용량 표시) |
| `/storage/[id]` | 로케이션 상세 | ✅ (리터 용량 바, 소포 이동, 고객 배정) |
| `/storage/manage` | Zone·슬롯 관리 | ✅ (타입 설정, 가격·용량 편집, 일괄 변경) |
| `/label-editor` | 라벨 레이아웃 편집 | ✅ |

---

## 📦 주문 상태 머신

### orders 상태

| 상태 | 레이블 | 설명 |
|---|---|---|
| `DRAFT` | 신청 완료 | 해외배송 신청 접수, 창고 입고 대기 |
| `PENDING_PICKUP` | 수거신청 | 우체국 방문수거 예약 완료 |
| `PICKED_UP` | 수거완료 | 국내 택배 수거 완료 |
| `INBOUND` | 입고완료 | 창고 입고 + 오픈박스 영상 촬영 완료 |
| `INSPECTION` | 검수중 | 내품 확인 + 사진 촬영 중 |
| `HOLD` | 보류 | 통관불가·파손 등 고객 확인 필요 |
| `PACKAGING_REQUESTED` | 포장요청 | 합포장/재포장/특수포장 요청 접수 |
| `PACKAGING_DONE` | 포장완료 | 포장 작업 완료 + 사진 촬영 |
| `QUOTE_SENT` | 견적발송 | 국제배송비 + 서비스 요금 고객에게 발송 |
| `PENDING_PAYMENT` | 결제대기 | 고객 결제 대기 |
| `PAID` | 결제완료 | 토스페이먼츠 결제 승인 |
| `PICKING` | 피킹중 | 창고 직원이 물품 수거 중 |
| `PICKING_DONE` | 피킹완료 | 창고 내 물품 수거 완료 |
| `OUTBOUND_WAIT` | 출고대기 | 출고 작업 대기 |
| `CUSTOMS_FILING` | 접수중 | EMS/K-Packet 접수 등록 + 패킹 영상 촬영 |
| `IN_TRANSIT` | 배송중 | 국제 운송 중 |
| `DELIVERED` | 배송완료 | 해외 수취인 수령 |
| `CANCELLED` | 취소 | 취소 처리 |

### parcels 수거 상태

| 상태 | 설명 |
|---|---|
| `PICKUP_REQUESTED` | 수거 신청 완료 |
| `PICKUP_CANCELLED` | 수거 취소 처리 완료 |
| `IN_TRANSIT` | 국내 운송 중 |
| `INBOUND` | 창고 입고 완료 |

### return_requests 상태

| 상태 | 설명 |
|---|---|
| `REQUESTED` | 반품 신청 접수 |
| `WAITING_INBOUND` | 물품 창고 도착 대기 (해외발송 후 재입고 케이스) |
| `INSPECTING` | 반품 전 상태 검수 |
| `PACKED` | 반품 포장 완료 |
| `SHIPPED` | 판매자에게 발송 완료 |
| `COMPLETED` | 반품 완료 |
| `CANCELLED` | 취소 |

---

## 🗄 DB 스키마 (마이그레이션 001~044)

| 파일 | 내용 |
|------|------|
| `001_init.sql` | 핵심 테이블: customers, parcels, orders, order_parcels, parcel_media, packaging_requests, payments, notifications, RLS, 고객번호 자동생성 트리거 |
| `002_pickup.sql` | parcels: 수거 관련 컬럼 (pickup_tracking_no, pickup_address, epost_*) |
| `003_ems.sql` | parcels: EMS 관련 컬럼 (ems_regino, ems_fee, ems_country, ems_applied_at) |
| `004_addresses.sql` | customer_addresses 테이블 (type: pickup \| overseas) |
| `005_services.sql` | services 카탈로그, order_services, return_requests, inspection_results, customers.auth_user_id |
| `006_fix_addresses_rls.sql` | customer_addresses RLS 수정 (auth.uid() 직접 참조) |
| `007_box_orders.sql` | 빈 박스 배송 주문 테이블 |
| `008_parcel_registration.sql` | 고객 직접 물품 등록 지원 |
| `009_parcel_tracking.sql` | 국내 추적 이벤트 테이블 |
| `010_shipping_boxes.sql` | 다중 박스 출고 (shipping_boxes) |
| `011_parcel_services.sql` | 물품별 부가 서비스 |
| `012_orders_ems_fields.sql` | orders: EMS 관련 필드 추가 |
| `013_return_requests_v2.sql` | 반품 요청 v2 스키마 |
| `014_epost_order_no.sql` | epost_order_no 컬럼 (GetResInfo 상태 조회용) |
| `015_pickup_box_specs.sql` | 수거 다박스·박스 규격 컬럼 |
| `016_orders_insurance.sql` | orders: 국제우편 보험 옵션 (insurance_enabled, insurance_amount) |
| `017_orders_intl_tracking.sql` | orders: 국제 운송장 추적 필드 |
| `018_fix_handle_new_user.sql` | handle_new_user 트리거 중복 호출 수정 |
| `019_orders_quote_margin.sql` | orders: 견적 EMS 원가·마진 (quote_ems_cost, shipping_margin) |
| `020_parcel_inbound_source.sql` | parcels.inbound_source (PICKUP / DIRECT) |
| `021_inbound_sync_schedule.sql` | admin_config 입고 동기화 스케줄 |
| `022_ems_usd_krw_rate.sql` | EMS 보험 USD→KRW 환율 (admin_config, Cron 1회/일 갱신) |
| `023_orders_duty_ddp.sql` | DDP(관세납부) 옵션·DDP 가격 필드 |
| `024_domestic_orders.sql` | domestic_orders 테이블 (창고→국내 주소 출고) |
| `025_domestic_orders_v2.sql` | domestic_orders 확장: 부가옵션·메모 컬럼 추가 |
| `026_storage_locations.sql` | storage_locations 테이블 (창고 로케이션 — A-001 형식) |
| `027_storage_zones.sql` | Zone 그룹핑 (storage_locations 상위 논리 구역) |
| `028_storage_types.sql` | storage_types 테이블: MINI/STANDARD/LONG/XL/OVERSIZE 규격·요금 정의 |
| `029_storage_locations_v2.sql` | storage_locations 확장: Zone/Type FK, volume_liter, is_temp 컬럼 |
| `030_storage_grid_view.sql` | 관리자 그리드 UI용 뷰 |
| `031_storage_alert_view.sql` | 즉시 처리 필요·장기 보관 알림 집계 뷰 |
| `032_parcel_barcodes.sql` | parcel_barcodes 테이블 (내부 바코드: `{tracking_no}-{seq}`) |
| `033_storage_capacity.sql` | storage_locations: max_parcels 용량 상한 컬럼 |
| `034_parcel_size_code.sql` | parcels.parcel_size_code 컬럼 추가 |
| `035_parcel_location_history.sql` | parcel_location_events 테이블 (소포 위치 이동 이력) + 임시보관 공간 |
| `035_parcel_size_code_migrate.sql` | parcel_size_code 값 MINI/STANDARD/LONG/XL/OVERSIZE로 마이그레이션, pickup_weight_kg 기반 자동 채우기 |
| `036_parcel_barcode_location.sql` | parcel_barcodes: 아이템별 독립 storage_location_id 컬럼 추가 |
| `037_outbound_picking.sql` | orders/domestic_orders: 피킹·출고 컬럼 추가; 상태 확장 PAID→PICKING→PICKING_DONE→OUTBOUND_WAIT→IN_TRANSIT |
| `038_outbound_sessions.sql` | outbound_sessions 테이블 (출고 작업 세션 — 스캔 로그, 박스, 영상, 담당자) |
| `038_picking_item_tracking.sql` | parcel_barcodes: 피킹 상태 컬럼 (WAITING/DONE/HOLD/NOT_FOUND); picking_scan_logs 테이블 |
| `039_parcel_media_bucket.sql` | Supabase Storage `parcel-media` 버킷 생성 정책 |
| `040_customer_storages.sql` | 고객 보관 서비스 핵심 테이블: storage_plan_config (S/M/L/XL 플랜), item_capacity_scores (점수 기준표), customer_storages (보관함), customer_storage_items (보관 아이템) |
| `041_storage_payments.sql` | storage_payments 테이블 — 보관 서비스 결제 내역 (단건·정기) |
| `042_storage_recurring_profiles.sql` | storage_recurring_profiles 테이블 — 장기보관 자동결제 프로파일 (빌링키, 다음 결제일, 연체 처리 준비) |
| `043_storage_status_pending_payment.sql` | customer_storages 상태 확장: PENDING_PAYMENT (수거비 미결제) 추가 |
| `044_pickup_box_fees.sql` | pickup_box_fees 테이블 — 수거 박스 크기별(DEFAULT/SMALL/MEDIUM/LARGE/XL) 요금 관리 (Admin 설정) |

> 상세 개발 현황: [docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md)

### 핵심 테이블 관계

```
customers (1) ──< parcels (N)              입고된 개별 물품
customers (1) ──< orders (N)               해외배송 주문 묶음
orders (N) ──< order_parcels >── parcels   합포장 M:N 연결
orders (1) ──< order_services (N)          주문별 부가 서비스
orders (1) ──< payments (N)                결제 내역
parcels (1) ──< parcel_services (N)        물품별 부가 서비스
parcels (1) ──< inspection_results (N)     검수 결과
parcels (1) ──< return_requests (N)        반품 요청
parcels (1) ──< parcel_tracking (N)        국내 추적 이벤트
customers (1) ──< customer_addresses (N)   수거지/해외 주소록
orders (1) ──< shipping_boxes (N)          출고 박스 정보
parcels/orders ──< parcel_media            사진/영상 미디어
```

### services 테이블 코드 목록

| category | code | name | price |
|---|---|---|---|
| SHIPPING | `EMS` | EMS | 실측 기준 |
| SHIPPING | `EMS_PREMIUM` | EMS 프리미엄 | 실측 기준 |
| SHIPPING | `KPACKET` | K-Packet | 실측 기준 |
| INSPECTION | `BASIC_INSPECT` | 기본 검수 | 무료 |
| INSPECTION | `DETAIL_INSPECT` | 상세 검수 | 3,000원 |
| INSPECTION | `CLOTHING_INSPECT` | 의류 검수 | 2,000원 |
| PACKAGING | `SAFE_PACK` | 안전포장 | 3,000원 |
| PACKAGING | `REPACK` | 재포장 | 2,000원 |
| PACKAGING | `CONSOLIDATE` | 합포장 | 2,000원 |
| BOX_DELIVERY | `BOX_S` | 소형 박스 배송 | 3,000원 |
| BOX_DELIVERY | `BOX_M` | 중형 박스 배송 | 4,000원 |
| BOX_DELIVERY | `BOX_L` | 대형 박스 배송 | 5,000원 |

---

## 🎬 핵심 기능: 투명한 물품 기록 시스템

타 업체와의 핵심 차별점입니다. 고객이 직접 볼 수 없는 창고 내 모든 과정을 영상·사진으로 공개합니다.

| 단계 | 미디어 | 저장소 | 설명 |
|---|---|---|---|
| 입고 오픈박스 | 🎬 영상 | Cloudflare Stream | 박스 개봉 전 과정 — 조작 불가 증거 |
| 내품 검수 | 📷 사진 N장 | Supabase Storage | 개별 물품 상세 확인 |
| 포장 작업 | 📷 전/후 사진 | Supabase Storage | Before-After 비교 |
| 출고 패킹 | 🎬 영상 | Cloudflare Stream | 물건 담기→밀봉→무게 측정 전 과정 |

---

## 👤 고객 기능 현황

| 기능 | 상태 | 설명 |
|---|---|---|
| 회원가입 / 로그인 | ✅ 완료 | 이메일, Supabase Auth |
| 고객번호 발급 | ✅ 완료 | 가입 시 자동 발급 (예: `IFT-20260518-0001`) |
| 개인 입고주소 제공 | ✅ 완료 | 고객번호 기반 전용 입고주소 |
| 수거 신청 | ✅ 완료 | 우체국 방문수거 API, 다박스·박스 규격, 저장된 주소 선택 |
| 수거 취소 | ✅ 완료 | ePost API 연동 취소 + DB 상태 업데이트 |
| 수거 상태 조회 | ✅ 완료 | GetResInfo API 실시간 상태 폴링 |
| 일반/고급 입력 모드 | ✅ 완료 | 수거·등록 단계별 UI 전환 |
| 홈 액션 대시보드 | ✅ 완료 | 지금 할 일 카드 (결제·검수·출고 안내) |
| 스토리지 | ✅ 완료 | 입고 물품 목록, 상태 필터, 검색 |
| 물품 직접 등록 | ✅ 완료 | 수동 물품 등록 폼 (타택배 경로) |
| 물품 선택 + 배송 신청 | ✅ 완료 | 체크박스 다중 선택 → FAB 버튼 |
| 해외배송 신청 (다단계) | ✅ 완료 | 배송옵션→배송지→인보이스 + 다중 박스 지원 |
| 해외 배송지 주소록 | ✅ 완료 | 저장/수정/삭제, 기본 주소 설정 |
| 배송비 계산기 | ✅ 완료 | 사이드바 위젯 + 전용 페이지, 국가·무게별 EMS 견적 |
| 국내배송 계산기 | ✅ 완료 | 사이드바 위젯, 창구접수 등기소포 요금, 도서산간 체크박스 |
| 해외배송 가격표 | ✅ 완료 | `/pricing` — EMS/K-Packet 공식 요금표 |
| 국내배송 가격표 | ✅ 완료 | `/domestic-rates` — 창구접수 등기소포 요금·규격 안내 |
| 이용 가이드 | ✅ 완료 | `/guide` |
| 배송현황 (orders) | ✅ 완료 | 주문 목록, 상태 표시, 운송장 조회 |
| 신청 완료 주문 취소 | ✅ 완료 | 출고 신청 후 취소 |
| 결제 (Toss) | ✅ 완료 | 카드 결제, confirm API, 결제 후 EMS 자동 접수 |
| EMS 보험 옵션 | ✅ 완료 | 견적·접수 시 보험 가입 연동 |
| 고객 알림 | ✅ 완료 | 단계별 in-app 알림 |
| 반품 신청 (UI) | ✅ 완료 | 반품 신청 폼 (백엔드 워크플로우 진행 중) |
| 입고 전 구간 자동 동기화 | 🔄 진행 중 | Cron + GetResInfo / tracker.delivery |
| 검수검품 서비스 신청 | 🔲 예정 | 의류/일반 검수 옵션 선택 |
| 빈 박스 배송 신청 | 🔲 예정 | 소/중/대 박스 국내 배송 |
| 물품 사진/영상 확인 | 🔲 예정 | 입고영상·검품사진·출고영상 타임라인 |
| FCM 푸시 알림 | 🔲 예정 | 단계별 상태 알림 |

---

## 🛠 관리자 기능 현황

| 기능 | 상태 | 설명 |
|---|---|---|
| 관리자 로그인 | ✅ 완료 | 이메일 화이트리스트 인증 |
| 대시보드 | ✅ 완료 | 입고·주문·반품 집계 카드 |
| 입고 물품 목록 | ✅ 완료 | 상태별 필터, 검색, 입고 동기화 버튼 |
| 물품 상세 조회 | ✅ 완료 | 물품 정보, 상태 변경, 위치 이동 이력 |
| 입고처리 전용 화면 | ✅ 완료 | 바코드 스캔, 사진·영상 촬영, 내부 바코드 자동 생성 |
| 국제 주문 목록 | ✅ 완료 | 주문 목록, 상태 표시 |
| 주문 상세 조회 | ✅ 완료 | 주문 정보, 물품 목록 |
| 배송 라벨 조회 | ✅ 완료 | 라벨 출력 (보험·세관 필드) |
| EMS/K-Packet 접수 | ✅ 완료 | 세관신고 매핑 + 결제 후 자동 접수 |
| 견적 원가·마진 | ✅ 완료 | DB 필드 (019), UI 연동 예정 |
| 반품 신청 목록 | ✅ 완료 | 반품 현황 조회 |
| **스토리지 로케이션 현황** | ✅ 완료 | Zone별 현황 그리드, 타입 뱃지, 상태 필터 |
| **스토리지 로케이션 상세** | ✅ 완료 | 리터 용량 바, 소포 이동, 고객 배정·해제 |
| **Zone·슬롯 관리** | ✅ 완료 | 슬롯 추가/삭제, 타입 지정, 일괄 변경, 가격·용량 편집 |
| **스토리지 타입 요금 설정** | ✅ 완료 | MINI~OVERSIZE 주간요금·상한요금·최대건수 인라인 편집 |
| **로케이션 이동처리** | ✅ 완료 | `/transfer` 전용 페이지, 바코드 2번 스캔으로 즉시 이동 |
| **자동 로케이션 배정** | ✅ 완료 | 입고 시 size code → 단계적 업사이징 → 분할 배정 |
| **피킹 목록 · 상세** | ✅ 완료 | PAID 주문 피킹 대기 목록, 바코드 스캔 물품별 DONE/HOLD/NOT_FOUND |
| **피킹 스캔 로그** | ✅ 완료 | picking_scan_logs — 스캔 이력, 담당자, 타임스탬프 |
| **출고 목록 · 세션** | ✅ 완료 | PICKING_DONE→OUTBOUND_WAIT 흐름, 박스 스캔, 세션 관리 |
| **출고 영상 업로드** | ✅ 완료 | Cloudflare Stream tus 청크 업로드 (`outbound_sessions`) |
| 국내 주문 관리 | ✅ 완료 | 국내 배송 주문 목록·상세·라벨 |
| 고객 관리 | 🔄 진행 중 | 고객 검색, 고객별 물품·주문 조회 |
| 입고 자동 동기화 | 🔄 진행 중 | GetResInfo + tracker.delivery, Cron·스케줄 설정 |
| 접수건 벌크 상태 변경 | 🔲 예정 | 다중 선택 상태 변경 |
| 오픈박스 영상 업로드 | 🔲 예정 | 입고 시 Cloudflare Stream 영상 촬영 |
| 검수 결과 입력 | 🔲 예정 | 체크리스트 + 사진 업로드 |
| 실측 무게/부피 입력 | 🔲 예정 | 부피중량 자동 계산 |
| 견적 확정 + 결제 요청 | 🔄 부분 완료 | 실측→결제 플로우 완료, QUOTE_SENT 알림·마진 UI 예정 |
| 반품 처리 워크플로우 | 🔲 예정 | 검수→포장→발송→완료 |
| 국제 운송장 등록 | 🔲 예정 | 등록 즉시 고객 알림 |
| 통계 대시보드 (상세) | 🔲 예정 | 매출, 국가별, 서비스별 분석 |

---

## 📱 앱 전략 (Capacitor WebView)

```
Next.js 웹앱
      ↓
  Capacitor 앱 쉘
  ├── iOS  → App Store
  └── Android → Google Play
```

- 웹 1개 코드베이스로 웹/iOS/Android 모두 대응
- Safe Area (노치/홈바) CSS 환경변수로 처리

---

## 🚀 개발 로드맵

### Phase 1 — 고객 핵심 플로우 ✅ 완료

- [x] Supabase 스키마 + RLS (001~017.sql, 129+ 커밋)
- [x] 회원가입 → 고객번호/입고주소 자동 발급
- [x] 수거 신청 (우체국 ePost API 연동, 다박스·박스 규격)
- [x] 수거 취소 + 상태 조회 (GetResInfo)
- [x] 스토리지 (입고현황, 물품 선택, 상태 필터)
- [x] 물품 직접 등록
- [x] 해외배송 신청 다단계 플로우 (다중 박스 지원)
- [x] 해외 배송지 주소록 (저장/수정/삭제)
- [x] 인보이스 작성 (세관신고 물품 목록)
- [x] EMS 배송비 자동 견적 조회 + 사이드바 계산기
- [x] 주문 생성 API (`POST /api/orders`)
- [x] 배송현황 페이지 (주문 목록 + 상태)
- [x] 결제 (Toss Payments SDK + confirm API)
- [x] 서비스 카탈로그 DB 설계 (services, order_services, parcel_services)
- [x] 반품 요청 DB 설계 + 신청 UI
- [x] 검수 결과 DB 설계 (inspection_results)
- [x] 국내 추적 이벤트 테이블
- [x] 관리자: 입고/주문/반품 기본 CRUD 화면
- [x] 관리자: EMS 접수 API

### Phase 1.5 — 결제·운영 자동화 ✅ 완료

- [x] 실측값 기반 견적 확정 → 고객 결제 플로우
- [x] 결제 후 EMS/K-Packet 자동 접수 (`payment/confirm`)
- [x] EMS 보험 옵션 (016) · 배송 라벨 출력
- [x] 견적 EMS 원가·마진 분리 (019)
- [x] 홈 액션 대시보드 · 일반/고급 입력 모드
- [x] 요금표(`/pricing`) · 이용 가이드(`/guide`)
- [x] 고객 in-app 알림 · 주문 취소 · 마이페이지 보완
- [x] 국제 추적 Cron (`sync-intl-tracking`, 6시간)
- [x] 관리자 대시보드 통계 카드

### Phase 1.6 — 스토리지 관리 시스템 ✅ 완료

- [x] 스토리지 로케이션 DB 설계 (026~031.sql)
- [x] 로케이션 현황·상세 페이지 (Zone 그리드, 리터 용량 바)
- [x] 입고처리 전용 페이지 + 내부 바코드 (032.sql)
- [x] 스토리지 타입 용량·요금 관리 UI
- [x] 리터=포인트 자동 배정: 단계적 업사이징 + 분할 배정 (033~035.sql)
- [x] 수거신청 시점 parcel_size_code 자동 저장
- [x] 로케이션 이동처리 전용 페이지 (바코드 2-스캔 워크플로우)
- [x] 소포 위치 이동 이력 타임라인

### Phase 1.7 — 피킹·출고 워크플로우 ✅ 완료

- [x] 피킹·출고 상태 확장 (037.sql): PAID → PICKING → PICKING_DONE → OUTBOUND_WAIT → IN_TRANSIT
- [x] parcel_barcodes 아이템 단위 storage_location_id (036.sql)
- [x] 피킹 아이템 추적 (038_picking_item_tracking.sql): WAITING/DONE/HOLD/NOT_FOUND 상태, picking_scan_logs 테이블
- [x] 출고 세션 DB (038_outbound_sessions.sql): outbound_sessions 테이블 (스캔 로그, 박스 목록, 영상 업로드, 담당자)
- [x] 관리자 피킹 목록 `/picking` — 결제완료 주문 목록
- [x] 관리자 피킹 상세 `/picking/[id]` — 바코드 스캔, 물품별 상태 처리
- [x] 관리자 출고 목록 `/outbound` — 출고대기 주문 목록
- [x] 관리자 출고 세션 `/outbound/[id]` — 박스 스캔, Cloudflare Stream 영상 업로드
- [x] 국내 주문 목록·상세·라벨 페이지 (`/domestic-orders`)
- [x] 패킹 슬립 출력 (`/orders/[id]/packing-slip`)

### Phase 2 — 포장대행 서비스 + 모바일 결제 ✅ 완료

> 재중교민 대상 독립 포장대행 서비스 (`/shop`). 로그인 불필요, KG Inicis 결제.

- [x] 포장대행 상품 목록 (S/M/L/XL 박스, 가격 15,000~28,000원)
- [x] KO/EN 바이링구얼 UI (언어 토글)
- [x] 다음 우편번호 주소 검색 연동 (`/postcode`)
- [x] KG Inicis INIStdPay PC 결제 연동
- [x] KG Inicis INImobile 모바일 결제 (UA 감지 자동 분기)
- [x] 이용약관·개인정보처리방침 독립 페이지 (`/shop/terms`, `/shop/privacy`)
- [x] 취급금지물품·환불정책·이용절차 안내
- [x] API 보안 헤더 + rate limiting

### Phase 3 — 고객 보관 서비스 🔄 진행 중

> PDF 기반 스토리지 결제·보관 서비스. KG Inicis 단건결제 연동 완료, 에스컬레이션·장기보관 예정.

- [x] DB 스키마 (040~044): customer_storages, storage_payments, storage_recurring_profiles, pickup_box_fees
- [x] 웹 고객 스토리지 대시보드 (`/storage`, `/storage/new`, `/storage/[id]`)
- [x] Admin 고객 보관 관리 (`/customer-storages`, `/customer-storages/[id]`)
- [x] 수거비 동적 산정: 박스 크기별 요금 DB 관리 + Admin 설정 화면
- [x] 단기보관 결제 API: KG Inicis 단건결제 (`/api/inicis/storage-return`)
- [x] PENDING_PAYMENT 상태 처리 (수거비 미결제 흐름)
- [ ] **결제 실패 에스컬레이션 cron** (→ Phase 6, 4순위)
- [ ] **해외배송 오픈 확인비** (→ Phase 7, 5순위)

---

> **아래 Phase 4~8은 계획된 다음 개발 단계입니다.**  
> 우선순위는 각 Phase 옆에 표기했습니다.

### Phase 4 — 장기보관 빌링 🔲 (6순위 · 빌링 계약 후 실연동)

> KG Inicis 정기결제(빌링) 계약이 완료되면 실연동. 그 전까지 로직 먼저 개발.

- [ ] storage_recurring_profiles 기반 월정액 자동결제 로직 구현
- [ ] 연체 처리 (1~30일 단계별 재시도)
- [ ] 빌링키 등록·갱신·해지 흐름
- [ ] 고객 이메일 알림 (결제 예정·성공·실패)
- [ ] Admin 정기결제 현황 대시보드

### Phase 5 — 단기→장기 전환 cron 🔲 (7순위 · Phase 4 직후)

> 단기보관 만료 후 장기보관으로 자동 전환하는 Cron 잡.

- [ ] 단기보관 만료 감지 cron (Vercel Cron)
- [ ] 고객 전환 동의 알림 발송 (in-app + 이메일)
- [ ] 장기보관 자동 전환 처리 (storage_recurring_profiles 생성)
- [ ] 전환 취소 시 출고 안내 흐름

### Phase 6 — 결제 실패 에스컬레이션 cron 🔲 (4순위)

> 보관 서비스 결제 실패 시 D+0/3/7/14/30 단계별 자동 처리.

- [ ] storage_escalation_logs 테이블 활용 (Phase 3 DB 이미 준비됨)
- [ ] Vercel Cron: 매일 미납 건 스캔 → 단계별 재결제 시도
- [ ] D+0: 즉시 재시도 + 고객 알림
- [ ] D+3·7: 재시도 + 경고 알림
- [ ] D+14: 보관함 SUSPENDED 처리 + 출고 안내
- [ ] D+30: OVERDUE 처리 + 운영팀 에스컬레이션

### Phase 7 — 해외배송 오픈 확인비 🔲 (5순위)

> 기존 해외배송 신청 흐름에 "오픈 확인비" 옵션을 확장.

- [ ] 해외배송 신청 단계에 오픈 확인비 옵션 추가 (UI)
- [ ] 견적 API에 오픈 확인비 항목 반영
- [ ] 결제 단계에 오픈 확인비 포함 처리
- [ ] Admin: 오픈 확인 완료 처리 + 사진 업로드

---

> ⚠️ **Phase 8은 별도 계약 완료 후 착수하는 다음 개발 단계입니다.**

### Phase 8 — 글로벌 결제 ⏸ (다음 개발 단계 · 별도 계약 완료 후)

> 해외 카드 및 글로벌 결제 수단(PayPal, Alipay 등) 지원. 별도 PG 계약 완료 후 착수.

- [ ] 글로벌 PG 벤더 선정 및 계약
- [ ] 다중 통화 결제 (USD, CNY, EUR 등)
- [ ] 해외 카드 결제 (Visa/Mastercard)
- [ ] 위챗페이·알리페이 등 중국 결제 수단
- [ ] 다국어 결제 UI 확장
- [ ] 환율 자동 적용 및 정산 처리

---

### 나머지 예정 작업 (Phase 2~3 범위)

- [ ] **입고 자동 동기화** 🔄 — GetResInfo + tracker.delivery, Cron·스케줄 (020~021)
- [ ] **고객 관리** 🔄 — 고객별 물품·주문 조회 (네비게이션 연결 예정)
- [ ] 관리자: 오픈박스 영상 업로드 (Cloudflare Stream)
- [ ] 관리자: 검수 결과 입력 + 사진 업로드 (Supabase Storage)
- [ ] 관리자: 실측 → 견적 확정 → 결제 요청 알림 (QUOTE_SENT)
- [ ] 관리자: 반품 처리 워크플로우
- [ ] 고객: 물품 사진/영상 타임라인 확인
- [ ] FCM 푸시 알림 전체 연동
- [ ] Capacitor WebView 앱 빌드 (iOS/Android)
- [ ] 통계 대시보드 (매출, 국가별, 서비스별)

---

## ⚙️ 환경변수

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 서비스 롤 키 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 토스페이먼츠 클라이언트 키 (공개) |
| `TOSS_SECRET_KEY` | 토스페이먼츠 시크릿 키 (서버 전용) |
| `EPOST_CUSTOMER_ID` | 우체국 고객 ID |
| `EPOST_APPROVAL_NO` | 우체국 승인번호 |
| `EPOST_SECURITY_KEY` | 우체국 SEED128 암호화 키 |
| `EPOST_TRACE_SERVICE_KEY` | 우체국 EMS 행방조회 OpenAPI 서비스키 (공공데이터포털) |
| `CRON_SECRET` | Vercel Cron 인증 (`Authorization: Bearer …`) |
| `PUBLIC_DATA_API_KEY` | 공공데이터포털 인증키 — **관세청 수입 과세환율(주간)** EMS 보험 USD→KRW 갱신 (1순위) |
| `KOREAEXIM_AUTH_KEY` | (선택) 한국수출입은행 환율 API — 관세청 API 실패 시 폴백 |
| `EMS_USD_KRW_RATE` | (선택) 수동 고정 환율 — DB·API 모두 실패 시 폴백 |
| `INFRONT_CENTER_ORD_NM` | 우체국 ord/rec 센터명 (기본 `인프론트`, modo `CENTER_RECIPIENT_NAME`) |
| `INFRONT_CENTER_NAME` | 표시용 센터 이름 |
| `INFRONT_CENTER_ZIPCODE` | **수거 도착지** 우편번호 (modo 동일, 기본 `41142`) |
| `INFRONT_CENTER_ADDR1` | **수거 도착지** 주소 (기본 `대구광역시 동구 동촌로 1` — 동대구우체국) |
| `INFRONT_CENTER_ADDR2` | **수거 도착지** 상세 (기본 `동대구우체국 2층 소포실`, modo `CENTER_ADDRESS2`) |
| `INFRONT_CENTER_PHONE` | 센터 연락처 (modo `CENTER_PHONE`) — **숫자만** `01027239490` (공백·하이픈은 코드에서 제거, 문자 포함 시 ERR-522) |

> **우체국 수거(reqType=2)**: `ord*` = 동대구우체국 소포실(도착), `rec*` = 고객 수거지. 회사 소재지(안심로)는 사용하지 않습니다. modo `shipments-book` 과 동일합니다.
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
| `CLOUDFLARE_STREAM_API_TOKEN` | Cloudflare Stream API 토큰 |
| `ADMIN_EMAILS` | 관리자 이메일 목록 (콤마 구분) |

---

## 🧭 개발 규칙

- **개발 현황**: [docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md) — 기능별 상세 일지 (README 로드맵과 동기화)
- **커밋 메시지**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **보안**: 모든 시크릿은 `.env.local`에만 보관, Git 커밋 금지
- **DB 접근**: 관리자 서버 라우트는 `SUPABASE_SERVICE_ROLE_KEY` 사용, 고객 웹은 RLS 의존
- **모바일 우선**: 최대 600px 컨테이너, Safe Area CSS 변수 적용
- **결제 정책**: 항상 창고 검수 후 견적 확정 → 고객 결제 순서로 진행
- **리전**: 우체국 ePost API는 Vercel ICN1(서울) 리전에서만 호출

---

## 📝 변경 이력

### 2026-06-08

#### 고객 보관 서비스 Phase 3 — 수거비 동적 산정 + 결제 안정화

**DB 스키마 확장 (043~044)**
- `043_storage_status_pending_payment.sql`: customer_storages 상태 확장 — PENDING_PAYMENT 추가 (수거비 미결제 상태)
- `044_pickup_box_fees.sql`: pickup_box_fees 테이블 — 박스 크기별 수거요금 Admin 관리

**수거비 동적 산정**
- `apps/web/app/api/storage/box-fees/route.ts` — 박스 크기별 요금 조회 API
- Admin 설정 화면에서 수거비 직접 수정 가능 (DEFAULT/SMALL/MEDIUM/LARGE/XL)
- 신규 보관 신청 시 박스 크기에 따라 수거비 자동 반영

**결제 안정화 (KG Inicis)**
- INImobile UA 감지 자동 분기 (PC/모바일)
- resultCode 0000 체크, idc_name authUrl 검증, netCancel 처리
- HPP(2) acceptmethod 추가 (핸드폰 결제 지원)
- 하단 네비 보관 탭 → `/storage` 라우팅 수정

---

### 2026-06-05 ~ 06-07

#### 포장대행 서비스 (Phase 2) 완성

**결제 연동**
- KG Inicis INIStdPay (PC) 직접 연동 완료
- INImobile (모바일) UA 감지 분기 완료
- PortOne v2 → KG Inicis 직접 연동으로 전환

**서비스 완성도**
- 포장대행 박스 가격 최종 확정 (S 15,000 / M 18,000 / L 22,000 / XL 28,000원)
- 주문 처리 기간 안내 배너 추가
- 다음 우편번호 주소 검색 연동
- 이용약관 동의 체크박스 추가
- `/shop/terms`, `/shop/privacy` 독립 페이지 (메인 사이트 UI 없이)

---

### 2026-06-04

#### 피킹·출고 워크플로우 완성 (Phase 1.7)

**DB 스키마 확장 (036~038)**
- `036_parcel_barcode_location.sql`: `parcel_barcodes.storage_location_id` — 아이템 단위 보관 위치 추적
- `037_outbound_picking.sql`: `orders` / `domestic_orders`에 피킹·출고 컬럼 추가; 주문 상태 확장 (`PICKING` / `PICKING_DONE` / `OUTBOUND_WAIT`)
- `038_outbound_sessions.sql`: `outbound_sessions` 테이블 — 출고 작업 세션 (박스 목록, 영상 URL, 스캔 로그, 담당자)
- `038_picking_item_tracking.sql`: `parcel_barcodes` 피킹 상태 (`WAITING/DONE/HOLD/NOT_FOUND`), `picking_scan_logs` 테이블 신설

**관리자 피킹 페이지**
- `apps/admin/app/(dashboard)/picking/page.tsx` — PAID 상태 주문 피킹 대기 목록 (국제/국내 통합)
- `apps/admin/app/(dashboard)/picking/[id]/page.tsx` — 피킹 상세: 바코드 스캔 → 물품별 DONE/HOLD/NOT_FOUND 처리, 전체 완료 시 PICKING_DONE 전환
- `apps/admin/app/api/admin/picking/[id]/route.ts` — 피킹 세션 조회/상태 업데이트
- `apps/admin/app/api/admin/picking/[id]/scan/route.ts` — 피킹 바코드 스캔 처리

**관리자 출고 페이지**
- `apps/admin/app/(dashboard)/outbound/page.tsx` — PICKING_DONE 주문 출고 대기 목록
- `apps/admin/app/api/admin/outbound/[id]/route.ts` — 출고 세션 조회/업데이트
- `apps/admin/app/api/admin/outbound/[id]/session/route.ts` — 출고 세션 생성/완료
- `apps/admin/app/api/admin/outbound/[id]/stream-upload/route.ts` — Cloudflare Stream 영상 업로드

**관리자 국내 주문 · 기타**
- `/domestic-orders`, `/domestic-orders/[id]`, `/domestic-orders/[id]/label` — 국내 배송 주문 관리
- `/orders/[id]/packing-slip` — 패킹 슬립 출력
- `DashboardNav.tsx`: 워크 섹션에 "피킹", "출고" 메뉴 추가

---

### 2026-06-02

#### 스토리지 리터=포인트 자동 배정 시스템 완성

**parcel_size_code 통일 (MINI/STANDARD/LONG/XL/OVERSIZE)**
- `admin/lib/parcels/size.ts`, `web/lib/parcels/size.ts` 신규 작성
  - 기존 SMALL/MEDIUM/LARGE/XLARGE → storage_types.code 와 동일한 코드로 통일
  - `weightKgToSizeCode(kg)` 함수: 픽업 무게 → size code 자동 매핑
    - ≤2kg → MINI(16L) / ≤5kg → STANDARD(40.5L) / ≤10kg → LONG(96L) / ≤20kg → XL(108.2L) / ≤30kg → OVERSIZE(480L)
- `sql/035_parcel_size_code_migrate.sql`: 기존 코드 일괄 변환 + pickup_weight_kg 기반 미설정 소포 자동 채우기

**수거신청 시점 자동 size code 저장**
- `apps/web/app/api/pickup/route.ts`
  - 박스 무게(`spec.weight`) 기반 `parcel_size_code` 계산 후 DB 저장
  - 수거신청 순간부터 스토리지 포인트가 확정됨

**입고 처리 자동 로케이션 배정 고도화** (`api/admin/inbound/process`)
1. 기존 고객 로케이션 리터 여유 체크 (재사용 우선)
2. **단계적 업사이징**: 딱 맞는 타입 → 한 단계 큰 타입 → ... 순으로 탐색
3. **분할 배정**: 단일 로케이션으로 부족하면 여러 로케이션을 묶어 합산 용량 확보
4. 최후 fallback: 타입·크기 무관 아무 빈 자리
- 입고 완료 화면에 분할 배정 시 추가 로케이션 코드 표시

#### 스토리지 타입 가격·용량 인라인 편집

- `apps/admin/app/(dashboard)/storage/manage/page.tsx`
  - 타입 카드에 📦 최대건수 + 💰 주간요금/상한요금 인라인 편집 UI 추가
- `apps/admin/app/api/admin/storage/route.ts` PATCH
  - `price_per_week`, `price_max` 수정 지원 추가

#### 로케이션 이동처리 전용 페이지 신설

- `apps/admin/app/(dashboard)/transfer/page.tsx` 신규
  - **바코드 2번 스캔**으로 즉시 이동처리: ① 소포 바코드 → ② 목적지 로케이션 코드
  - 내부 바코드·운송장번호·로케이션 코드 자동 판별
  - 완료 후 "다음 소포 스캔" 버튼으로 연속 처리
- `apps/admin/app/api/admin/transfer/scan/route.ts` 신규
  - 스캔 입력 자동 판별: 바코드 → 소포 / 로케이션 코드 → 로케이션+보관소포목록
- `DashboardNav.tsx`: 스토리지 섹션에 "이동처리" 메뉴 추가

---

### 2026-06-01

#### 스토리지 시스템 완성 (026~034 마이그레이션)

**스토리지 로케이션 관리**
- `026~031`: storage_locations, storage_zones, storage_types, 그리드·알림 뷰 구축
- `/storage` 페이지: Zone별 그리드, 타입 뱃지·사이즈·요금·보관일수 표시
- `/storage/[id]` 상세: 리터 용량 바, 보관 소포 카드, 고객 배정 관리

**입고처리 전용 페이지 + 내부 바코드 시스템**
- `032`: parcel_barcodes 테이블 (`{tracking_no}-01` 형식 내부 바코드)
- `/inbound` 전용 페이지: 바코드 스캔 → 소포 확인 → 사진 촬영 → 로케이션 배정

**스토리지 용량 관리 기반**
- `033~034`: storage_locations.max_parcels, parcels.parcel_size_code 컬럼 추가
- `/storage/manage` 페이지: Zone·슬롯 관리, 타입 지정, 아코디언 UI, 일괄 변경

**소포 위치 이동 이력**
- `035_parcel_location_history.sql`: parcel_location_events 테이블
- `/parcels/[id]` 상세: 위치 이동 이력 타임라인 표시

#### 국내배송 계산기 사이드바 위젯 추가
- `apps/web/components/ui/SidebarDomesticCalculator.tsx` 신규 생성
  - 창구접수 등기소포 요금 계산 (크기 L+W+H 합계 · 무게 기반 8구간)
  - 도서산간·제주 체크박스 선택 시 +2,500원 자동 가산
  - 전체 요금표 접기/펼치기 내장
- `SidebarWrapper.tsx` 업데이트: 경로별 위젯 분기
  - `/domestic-shipping`, `/domestic-rates` → `SidebarDomesticCalculator`
  - `/shipping-request` 등 해외배송 → 기존 `SidebarCalculator` (EMS · K-Packet) 유지
  - `/shipping-calc` → `SidebarShippingCalcInfo` 유지

#### 국내배송 가격표 페이지 개선 (`/domestic-rates`)
- 기존 동일권/타권 중량별 요금표 → **창구접수 등기소포** 요금표로 교체 (위젯과 데이터 일치)
- 부가서비스 항목 정리: 착불·보험·익일특급 제거, 비규격 소포 (+3,000원)만 유지
- 제주 안내 문구 수정: 단방향(→) → 쌍방향(↔) 표기

#### 홈 퀵링크 정비
- "가격표" → **해외배송 가격표**, "국내 택배 요금" → **국내배송 가격표** 레이블 통일
- 퀵링크 순서 조정: 국내배송 가격표를 쉬운 가이드보다 앞으로

---

## 📄 라이선스

Private — 무단 복제 및 배포 금지
