# 스프링박스 (SpringBox)

> 국내 수거 → 입고 확인 → 합포장/재포장 → 국제배송 대행 플랫폼

---

## 📖 서비스 소개

**스프링박스**는 고객이 국내에서 구매한 물품을 개인 입고주소로 받아, 합포장·재포장·특수포장 후 해외로 발송하는 비대면 배송대행 서비스입니다.

- 고객은 **웹(infront.kr)** 또는 **WebView 앱(iOS/Android)**으로 접수합니다.
- 관리자·운영자는 **admin.infront.kr**에서 입고·검품·포장·출고·정산을 관리합니다.
- 결제는 **토스페이먼츠** 위젯으로 처리하며, 물류는 **우체국 API(국내수거 + EMS/K-Packet)**와 연동됩니다.
- **입고 오픈박스 영상 · 출고 패킹 영상**은 Cloudflare Stream에 업로드되어 고객에게 투명하게 공유됩니다. (핵심 신뢰 자산)

---

## 🔄 서비스 플로우

```
고객 접수
    ↓
우체국 방문수거 (국내 택배)
    ↓
스프링박스 창고 입고
    ↓  📹 오픈박스 영상 촬영
내품 검품 (사진 다중 촬영)
    ↓  📷 물품 전체 사진
발송 가능 여부 확인
    ↓
합포장 / 재포장 / 특수포장
    ↓  📷 포장 전/후 사진
국제배송비 확정
    ↓
결제 (토스페이먼츠)
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
│   ├── web/              # Next.js 14 고객 웹앱 (infront.kr)
│   ├── admin/            # Next.js 14 관리자 콘솔 (admin.infront.kr)
│   ├── mobile-cap/       # Capacitor WebView 앱 쉘 (iOS / Android)
│   │   ├── ios/          # Xcode 프로젝트
│   │   ├── android/      # Android 프로젝트
│   │   └── capacitor.config.ts
│   ├── edge/             # Supabase Edge Functions (Deno)
│   └── sql/              # Postgres DDL 및 마이그레이션
├── supabase/migrations/
├── docs/
│   ├── database-schema.md
│   ├── status-flow.md
│   └── api-spec.md
└── README.md
```

---

## 🔗 서비스 URL

| 서비스 | URL | 설명 |
|---|---|---|
| 고객 웹 | infront.kr | Next.js 고객 포털 (`apps/web`) |
| 관리자 | admin.infront.kr | 관리자·운영 콘솔 (`apps/admin`) |
| iOS 앱 | App Store | Capacitor WebView (`apps/mobile-cap`) |
| Android 앱 | Google Play | Capacitor WebView (`apps/mobile-cap`) |

---

## 🧩 기술 스택

### 고객 웹 · 앱 (`apps/web` + `apps/mobile-cap`)
- **Framework**: Next.js 14 (App Router, `output: export`)
- **UI**: Tailwind CSS, Lucide Icons
- **상태관리**: TanStack Query (React Query)
- **인증**: Supabase SSR (`@supabase/ssr`)
- **결제**: Toss Payments SDK
- **앱 래핑**: Capacitor (WebView — iOS/Android 동시 대응)
- **Capacitor 플러그인**: Camera, PushNotifications, Share, SplashScreen, StatusBar, Haptics, Browser
- **배포**: Vercel (웹) + App Store / Google Play (앱)

### 관리자 (`apps/admin`)
- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS, shadcn-ui, Recharts
- **영상 업로드**: tus-js-client (Cloudflare Stream 청크 업로드)
- **영상 재생**: hls.js (HLS 스트리밍)
- **배포**: Vercel

### 공통 백엔드
- **Database & Auth**: Supabase (Postgres + RLS + Auth)
- **Edge Functions**: Deno (결제 확인, 알림, EMS 접수 등)
- **영상 CDN**: Cloudflare Stream (오픈박스 영상, 출고 패킹 영상)
- **사진 스토리지**: Supabase Storage (검품 사진, 포장 전후 사진)
- **물류 (국내)**: 우체국 방문수거 API + 송장 추적
- **물류 (국제)**: EMS / EMS프리미엄 / K-Packet API
- **Push 알림**: Firebase Cloud Messaging (FCM)

---

## 📦 주문 상태 머신

| 상태 | 레이블 | 설명 |
|---|---|---|
| `DRAFT` | 작성중 | 고객 접수서 작성 중 |
| `PENDING_PICKUP` | 수거신청 | 우체국 방문수거 예약 완료 |
| `PICKED_UP` | 수거완료 | 국내 택배 수거 완료 |
| `INBOUND` | 입고완료 | 창고 입고 + 오픈박스 영상 촬영 완료 |
| `INSPECTION` | 검품중 | 내품 확인 + 사진 촬영 중 |
| `HOLD` | 보류 | 통관불가·파손 등 고객 확인 필요 |
| `PACKAGING_REQUESTED` | 포장요청 | 합포장/재포장/특수포장 요청 접수 |
| `PACKAGING_DONE` | 포장완료 | 포장 작업 완료 + 사진 촬영 |
| `QUOTE_SENT` | 견적발송 | 국제배송비 + 작업비 고객에게 발송 |
| `PENDING_PAYMENT` | 결제대기 | 고객 결제 대기 |
| `PAID` | 결제완료 | 토스페이먼츠 결제 승인 |
| `CUSTOMS_FILING` | 접수중 | EMS/K-Packet 접수 등록 + 패킹 영상 촬영 |
| `IN_TRANSIT` | 배송중 | 국제 운송 중 |
| `DELIVERED` | 배송완료 | 해외 수취인 수령 |
| `CANCELLED` | 취소 | 취소 처리 |

---

## 🎬 핵심 기능: 투명한 물품 기록 시스템

타 업체와의 핵심 차별점입니다. 고객이 직접 볼 수 없는 창고 내 모든 과정을 영상·사진으로 공개합니다.

### 미디어 단계별 역할

| 단계 | 미디어 | 저장소 | 설명 |
|---|---|---|---|
| 입고 오픈박스 | 🎬 영상 | Cloudflare Stream | 박스 개봉 전 과정 — 조작 불가 증거 |
| 내품 검품 | 📷 사진 N장 | Supabase Storage | 개별 물품 상세 확인 |
| 포장 작업 | 📷 전/후 사진 | Supabase Storage | Before-After 비교 |
| 출고 패킹 | 🎬 영상 | Cloudflare Stream | 물건 담기→밀봉→무게 측정 전 과정 |

### 고객 타임라인 UI

```
● 입고완료  05.18 14:32
  ┌──────────────────────────┐
  │  ▶  오픈박스 영상  0:42  │  ← HLS 플레이어 전체화면
  └──────────────────────────┘

● 물품 확인  05.18 15:10
  ┌──────────────────────────┐
  │ [img][img][img][img]+3   │  ← 사진 갤러리 (핀치줌)
  └──────────────────────────┘
  의류 3점 / 잡화 2점 / 총 5점 확인

● 출고 준비  05.18 16:45
  ┌──────────────────────────┐
  │  ▶  패킹 영상  1:12      │  ← 물건 담기 + 밀봉 + 무게 클로즈업
  └──────────────────────────┘
  실측 2.3kg / 32×28×24cm
```

### 촬영 표준 (운영 가이드)

**오픈박스 영상**
- 박스 전면(송장 포함) 5초 고정 후 개봉 시작
- 내용물 꺼내기 전 과정 포함
- 최소 30초 ~ 최대 3분

**출고 패킹 영상**
- 빈 박스 + 물품 나열 → 순서대로 담기 → 완충재 → 밀봉
- 저울 위 무게 화면 클로즈업 필수
- 최소 1분

---

## 👤 고객 기능

| 기능 | 설명 |
|---|---|
| 회원가입 / 간편접수 | 이메일 회원가입, Supabase Auth |
| 고객번호 발급 | 가입 시 자동 발급 (예: `SPB-20260518-0001`) |
| 개인 입고주소 제공 | 고객번호 기반 전용 입고주소 |
| 해외배송 접수 (4단계) | 수취인 → 물품리스트 → 포장요청 → 수거신청 |
| 물품 사진/영상 확인 | 입고영상·검품사진·출고영상 타임라인 |
| 수거 신청 | 우체국 방문수거 API 연동 |
| 입고 현황 확인 | 마이 창고 — 단계별 상태 |
| 합포장 / 재포장 / 특수포장 요청 | 포장 유형 선택 + 요청사항 입력 |
| 배송비 견적 확인 | EMS / EMS프리미엄 / K-Packet 요금 비교 |
| 결제 | 토스페이먼츠 위젯 |
| 운송장 조회 | 국제 운송장 추적 연동 |
| 상태 알림 | FCM 푸시 알림 |

---

## 🛠 관리자 기능

| 기능 | 설명 |
|---|---|
| 접수건 관리 | 상태별 필터, 검색, 벌크 상태변경 |
| 국내 송장 매칭 | 스캔 → 고객 자동 매칭 |
| 오픈박스 영상 업로드 | Cloudflare Stream (tus 청크 업로드) |
| 검품 사진 업로드 | 다중 사진, 캡션, 공개 여부 설정 |
| 발송 가능/불가/보류 처리 | 보류 사유 입력 → 고객 자동 알림 |
| 합포장 작업 관리 | 대상 parcel 선택, 작업 전/후 사진 |
| 실측 무게 / 부피 입력 | 부피중량 자동 계산 |
| 국제배송비 / 작업비 입력 | 견적 확정 → 결제 요청 발송 |
| 출고 패킹 영상 업로드 | Cloudflare Stream |
| EMS/K-Packet 접수 정보 생성 | 세관신고 데이터 자동 매핑 |
| 국제 운송장 등록 | 등록 즉시 고객 알림 |
| 상태 변경 / 고객 알림 | 단계별 자동 푸시 발송 |
| 통계 대시보드 | 접수건수, 매출, 국가별, 포장유형별 |

---

## 📱 앱 전략 (PWA + Capacitor WebView)

Flutter 대신 **Next.js WebView를 Capacitor로 래핑**하여 iOS/Android 동시 대응합니다.

```
Next.js 웹앱 (output: export)
        ↓
  Capacitor 앱 쉘
  ├── iOS  → App Store
  └── Android → Google Play
```

- 웹 1개 코드베이스로 웹/iOS/Android 모두 대응
- Flutter 대비 앱 개발 기간 약 8~12주 단축
- Safe Area (노치/홈바) CSS 환경변수로 처리
- 카메라·푸시알림·햅틱 등 네이티브 기능은 Capacitor 플러그인 사용

---

## 🗄 핵심 DB 스키마

```sql
customers       -- 고객 (고객번호, 개인입고주소)
parcels         -- 개별 입고 물품 (국내 송장 매칭, 검품 결과)
orders          -- 해외배송 주문 (parcels 묶음, 포장유형, 배송비)
parcel_media    -- 단계별 미디어 (영상: cf_stream_uid / 사진: storage_url)
packaging_reqs  -- 포장 요청 및 작업 내역
payments        -- 결제 내역 (토스페이먼츠)
notifications   -- 고객 알림
```

### parcel_media stage 종류
```
INBOUND_VIDEO       -- 오픈박스 영상 (Cloudflare Stream)
INSPECTION_PHOTO    -- 내품 검품 사진 (Supabase Storage)
PACKAGING_PHOTO     -- 포장 전/후 사진 (Supabase Storage)
OUTBOUND_VIDEO      -- 출고 패킹 영상 (Cloudflare Stream)
RECEIPT_PHOTO       -- EMS 접수증 사진
```

### Supabase Storage 구조
```
bucket: parcel-media
  /{customer_id}/{parcel_id}/
    /inspection/   -- 검품 사진
    /packaging/    -- 포장 전/후 사진
    /receipt/      -- 접수증 사진
```

---

## 🚀 개발 로드맵

### Phase 1 — MVP (8주)
- [ ] Supabase 스키마 + RLS 설정
- [ ] 고객 웹: 회원가입 → 고객번호/입고주소 발급
- [ ] 고객 웹: 마이창고 (입고현황 조회)
- [ ] 관리자: 입고 처리 + 오픈박스 영상 업로드 (Cloudflare Stream)
- [ ] 관리자: 검품 사진 업로드
- [ ] 관리자: 실측 → 배송비 입력 → 결제 요청
- [ ] 결제 (토스페이먼츠)
- [ ] 관리자: 출고 패킹 영상 업로드 + 국제운송장 등록
- [ ] 고객 웹: 타임라인 (영상/사진) + 운송장 조회
- [ ] PWA 설정 (manifest + Service Worker)

### Phase 2 (4주)
- [ ] 합포장 / 재포장 / 특수포장 요청 플로우
- [ ] 발송 가능 여부 판단 + 보류 알림
- [ ] FCM 푸시 알림 전체 연동
- [ ] 우체국 방문수거 API 연동

### Phase 3 (2주)
- [ ] Capacitor WebView 앱 빌드 (iOS/Android)
- [ ] 앱스토어 제출 (스크린샷, 설명, 아이콘)
- [ ] EMS / K-Packet 자동 요금 계산
- [ ] 통계 대시보드

---

## ⚙️ 환경변수

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 서비스 롤 키 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 토스페이먼츠 클라이언트 키 |
| `TOSS_SECRET_KEY` | 토스페이먼츠 시크릿 키 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
| `CLOUDFLARE_STREAM_API_TOKEN` | Cloudflare Stream API 토큰 |
| `NEXT_PUBLIC_APP_URL` | 서비스 URL |

---

## 🧭 개발 규칙

- **커밋 메시지**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **보안**: 모든 시크릿은 `.env.local`에만 보관, Git 커밋 금지
- **DB 접근**: 관리자 서버 라우트는 `SUPABASE_SERVICE_ROLE_KEY` 사용, 고객 웹은 RLS 의존
- **모바일 우선**: 최대 430px 컨테이너, Safe Area CSS 변수 적용
- **정적 빌드**: `output: export` 유지 (Capacitor 호환), API Route 대신 Edge Function 사용

---

## 📄 라이선스

Private — 무단 복제 및 배포 금지
