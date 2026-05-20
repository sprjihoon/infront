# 인프론트 (Infront)

> 국내 수거 → 입고 검수 → 합포장/재포장 → 국제배송 대행 플랫폼

---

## 📖 서비스 소개

**인프론트**는 고객이 국내에서 구매한 물품을 창고로 수거·보관하고, 검수·포장 후 해외로 발송하는 비대면 배송대행 서비스입니다.

- 고객은 **웹(infront.kr)** 또는 **WebView 앱(iOS/Android)**으로 접수합니다.
- 관리자·운영자는 **admin.infront.kr**에서 입고·검품·포장·출고·정산을 관리합니다.
- 결제는 **토스페이먼츠** 위젯으로 처리하며, 물류는 **우체국 API(국내수거 + EMS/K-Packet)**와 연동됩니다.
- **입고 오픈박스 영상 · 출고 패킹 영상**은 Cloudflare Stream에 업로드되어 고객에게 투명하게 공유됩니다. (핵심 신뢰 자산)

---

## 🔄 수거 및 배송 플로우

### 진입 방식 1 — 즉시배송 (수거 시 바로 신청)

```
수거신청 폼
  ├── 수거지 주소
  ├── 수거 희망일
  └── [✅ 수거 후 바로 해외배송 신청] 토글 ON
       ↓ 수거 완료 즉시
해외배송 신청 플로우 자동 이동
  ├── 배송 방법 선택 (EMS / EMS프리미엄 / K-Packet)
  ├── 포장 옵션 선택
  ├── 해외 배송지 입력
  └── 인보이스 (세관신고 물품 목록)
       ↓
창고 입고 → 실측 검수 → 견적 확정 알림
       ↓
고객 결제 → 발송
```

### 진입 방식 2 — 창고보관 후 신청 (기본)

```
수거신청 (주소 + 날짜만)
       ↓
창고 입고 · 보관 (마이창고에서 상태 확인)
       ↓
마이창고에서 물품 선택 (체크박스, 다중 선택 가능)
       ↓
[N개 물품 해외배송 신청] 버튼
       ↓
해외배송 신청 플로우 (5단계)
  Step 1. 물품 확인
  Step 2. 배송 방법 + 포장 옵션
  Step 3. 해외 배송지 선택 / 입력
  Step 4. 인보이스 (세관신고 물품 목록)
  Step 5. 예상 견적 확인 + 신청
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
| `EMS_PREMIUM` | EMS 프리미엄 | 빠른 국제우편, 2~4일 |
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
│   ├── mobile-cap/       # Capacitor WebView 앱 쉘 (iOS / Android)
│   │   ├── ios/          # Xcode 프로젝트
│   │   ├── android/      # Android 프로젝트
│   │   └── capacitor.config.ts
│   ├── edge/             # Supabase Edge Functions (Deno)
│   └── sql/              # Postgres DDL 및 마이그레이션
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
- **Framework**: Next.js 16 (App Router)
- **UI**: Tailwind CSS, Lucide Icons
- **상태관리**: TanStack Query (React Query)
- **인증**: Supabase SSR (`@supabase/ssr`)
- **결제**: Toss Payments SDK (`@tosspayments/tosspayments-sdk`)
- **앱 래핑**: Capacitor (WebView — iOS/Android 동시 대응)
- **배포**: Vercel

### 관리자 (`apps/admin`)
- **Framework**: Next.js (App Router)
- **UI**: Tailwind CSS, shadcn-ui, Recharts
- **영상 업로드**: tus-js-client (Cloudflare Stream 청크 업로드)
- **영상 재생**: hls.js (HLS 스트리밍)
- **배포**: Vercel

### 공통 백엔드
- **Database & Auth**: Supabase (Postgres + RLS + Auth)
- **영상 CDN**: Cloudflare Stream
- **사진 스토리지**: Supabase Storage
- **물류 (국내)**: 우체국 방문수거 API (ePost) + 송장 추적
- **물류 (국제)**: EMS / EMS프리미엄 / K-Packet API
- **Push 알림**: Firebase Cloud Messaging (FCM)

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
| `CUSTOMS_FILING` | 접수중 | EMS/K-Packet 접수 등록 + 패킹 영상 촬영 |
| `IN_TRANSIT` | 배송중 | 국제 운송 중 |
| `DELIVERED` | 배송완료 | 해외 수취인 수령 |
| `CANCELLED` | 취소 | 취소 처리 |

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

## 🗄 DB 스키마

```
001_init.sql         customers, parcels, orders, order_parcels,
                     parcel_media, packaging_requests, payments,
                     notifications, RLS, 고객번호 자동생성 트리거

002_pickup.sql       parcels: 수거 관련 컬럼 추가
                     (pickup_tracking_no, pickup_address, epost_*)

003_ems.sql          parcels: EMS 관련 컬럼 추가
                     (ems_regino, ems_fee, ems_country, ems_applied_at)

004_addresses.sql    customer_addresses 테이블
                     (type: pickup | overseas, 국내/해외 주소 분리)

005_services.sql     services          서비스 카탈로그 (코드, 요금, 카테고리)
                     order_services    주문별 서비스 항목
                     return_requests   반품 요청 (시점별 상태 관리)
                     inspection_results 검수 결과 (체크리스트 JSONB)
                     customers.auth_user_id 컬럼 추가

006_fix_addresses_rls.sql
                     customer_addresses RLS 수정
                     (auth_user_id 참조 → auth.uid() 직접 사용)
```

### 핵심 테이블 관계

```
customers (1) ──< parcels (N)              입고된 개별 물품
customers (1) ──< orders (N)               해외배송 주문 묶음
orders (N) ──< order_parcels >── parcels   합포장 M:N 연결
orders (1) ──< order_services (N)          주문별 부가 서비스
orders (1) ──< payments (N)                결제 내역
parcels (1) ──< inspection_results (N)     검수 결과
parcels (1) ──< return_requests (N)        반품 요청
customers (1) ──< customer_addresses (N)   수거지/해외 주소록
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

## 👤 고객 기능

| 기능 | 상태 | 설명 |
|---|---|---|
| 회원가입 / 로그인 | ✅ 완료 | 이메일, Supabase Auth |
| 고객번호 발급 | ✅ 완료 | 가입 시 자동 발급 (예: `SPB-20260518-0001`) |
| 개인 입고주소 제공 | ✅ 완료 | 고객번호 기반 전용 입고주소 |
| 수거 신청 | ✅ 완료 | 우체국 방문수거 API, 저장된 주소 선택 |
| 즉시배송 옵션 | ✅ 완료 | 수거 신청 시 해외배송 플로우 바로 진입 |
| 마이창고 | ✅ 완료 | 입고 물품 목록, 상태 필터, 검색 |
| 물품 선택 + 배송 신청 | ✅ 완료 | 체크박스 선택 → FAB 버튼 |
| 해외배송 신청 (5단계) | ✅ 완료 | 배송옵션→배송지→인보이스→견적 |
| 해외 배송지 주소록 | ✅ 완료 | 저장/수정/삭제, 기본 주소 설정 |
| 배송현황 (orders) | ✅ 완료 | 주문 목록, 상태 표시, 운송장 조회 |
| 결제 (Toss) | ✅ 완료 | 카드 결제, 결제 확인 API |
| 검수검품 서비스 신청 | 🔲 예정 | 의류/일반 검수 옵션 선택 |
| 빈 박스 배송 신청 | 🔲 예정 | 소/중/대 박스 국내 배송 |
| 반품 신청 | 🔲 예정 | 시점별 반품 플로우 |
| 물품 사진/영상 확인 | 🔲 예정 | 입고영상·검품사진·출고영상 타임라인 |
| FCM 푸시 알림 | 🔲 예정 | 단계별 상태 알림 |

---

## 🛠 관리자 기능

| 기능 | 상태 | 설명 |
|---|---|---|
| 접수건 관리 | 🔲 예정 | 상태별 필터, 검색, 벌크 상태변경 |
| 국내 송장 매칭 | 🔲 예정 | 스캔 → 고객 자동 매칭 |
| 오픈박스 영상 업로드 | 🔲 예정 | Cloudflare Stream (tus 청크 업로드) |
| 검수 결과 입력 | 🔲 예정 | 체크리스트 + 사진 업로드 |
| 발송 가능/불가/보류 처리 | 🔲 예정 | 보류 사유 → 고객 자동 알림 |
| 실측 무게/부피 입력 | 🔲 예정 | 부피중량 자동 계산 |
| 견적 확정 + 결제 요청 | 🔲 예정 | QUOTE_SENT → 고객 알림 |
| 반품 처리 | 🔲 예정 | 검수→포장→발송→완료 처리 |
| EMS/K-Packet 접수 | 🔲 예정 | 세관신고 데이터 자동 매핑 |
| 국제 운송장 등록 | 🔲 예정 | 등록 즉시 고객 알림 |
| 통계 대시보드 | 🔲 예정 | 접수건수, 매출, 국가별, 서비스별 |

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

- [x] Supabase 스키마 + RLS (001~006.sql)
- [x] 회원가입 → 고객번호/입고주소 자동 발급
- [x] 수거 신청 (우체국 ePost API 연동)
- [x] 마이창고 (입고현황, 물품 선택, 상태 필터)
- [x] 해외배송 신청 5단계 플로우
- [x] 해외 배송지 주소록 (저장/수정/삭제)
- [x] 인보이스 작성 (세관신고 물품 목록)
- [x] EMS 배송비 자동 견적 조회
- [x] 주문 생성 API (`POST /api/orders`)
- [x] 배송현황 페이지 (주문 목록 + 상태)
- [x] 결제 (Toss Payments SDK + confirm API)
- [x] 즉시배송 옵션 (수거 신청 시 바로 배송 플로우 진입)
- [x] 서비스 카탈로그 DB 설계 (services, order_services)
- [x] 반품 요청 DB 설계 (return_requests)
- [x] 검수 결과 DB 설계 (inspection_results)

### Phase 2 — 부가 서비스 + 관리자

- [ ] 검수검품 서비스 신청 UI
- [ ] 빈 박스 배송 신청 UI
- [ ] 반품 신청 플로우 (시점별)
- [ ] 관리자: 입고 처리 + 오픈박스 영상 업로드
- [ ] 관리자: 검수 결과 입력 + 사진 업로드
- [ ] 관리자: 실측 → 견적 확정 → 결제 요청
- [ ] 관리자: 반품 처리 워크플로우
- [ ] 고객: 물품 사진/영상 타임라인

### Phase 3 — 완성도 + 앱

- [ ] FCM 푸시 알림 전체 연동
- [ ] 관리자: EMS/K-Packet 자동 접수
- [ ] 운송장 추적 연동
- [ ] Capacitor WebView 앱 빌드 (iOS/Android)
- [ ] 통계 대시보드
- [ ] 빈 박스 배송 주문 처리 관리자 플로우

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
| `INFRONT_CENTER_NAME` | 물류센터 이름 |
| `INFRONT_CENTER_ZIPCODE` | 물류센터 우편번호 |
| `INFRONT_CENTER_ADDR1` | 물류센터 주소 |
| `INFRONT_CENTER_ADDR2` | 물류센터 상세주소 |
| `INFRONT_CENTER_PHONE` | 물류센터 연락처 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
| `CLOUDFLARE_STREAM_API_TOKEN` | Cloudflare Stream API 토큰 |

---

## 🧭 개발 규칙

- **커밋 메시지**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **보안**: 모든 시크릿은 `.env.local`에만 보관, Git 커밋 금지
- **DB 접근**: 관리자 서버 라우트는 `SUPABASE_SERVICE_ROLE_KEY` 사용, 고객 웹은 RLS 의존
- **모바일 우선**: 최대 430px 컨테이너, Safe Area CSS 변수 적용
- **결제 정책**: 항상 창고 검수 후 견적 확정 → 고객 결제 순서로 진행

---

## 📄 라이선스

Private — 무단 복제 및 배포 금지
