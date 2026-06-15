# ������Ʈ (Infront)

> ���� ���� �� â�� �԰� �� �˼� �� ������/������ �� ������� ���� �÷���

---

## ?? ���� �Ұ�

**������Ʈ**�� ����� �������� ������ ��ǰ�� â��� ���š������ϰ�, �˼������� �� �ؿܷ� �߼��ϴ� ���� ��۴��� �����Դϴ�.

- ����� **��(infront.kr)** �Ǵ� **WebView ��(iOS/Android)**���� �����մϴ�.
- �����ڡ���ڴ� **admin.infront.kr**���� �԰����ǰ�����塤���������� �����մϴ�.
- ������ **�佺���̸���** �������� ó���ϸ�, ������ **��ü�� API(�������� + EMS/K-Packet)**�� �����˴ϴ�.
- **�԰� ���¹ڽ� ���� �� ��� ��ŷ ����**�� Cloudflare Stream�� ���ε�Ǿ� ������� �����ϰ� �����˴ϴ�. (�ٽ� �ŷ� �ڻ�)

---

## ?? ���� �� ��� �÷ο�

```
���Ž�û (�ּ� + ��¥��)
       ��
â�� �԰� �� ���� (���丮������ ���� Ȯ��)
       ��
���丮������ ��ǰ ���� (üũ�ڽ�, ���� ���� ����)
       ��
[N�� ��ǰ �ؿܹ�� ��û] ��ư
       ��
�ؿܹ�� ��û �÷ο� (�ٴܰ�)
  Step 1. ��ǰ Ȯ��
  Step 2. ��� ��� + ���� �ɼ� ����
  Step 3. �ؿ� ����� ���� / �Է�
  Step 4. �κ��̽� (�����Ű� ��ǰ ���)
       ��
â�� �˼� �� ���� Ȯ�� �˸� (QUOTE_SENT)
       ��
��� ���� (Toss) �� ���� �� EMS ���� �� �߼�
```

### ?? ���� Ÿ�̹� ��å

> **������ �׻� ���� Ȯ�� �� �����մϴ�.**

���� ��û �������� ���� ���ԡ����Ǹ� �� �� �����Ƿ�, â�� �԰� �� ���� �������� ��Ȯ�� ������ �����Ͽ� ������� �˸��� �߼��մϴ�. ���� ����� ��û �ܰ迡�� ��������θ� �����˴ϴ�.

---

## ?? ���� īŻ�α�

### �ؿܹ��

| �ڵ� | ���񽺸� | Ư¡ |
|------|---------|------|
| `EMS` | EMS | �Ϲ� ��������, 3~7�� |
| `EMS_PREMIUM` | EMS �����̾� | FedEx Ư��, 2~4��, �ִ� 70kg (2026.4~ UPS��FedEx) |
| `KPACKET` | K-Packet | ���� �淮 ȭ��, 7~15��, 2kg ���� |

### ���� ����

| �ڵ� | ���񽺸� | ���� | ��� |
|------|---------|------|------|
| `SAFE_PACK` | �������� | ����ĸ, ������ �߰� | +3,000�� |
| `REPACK` | ������ | �� �ڽ��� ��ü | +2,000�� |
| `CONSOLIDATE` | ������ | ���� ��ǰ�� �ϳ��� ��ġ�� | +2,000�� |

### �˼���ǰ ����

| �ڵ� | ���񽺸� | ���� | ��� |
|------|---------|------|------|
| `BASIC_INSPECT` | �⺻ �˼� | �ܰ� ���� �Կ� (�⺻ ����) | ���� |
| `DETAIL_INSPECT` | �� �˼� | ��ü ���� + üũ����Ʈ | +3,000�� |
| `CLOTHING_INSPECT` | �Ƿ� �˼� | ��ħ/��/���ĸ� �Կ� | +2,000�� |

�˼� �� �ҷ� �߰� �� ��� ��ǰ ��û���� ���� �����մϴ�.

### �� �ڽ� ��� ����

�ڽ��� ������ ���� ������� �� �ڽ��� ���� ����ص帮�� �����Դϴ�.

| �ڵ� | ���񽺸� | �԰� | ��� |
|------|---------|------|------|
| `BOX_S` | ���� �ڽ� ��� | 20��20��20cm ���� | 3,000�� |
| `BOX_M` | ���� �ڽ� ��� | 40��30��30cm ���� | 4,000�� |
| `BOX_L` | ���� �ڽ� ��� | 60��50��50cm ���� | 5,000�� |

### ��ǰ ����

â��� ������ ��ǰ�� ���� �Ǹ��ڿ��� ��ǰ ó���ص帮�� �����Դϴ�.

| ���� | ���� |
|------|------|
| ���� �� | ���� ��� ��û |
| ��� �� (���� ��~�԰� ��) | â�� ���� ��� ��ǰ ó�� |
| â�� ���� �� | �԰�� ��ǰ ��ǰ ��û |
| �˼� �� ��� | �˼� ��� ȭ�鿡�� ��Ŭ�� ��ǰ |
| �ؿ� ���� �� | ����� �츮 â��� ���� �߼� �� ó�� |

> **��ǰ ó�� ����:** â�� �� ���� �Ǹ��� �߼�. ȯ�� ó���� ���-�Ǹ��� �� ���� ����.

---

## ?? ���� ��ü �÷ο�

```
��� ���� (���Ž�û)
    ��
��ü�� �湮���� (���� �ù�)
    ��
������Ʈ â�� �԰�
    ��  ?? ���¹ڽ� ���� �Կ�
�⺻ �˼� (���� �Կ�) ? �ɼ�: �󼼰˼� / �Ƿ��˼�
    ��  ?? ��ǰ ��ü ����
    ������ [��ǰ ��û ��] �� ���� �Ǹ��ڿ��� ��ǰ �߼�
    ������ [�ؿܹ�� ����] �� �Ʒ� ���
������ / ������ / �������� ó��
    ��  ?? ���� ��/�� ����
���� ���� �� ���� Ȯ��
    ��
������ۺ� + ���� ��� Ȯ�� �� ��� ���� �˸� (QUOTE_SENT)
    ��
��� ���� (�佺���̸���)
    ��  ?? ��� ��ŷ ���� �Կ�
EMS / EMS�����̾� / K-Packet ����
    ��
�ؿ� �����ο��� ���
```

---

## ?? ������Ʈ ����

```
infront/
������ apps/
��   ������ web/              # Next.js 16 ��� ���� (infront.kr)
��   ������ admin/            # Next.js ������ �ܼ� (admin.infront.kr)
��   ������ mobile-cap/       # Capacitor WebView �� �� (iOS / Android) ? ����
��   ��   ������ ios/          # Xcode ������Ʈ
��   ��   ������ android/      # Android ������Ʈ
��   ��   ������ capacitor.config.ts
��   ������ edge/             # Supabase Edge Functions (Deno) ? ����
��   ������ sql/              # Postgres DDL �� ���̱׷��̼� (001~044)
������ docs/                 # ���� ��Ȳ������ ����
��   ������ DEVELOPMENT_STATUS.md
������ vercel.json
������ README.md
```

---

## ?? ���� URL

| ���� | URL | ���� |
|---|---|---|
| ��� �� | infront-app.vercel.app | Next.js ��� ���� (`apps/web`) |
| ������ | admin.infront.kr | �����ڡ�� �ܼ� (`apps/admin`) |
| iOS �� | App Store | Capacitor WebView (`apps/mobile-cap`) |
| Android �� | Google Play | Capacitor WebView (`apps/mobile-cap`) |

---

## ?? ��� ����

### ��� �� �� �� (`apps/web` + `apps/mobile-cap`)

| �з� | ��� |
|------|------|
| Framework | Next.js 16.2 (App Router), React 19 |
| UI | Tailwind CSS 4, Lucide Icons, ����� �۽�Ʈ (max-w-600px) |
| ���°��� | TanStack Query (React Query) |
| ���� | Supabase SSR (`@supabase/ssr`) |
| ���� | Toss Payments SDK (`@tosspayments/tosspayments-sdk`) |
| �� ���� | Capacitor (WebView ? iOS/Android) |
| ���� | Vercel (ICN1 Seoul ����) |

### ������ (`apps/admin`)

| �з� | ��� |
|------|------|
| Framework | Next.js 16 (App Router) |
| UI | Tailwind CSS 4 |
| ���� | �̸��� ȭ��Ʈ����Ʈ (`ADMIN_EMAILS` ȯ�溯��) |
| DB ���� | Supabase Service Role Key (RLS ��ȸ) |
| ���� ���ε� | tus-js-client (Cloudflare Stream ûũ ���ε�) ? ���� |
| ���� ��� | hls.js (HLS ��Ʈ����) ? ���� |

### ���� �鿣�� �� �ܺ� ����

| �з� | ��� |
|------|------|
| Database & Auth | Supabase (Postgres + RLS + Auth) |
| ���� (����) | ��ü�� ePost API ? �湮����, ���, ������ȸ (SEED128) �� tracker.delivery (Ÿ�ù� ����) |
| ���� (����) | EMS / EMS�����̾� / K-Packet API |
| �ּ� �˻� | ���� �����ȣ API |
| ���� | Toss Payments |
| ���� CDN | Cloudflare Stream ? ���� |
| ���� ���丮�� | Supabase Storage ? ���� |
| Push �˸� | Firebase Cloud Messaging (FCM) ? ���� |

---

## ?? ��� ���� ������ ���� (`apps/web`)

### ���� �� (`/(main)`) ? �α��� �ʿ�

| ��� | ������ | ���� |
|------|--------|------|
| `/home` | Ȩ | �׼� ��ú���, �ֱ� ��� ��Ȳ, â�� ���, ���� ��ũ |
| `/pickup` | ���� ��û | ��ü�� ePost �湮���� ��û, �ּ� ����, ��ǰ ��� |
| `/pickup/history` | ���� ��Ȳ | ���� �� �� �̵� �� �� �԰� �� ��, ���� ��� |
| `/warehouse` | ���丮�� | �԰� ��ǰ ���, ���� ����, ���� ���� |
| `/warehouse/[id]` | ��ǰ �� | �ζ��� ����, ����, �ΰ� ���� |
| `/shipping-request` | ��� ��û | �ٴܰ� �÷ο� (��ǰ��ɼǡ��ּҡ��κ��̽�) |
| `/orders` | �����Ȳ | �ֹ� ���, ���� ǥ��, ����� ��ȸ |
| `/storage` | ���� ���� | ������ ��ú��� ? ���ī�塤���������� ī�� �׸��塤��ǰ ��� ���ڵ������¡ |
| `/storage/new` | ���� ��û | ��⺸�� �÷� ���� �� ������ ���� |
| `/storage/[id]` | ���� �� | ��� ���� ��ǰ ���, ����, ���� ��Ȳ |
| `/storage/payment/success` | ���� ���� ���� | KG Inicis �ܰǰ��� ��� ó�� |
| `/storage/payment/fail` | ���� ���� ���� | ���� ���С���� ó�� |
| `/mypage` | MY | ������, �����ȣ, �԰��ּ�, �����Ȳ��������Ȳ �ٷΰ��� |
| `/addresses` | �ּҷ� | ���������ؿ� ����� ���� |
| `/register-parcel` | ��ǰ ��� | ���� ��ǰ ��� |
| `/return-request` | ��ǰ ��û | ��ǰ ��û UI |
| `/shipping-calc` | ��ۺ� ��� | �ؿ� ��ۺ� ���� ���� |
| `/pricing` | �ؿܹ�� ����ǥ | ��ü�� ���� EMS/K-Packet ���ǥ |
| `/domestic-rates` | ������� ����ǥ | â������ ������ ��ݡ��԰ݡ����� �ȳ� |
| `/guide` | �̿� ���̵� | ���� �̿� �ȳ� |
| `/notices` | �������� | ���� ��� |
| `/notifications` | �˸� | in-app �˸� ��� |
| `/postcode` | �ּ� �˻� | ���� �����ȣ �˻� ���� |
| `/payment/success` | ���� ���� | Toss ���� ��� ó�� |
| `/payment/fail` | ���� ���� | Toss ���� ���� ó�� |
| `/login`, `/signup` | ���� | Supabase �̸��� ���� |

**�ϴ� �ǹ� (5��):** Ȩ / ���Ž�û / ���丮�� / ����û / MY  
*(�����Ȳ�� Ȩ ���� ���� �׸��� �� �������������� ����)*

**���̵�� ���� (xl+ ����ũž):**
- �ؿܹ�� ��� (`/shipping-request` ��): EMS �� K-Packet ��� ���� + ��� ����
- ������� ��� (`/domestic-shipping`, `/domestic-rates`): â������ ������ ���� (�����갣 üũ�ڽ�)
- `/shipping-calc`: �ؿܹ�� ����ǥ����� ���� �г�

### ������� ���� (`/shop`) ? �α��� ���ʿ� (���� ����)

| ��� | ������ | ���� |
|------|--------|------|
| `/shop` | ��ǰ ��� | S/M/L/XL �ڽ� �������, KO/EN ���̸�����, KG Inicis ���� |
| `/shop/checkout` | ���� �� | �ֹ����� �Է�, ���� �����ȣ �ּ� �˻�, �̿��� ���� |
| `/shop/payment/success` | ���� ���� | KG Inicis ���� �Ϸ� ó�� |
| `/shop/payment/fail` | ���� ���� | ���� ���С���� ó�� |
| `/shop/payment/close` | ���� â �ݱ� | INIpay �˾� ���� ó�� |
| `/shop/terms` | �̿��� | ������� ���� �̿��� (���� ������) |
| `/shop/privacy` | ��������ó����ħ | ������� ���� ��������ó����ħ (���� ������) |

---

## ?? ��� API ���Ʈ (`apps/web/app/api/`)

### ���� ���� API

| ��������Ʈ | �޼��� | ���� |
|-----------|--------|------|
| `/api/pickup` | POST | ��ü�� ���� ��û (customer_storage_id ���� ����) |
| `/api/pickup/[id]` | DELETE | ���� ��� (ePost + DB) |
| `/api/pickup/[id]/status` | GET | ���� ���� ��ȸ (GetResInfo) |
| `/api/parcels` | POST | ��ǰ ��� |
| `/api/parcels/[id]` | PATCH | ��ǰ ���� |
| `/api/parcels/[id]/service-requests` | GET, POST | ��ǰ�� �ΰ� ���� |
| `/api/parcels/sync-tracking` | POST | ���� ���� �̺�Ʈ ����ȭ |
| `/api/orders` | GET, POST | �ֹ� ��� ��ȸ / ���� |
| `/api/ems/nations` | GET | EMS ��� ���� ���� ��� |
| `/api/ems/quote` | GET, POST | EMS/K-Packet ��ۺ� ���� |
| `/api/ems/apply` | POST | EMS ���� ��� |
| `/api/ems/exchange-rate` | GET | USD/KRW ȯ�� ��ȸ |
| `/api/payment/confirm` | POST | Toss ���� ���� + EMS �ڵ� ���� |
| `/api/return-requests` | GET, POST | ��ǰ ��û |
| `/api/domestic-orders` | GET, POST | ���� �ֹ� ��� / ���� |
| `/api/cron/sync-inbound` | GET | �԰� �� ���� �ڵ� ����ȭ (Vercel Cron) |
| `/api/cron/sync-intl-tracking` | GET | ���� ����� ���� ����ȭ (Vercel Cron) |
| `/api/cron/sync-usd-krw-rate` | GET | USD/KRW ȯ�� ���� (Vercel Cron, �� 1ȸ) |

### ���� ���� API

| ��������Ʈ | �޼��� | ���� |
|-----------|--------|------|
| `/api/storage` | GET, POST | ��� ������ ��� ��ȸ / ��û (�ڵ� ���� �̸� ����) |
| `/api/storage/[id]` | GET, PATCH | ������ �� / ���� ���� |
| `/api/storage/[id]/items` | GET, POST | ���� ������ ��� / �߰� |
| `/api/storage/all-items` | GET | ��ü ���� ������ �����Ű� ��ǰ ��� (��ǰ�������ϡ�����) |
| `/api/storage/my-locations` | GET | ��� ���� storage_locations + Ÿ�ԡ���� ��� |
| `/api/storage/types` | GET | Ȱ�� storage_types ��� (�뷮���� UI��) |
| `/api/storage/plans` | GET | ���� �÷� ��� (storage_plan_config) |
| `/api/storage/box-fees` | GET | ���� �ڽ� ũ�⺰ ��� ��ȸ (pickup_box_fees) |
| `/api/storage/pay/prepare` | POST | ���� ���� ���� �غ� |
| `/api/inicis/prepare` | POST | KG Inicis PC ���� ���� ���� |
| `/api/inicis/return` | POST | KG Inicis PC ���� ��� ó�� |
| `/api/inicis/mobile-prepare` | POST | KG Inicis ����� ���� �غ� |
| `/api/inicis/mobile-return` | POST | KG Inicis ����� ���� ��� ó�� |
| `/api/inicis/storage-return` | POST | KG Inicis ���� ���� ���� ��� ó�� |

### ������� ���� API

| ��������Ʈ | �޼��� | ���� |
|-----------|--------|------|
| `/api/shop/confirm` | POST | KG Inicis ������� ���� ���� ó�� |

---

## ?? ������ �ܼ� ������ ���� (`apps/admin`)

| ��� | ������ | ���� |
|------|--------|------|
| `/login` | ������ �α��� | ? |
| `/dashboard` | ��ú��� | ? (�԰���ֹ�����ǰ ����) |
| `/parcels` | �԰� ��ǰ ��� | ? (���� ����, �˻�, �԰� ����ȭ) |
| `/parcels/[id]` | ��ǰ �� | ? (��ġ�̷�, �����̼� �̵�) |
| `/inbound` | �԰�ó�� | ? (���ڵ� ��ĵ, �����Կ�, �ڵ� �����̼� ����) |
| `/inbound/[id]/barcodes` | ���ڵ� ���� | ? |
| `/picking` | ��ŷ ��� | ? (�����Ϸ� �ֹ� ���) |
| `/picking/[id]` | ��ŷ �� | ? (���ڵ� ��ĵ, ��ǰ�� ��ŷ ����) |
| `/outbound` | ��� ��� | ? (����� �ֹ� ���) |
| `/outbound/[id]` | ��� ���� | ? (�ڽ� ��ĵ, ��� ���� ���ε�) |
| `/transfer` | �����̼� �̵�ó�� | ? (���ڵ� ��ĵ 2������ ��� �̵�) |
| `/orders` | ���� �ֹ� ��� | ? |
| `/orders/[id]` | �ֹ� �� | ? |
| `/orders/[id]/label` | ��� �� | ? (���衤���� �ʵ�) |
| `/orders/[id]/packing-slip` | ��ŷ ���� | ? |
| `/domestic-orders` | ���� �ֹ� ��� | ? |
| `/domestic-orders/[id]` | ���� �ֹ� �� | ? |
| `/domestic-orders/[id]/label` | ���� ��� �� | ? |
| `/customers` | ��� ���� | ?? (����� ��ǰ���ֹ� ��ȸ) |
| `/customers/[code]` | ��� �� | ?? |
| `/returns` | ��ǰ ��û ��� | ? |
| `/storage` | �����̼� ��Ȳ | ? (Zone�� ��Ȳ, Ÿ�� ����, �뷮 ǥ��) |
| `/storage/[id]` | �����̼� �� | ? (���� �뷮 ��, ���� �̵�, ��� ����) |
| `/storage/manage` | Zone������ ���� | ? (Ÿ�� ����, ���ݡ��뷮 ����, �ϰ� ����) |
| `/label-editor` | �� ���̾ƿ� ���� | ? |

---

## ?? �ֹ� ���� �ӽ�

### orders ����

| ���� | ���̺� | ���� |
|---|---|---|
| `DRAFT` | ��û �Ϸ� | �ؿܹ�� ��û ����, â�� �԰� ��� |
| `PENDING_PICKUP` | ���Ž�û | ��ü�� �湮���� ���� �Ϸ� |
| `PICKED_UP` | ���ſϷ� | ���� �ù� ���� �Ϸ� |
| `INBOUND` | �԰�Ϸ� | â�� �԰� + ���¹ڽ� ���� �Կ� �Ϸ� |
| `INSPECTION` | �˼��� | ��ǰ Ȯ�� + ���� �Կ� �� |
| `HOLD` | ���� | ����Ұ����ļ� �� ��� Ȯ�� �ʿ� |
| `PACKAGING_REQUESTED` | �����û | ������/������/Ư������ ��û ���� |
| `PACKAGING_DONE` | ����Ϸ� | ���� �۾� �Ϸ� + ���� �Կ� |
| `QUOTE_SENT` | �����߼� | ������ۺ� + ���� ��� ������� �߼� |
| `PENDING_PAYMENT` | ������� | ��� ���� ��� |
| `PAID` | �����Ϸ� | �佺���̸��� ���� ���� |
| `PICKING` | ��ŷ�� | â�� ������ ��ǰ ���� �� |
| `PICKING_DONE` | ��ŷ�Ϸ� | â�� �� ��ǰ ���� �Ϸ� |
| `OUTBOUND_WAIT` | ����� | ��� �۾� ��� |
| `CUSTOMS_FILING` | ������ | EMS/K-Packet ���� ��� + ��ŷ ���� �Կ� |
| `IN_TRANSIT` | ����� | ���� ��� �� |
| `DELIVERED` | ��ۿϷ� | �ؿ� ������ ���� |
| `CANCELLED` | ��� | ��� ó�� |

### parcels ���� ����

| ���� | ���� |
|---|---|
| `PICKUP_REQUESTED` | ���� ��û �Ϸ� |
| `PICKUP_CANCELLED` | ���� ��� ó�� �Ϸ� |
| `IN_TRANSIT` | ���� ��� �� |
| `INBOUND` | â�� �԰� �Ϸ� |

### return_requests ����

| ���� | ���� |
|---|---|
| `REQUESTED` | ��ǰ ��û ���� |
| `WAITING_INBOUND` | ��ǰ â�� ���� ��� (�ؿܹ߼� �� ���԰� ���̽�) |
| `INSPECTING` | ��ǰ �� ���� �˼� |
| `PACKED` | ��ǰ ���� �Ϸ� |
| `SHIPPED` | �Ǹ��ڿ��� �߼� �Ϸ� |
| `COMPLETED` | ��ǰ �Ϸ� |
| `CANCELLED` | ��� |

---

## ?? DB ��Ű�� (���̱׷��̼� 001~054)

| ���� | ���� |
|------|------|
| `001_init.sql` | �ٽ� ���̺�: customers, parcels, orders, order_parcels, parcel_media, packaging_requests, payments, notifications, RLS, �����ȣ �ڵ����� Ʈ���� |
| `002_pickup.sql` | parcels: ���� ���� �÷� (pickup_tracking_no, pickup_address, epost_*) |
| `003_ems.sql` | parcels: EMS ���� �÷� (ems_regino, ems_fee, ems_country, ems_applied_at) |
| `004_addresses.sql` | customer_addresses ���̺� (type: pickup \| overseas) |
| `005_services.sql` | services īŻ�α�, order_services, return_requests, inspection_results, customers.auth_user_id |
| `006_fix_addresses_rls.sql` | customer_addresses RLS ���� (auth.uid() ���� ����) |
| `007_box_orders.sql` | �� �ڽ� ��� �ֹ� ���̺� |
| `008_parcel_registration.sql` | ��� ���� ��ǰ ��� ���� |
| `009_parcel_tracking.sql` | ���� ���� �̺�Ʈ ���̺� |
| `010_shipping_boxes.sql` | ���� �ڽ� ��� (shipping_boxes) |
| `011_parcel_services.sql` | ��ǰ�� �ΰ� ���� |
| `012_orders_ems_fields.sql` | orders: EMS ���� �ʵ� �߰� |
| `013_return_requests_v2.sql` | ��ǰ ��û v2 ��Ű�� |
| `014_epost_order_no.sql` | epost_order_no �÷� (GetResInfo ���� ��ȸ��) |
| `015_pickup_box_specs.sql` | ���� �ٹڽ����ڽ� �԰� �÷� |
| `016_orders_insurance.sql` | orders: �������� ���� �ɼ� (insurance_enabled, insurance_amount) |
| `017_orders_intl_tracking.sql` | orders: ���� ����� ���� �ʵ� |
| `018_fix_handle_new_user.sql` | handle_new_user Ʈ���� �ߺ� ȣ�� ���� |
| `019_orders_quote_margin.sql` | orders: ���� EMS ���������� (quote_ems_cost, shipping_margin) |
| `020_parcel_inbound_source.sql` | parcels.inbound_source (PICKUP / DIRECT) |
| `021_inbound_sync_schedule.sql` | admin_config �԰� ����ȭ ������ |
| `022_ems_usd_krw_rate.sql` | EMS ���� USD��KRW ȯ�� (admin_config, Cron 1ȸ/�� ����) |
| `023_orders_duty_ddp.sql` | DDP(��������) �ɼǡ�DDP ���� �ʵ� |
| `024_domestic_orders.sql` | domestic_orders ���̺� (â��汹�� �ּ� ���) |
| `025_domestic_orders_v2.sql` | domestic_orders Ȯ��: �ΰ��ɼǡ��޸� �÷� �߰� |
| `026_storage_locations.sql` | storage_locations ���̺� (â�� �����̼� ? A-001 ����) |
| `027_storage_zones.sql` | Zone �׷��� (storage_locations ���� ��� ����) |
| `028_storage_types.sql` | storage_types ���̺�: MINI/STANDARD/LONG/XL/OVERSIZE �԰ݡ���� ���� |
| `029_storage_locations_v2.sql` | storage_locations Ȯ��: Zone/Type FK, volume_liter, is_temp �÷� |
| `030_storage_grid_view.sql` | ������ �׸��� UI�� �� |
| `031_storage_alert_view.sql` | ��� ó�� �ʿ䡤��� ���� �˸� ���� �� |
| `032_parcel_barcodes.sql` | parcel_barcodes ���̺� (���� ���ڵ�: `{tracking_no}-{seq}`) |
| `033_storage_capacity.sql` | storage_locations: max_parcels �뷮 ���� �÷� |
| `034_parcel_size_code.sql` | parcels.parcel_size_code �÷� �߰� |
| `035_parcel_location_history.sql` | parcel_location_events ���̺� (���� ��ġ �̵� �̷�) + �ӽú��� ���� |
| `035_parcel_size_code_migrate.sql` | parcel_size_code �� MINI/STANDARD/LONG/XL/OVERSIZE�� ���̱׷��̼�, pickup_weight_kg ��� �ڵ� ä��� |
| `036_parcel_barcode_location.sql` | parcel_barcodes: �����ۺ� ���� storage_location_id �÷� �߰� |
| `037_outbound_picking.sql` | orders/domestic_orders: ��ŷ����� �÷� �߰�; ���� Ȯ�� PAID��PICKING��PICKING_DONE��OUTBOUND_WAIT��IN_TRANSIT |
| `038_outbound_sessions.sql` | outbound_sessions ���̺� (��� �۾� ���� ? ��ĵ �α�, �ڽ�, ����, �����) |
| `038_picking_item_tracking.sql` | parcel_barcodes: ��ŷ ���� �÷� (WAITING/DONE/HOLD/NOT_FOUND); picking_scan_logs ���̺� |
| `039_parcel_media_bucket.sql` | Supabase Storage `parcel-media` ��Ŷ ���� ��å |
| `040_customer_storages.sql` | ��� ���� ���� �ٽ� ���̺�: storage_plan_config (S/M/L/XL �÷�), item_capacity_scores (���� ����ǥ), customer_storages (������), customer_storage_items (���� ������) |
| `041_storage_payments.sql` | storage_payments ���̺� ? ���� ���� ���� ���� (�ܰǡ�����) |
| `042_storage_recurring_profiles.sql` | storage_recurring_profiles ���̺� ? ��⺸�� �ڵ����� �������� (���Ű, ���� ������, ��ü ó�� �غ�) |
| `043_storage_status_pending_payment.sql` | customer_storages ���� Ȯ��: PENDING_PAYMENT (���ź� �̰���) �߰� |
| `044_pickup_box_fees.sql` | pickup_box_fees ���̺� ? ���� �ڽ� ũ�⺰(DEFAULT/SMALL/MEDIUM/LARGE/XL) ��� ���� (Admin ����) |
| `045_capacity_item_count.sql` | customer_storages �뷮 �ý��� ���� ? ���� ��� �� ������ �� ��� (capacity_score = �ִ� ������ ��, capacity_override, used_score Ʈ���� ����) |
| `046_parcel_storage_link.sql` | parcels.customer_storage_id FK �߰� ? ������ �����Կ� ���� ����, auto_link Ʈ����, used_score Ʈ���� Ȯ�� |
| `047_mock_parcel_items.sql` + `047b` | MOCK ���� pre_invoice_items ���� ������ ä��� (��ǰ�� ǥ�ÿ�) |
| `048_parcel_storage_link_shippable.sql` | SHIPPABLE ���� ���� customer_storage_id �ұ� ����, auto_link Ʈ���ſ� SHIPPABLE��INSPECTION �߰�, used_score ���� |
| `049_storage_card_color.sql` | customer_storages.card_color �÷� �߰� ? ī�� �׸� ���� ��� ���� (green\|purple\|red\|blue\|pink\|null=����) |
| `050_storage_type_price_per_month.sql` | storage_types�� `price_per_month` �÷� �߰� ? ������ ��⺸�� ��� (NULL�̸� �ְ� ��� ǥ��, ���� �� �� ���� ǥ��) |
| `051_oversize_price_fix.sql` | OVERSIZE Ÿ�� ��� ����ȭ ? 29,900��/�� Ȯ��, price_max NULL ó�� |

> �� ���� ��Ȳ: [docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md)

### �ٽ� ���̺� ����

```
customers (1) ����< parcels (N)              �԰�� ���� ��ǰ
customers (1) ����< orders (N)               �ؿܹ�� �ֹ� ����
orders (N) ����< order_parcels >���� parcels   ������ M:N ����
orders (1) ����< order_services (N)          �ֹ��� �ΰ� ����
orders (1) ����< payments (N)                ���� ����
parcels (1) ����< parcel_services (N)        ��ǰ�� �ΰ� ����
parcels (1) ����< inspection_results (N)     �˼� ���
parcels (1) ����< return_requests (N)        ��ǰ ��û
parcels (1) ����< parcel_tracking (N)        ���� ���� �̺�Ʈ
customers (1) ����< customer_addresses (N)   ������/�ؿ� �ּҷ�
orders (1) ����< shipping_boxes (N)          ��� �ڽ� ����
parcels/orders ����< parcel_media            ����/���� �̵��
```

### services ���̺� �ڵ� ���

| category | code | name | price |
|---|---|---|---|
| SHIPPING | `EMS` | EMS | ���� ���� |
| SHIPPING | `EMS_PREMIUM` | EMS �����̾� | ���� ���� |
| SHIPPING | `KPACKET` | K-Packet | ���� ���� |
| INSPECTION | `BASIC_INSPECT` | �⺻ �˼� | ���� |
| INSPECTION | `DETAIL_INSPECT` | �� �˼� | 3,000�� |
| INSPECTION | `CLOTHING_INSPECT` | �Ƿ� �˼� | 2,000�� |
| PACKAGING | `SAFE_PACK` | �������� | 3,000�� |
| PACKAGING | `REPACK` | ������ | 2,000�� |
| PACKAGING | `CONSOLIDATE` | ������ | 2,000�� |
| BOX_DELIVERY | `BOX_S` | ���� �ڽ� ��� | 3,000�� |
| BOX_DELIVERY | `BOX_M` | ���� �ڽ� ��� | 4,000�� |
| BOX_DELIVERY | `BOX_L` | ���� �ڽ� ��� | 5,000�� |

---

## ?? �ٽ� ���: ������ ��ǰ ��� �ý���

Ÿ ��ü���� �ٽ� �������Դϴ�. ����� ���� �� �� ���� â�� �� ��� ������ ���󡤻������� �����մϴ�.

| �ܰ� | �̵�� | ����� | ���� |
|---|---|---|---|
| �԰� ���¹ڽ� | ?? ���� | Cloudflare Stream | �ڽ� ���� �� ���� ? ���� �Ұ� ���� |
| ��ǰ �˼� | ?? ���� N�� | Supabase Storage | ���� ��ǰ �� Ȯ�� |
| ���� �۾� | ?? ��/�� ���� | Supabase Storage | Before-After �� |
| ��� ��ŷ | ?? ���� | Cloudflare Stream | ���� ����к��湫�� ���� �� ���� |

---

## ?? ��� ��� ��Ȳ

| ��� | ���� | ���� |
|---|---|---|
| ȸ������ / �α��� | ? �Ϸ� | �̸���, Supabase Auth |
| �����ȣ �߱� | ? �Ϸ� | ���� �� �ڵ� �߱� (��: `IFT-20260518-0001`) |
| ���� �԰��ּ� ���� | ? �Ϸ� | �����ȣ ��� ���� �԰��ּ� |
| ���� ��û | ? �Ϸ� | ��ü�� �湮���� API, �ٹڽ����ڽ� �԰�, ����� �ּ� ���� |
| ���� ��� | ? �Ϸ� | ePost API ���� ��� + DB ���� ������Ʈ |
| ���� ���� ��ȸ | ? �Ϸ� | GetResInfo API �ǽð� ���� ���� |
| �Ϲ�/��� �Է� ��� | ? �Ϸ� | ���š���� �ܰ躰 UI ��ȯ |
| Ȩ �׼� ��ú��� | ? �Ϸ� | ���� �� �� ī�� (�������˼������ �ȳ�) |
| ���丮�� | ? �Ϸ� | �԰� ��ǰ ���, ���� ����, �˻� |
| ��ǰ ���� ��� | ? �Ϸ� | ���� ��ǰ ��� �� (Ÿ�ù� ���) |
| ��ǰ ���� + ��� ��û | ? �Ϸ� | üũ�ڽ� ���� ���� �� FAB ��ư |
| �ؿܹ�� ��û (�ٴܰ�) | ? �Ϸ� | ��ۿɼǡ��������κ��̽� + ���� �ڽ� ���� |
| �ؿ� ����� �ּҷ� | ? �Ϸ� | ����/����/����, �⺻ �ּ� ���� |
| ��ۺ� ���� | ? �Ϸ� | ���̵�� ���� + ���� ������, ���������Ժ� EMS ���� |
| ������� ���� | ? �Ϸ� | ���̵�� ����, â������ ������ ���, �����갣 üũ�ڽ� |
| �ؿܹ�� ����ǥ | ? �Ϸ� | `/pricing` ? EMS/K-Packet ���� ���ǥ |
| ������� ����ǥ | ? �Ϸ� | `/domestic-rates` ? â������ ������ ��ݡ��԰� �ȳ� |
| �̿� ���̵� | ? �Ϸ� | `/guide` |
| �����Ȳ (orders) | ? �Ϸ� | �ֹ� ���, ���� ǥ��, ����� ��ȸ |
| ��û �Ϸ� �ֹ� ��� | ? �Ϸ� | ��� ��û �� ��� |
| ���� (Toss) | ? �Ϸ� | ī�� ����, confirm API, ���� �� EMS �ڵ� ���� |
| EMS ���� �ɼ� | ? �Ϸ� | ���������� �� ���� ���� ���� |
| ��� �˸� | ? �Ϸ� | �ܰ躰 in-app �˸� |
| ��ǰ ��û (UI) | ? �Ϸ� | ��ǰ ��û �� (�鿣�� ��ũ�÷ο� ���� ��) |
| �԰� �� ���� �ڵ� ����ȭ | ?? ���� �� | Cron + GetResInfo / tracker.delivery |
| �˼���ǰ ���� ��û | ?? ���� | �Ƿ�/�Ϲ� �˼� �ɼ� ���� |
| �� �ڽ� ��� ��û | ?? ���� | ��/��/�� �ڽ� ���� ��� |
| ��ǰ ����/���� Ȯ�� | ?? ���� | �԰���󡤰�ǰ������������ Ÿ�Ӷ��� |
| FCM Ǫ�� �˸� | ?? ���� | �ܰ躰 ���� �˸� |

---

## ?? ������ ��� ��Ȳ

| ��� | ���� | ���� |
|---|---|---|
| ������ �α��� | ? �Ϸ� | �̸��� ȭ��Ʈ����Ʈ ���� |
| ��ú��� | ? �Ϸ� | �԰���ֹ�����ǰ ���� ī�� |
| �԰� ��ǰ ��� | ? �Ϸ� | ���º� ����, �˻�, �԰� ����ȭ ��ư |
| ��ǰ �� ��ȸ | ? �Ϸ� | ��ǰ ����, ���� ����, ��ġ �̵� �̷� |
| �԰�ó�� ���� ȭ�� | ? �Ϸ� | ���ڵ� ��ĵ, ���������� �Կ�, ���� ���ڵ� �ڵ� ���� |
| ���� �ֹ� ��� | ? �Ϸ� | �ֹ� ���, ���� ǥ�� |
| �ֹ� �� ��ȸ | ? �Ϸ� | �ֹ� ����, ��ǰ ��� |
| ��� �� ��ȸ | ? �Ϸ� | �� ��� (���衤���� �ʵ�) |
| EMS/K-Packet ���� | ? �Ϸ� | �����Ű� ���� + ���� �� �ڵ� ���� |
| ���� ���������� | ? �Ϸ� | DB �ʵ� (019), UI ���� ���� |
| ��ǰ ��û ��� | ? �Ϸ� | ��ǰ ��Ȳ ��ȸ |
| **���丮�� �����̼� ��Ȳ** | ? �Ϸ� | Zone�� ��Ȳ �׸���, Ÿ�� ����, ���� ���� |
| **���丮�� �����̼� ��** | ? �Ϸ� | ���� �뷮 ��, ���� �̵�, ��� ���������� |
| **Zone������ ����** | ? �Ϸ� | ���� �߰�/����, Ÿ�� ����, �ϰ� ����, ���ݡ��뷮 ���� |
| **���丮�� Ÿ�� ��� ����** | ? �Ϸ� | MINI~OVERSIZE �ְ���ݡ����ѿ�ݡ��ִ�Ǽ� �ζ��� ���� |
| **�����̼� �̵�ó��** | ? �Ϸ� | `/transfer` ���� ������, ���ڵ� 2�� ��ĵ���� ��� �̵� |
| **�ڵ� �����̼� ����** | ? �Ϸ� | �԰� �� size code �� �ܰ��� ������¡ �� ���� ���� |
| **��ŷ ��� �� ��** | ? �Ϸ� | PAID �ֹ� ��ŷ ��� ���, ���ڵ� ��ĵ ��ǰ�� DONE/HOLD/NOT_FOUND |
| **��ŷ ��ĵ �α�** | ? �Ϸ� | picking_scan_logs ? ��ĵ �̷�, �����, Ÿ�ӽ����� |
| **��� ��� �� ����** | ? �Ϸ� | PICKING_DONE��OUTBOUND_WAIT �帧, �ڽ� ��ĵ, ���� ���� |
| **��� ���� ���ε�** | ? �Ϸ� | Cloudflare Stream tus ûũ ���ε� (`outbound_sessions`) |
| ���� �ֹ� ���� | ? �Ϸ� | ���� ��� �ֹ� ��ϡ��󼼡��� |
| ��� ���� | ?? ���� �� | ��� �˻�, ����� ��ǰ���ֹ� ��ȸ |
| �԰� �ڵ� ����ȭ | ?? ���� �� | GetResInfo + tracker.delivery, Cron�������� ���� |
| ������ ��ũ ���� ���� | ?? ���� | ���� ���� ���� ���� |
| ���¹ڽ� ���� ���ε� | ?? ���� | �԰� �� Cloudflare Stream ���� �Կ� |
| �˼� ��� �Է� | ?? ���� | üũ����Ʈ + ���� ���ε� |
| ���� ����/���� �Է� | ?? ���� | �����߷� �ڵ� ��� |
| ���� Ȯ�� + ���� ��û | ?? �κ� �Ϸ� | ��������� �÷ο� �Ϸ�, QUOTE_SENT �˸������� UI ���� |
| ��ǰ ó�� ��ũ�÷ο� | ?? ���� | �˼��������߼ۡ�Ϸ� |
| ���� ����� ��� | ?? ���� | ��� ��� ��� �˸� |
| ��� ��ú��� (��) | ?? ���� | ����, ������, ���񽺺� �м� |

---

## ?? �� ���� (Capacitor WebView)

```
Next.js ����
      ��
  Capacitor �� ��
  ������ iOS  �� App Store
  ������ Android �� Google Play
```

- �� 1�� �ڵ庣�̽��� ��/iOS/Android ��� ����
- Safe Area (��ġ/Ȩ��) CSS ȯ�溯���� ó��

---

## ?? ���� �ε��

### Phase 1 ? ��� �ٽ� �÷ο� ? �Ϸ�

- [x] Supabase ��Ű�� + RLS (001~017.sql, 129+ Ŀ��)
- [x] ȸ������ �� �����ȣ/�԰��ּ� �ڵ� �߱�
- [x] ���� ��û (��ü�� ePost API ����, �ٹڽ����ڽ� �԰�)
- [x] ���� ��� + ���� ��ȸ (GetResInfo)
- [x] ���丮�� (�԰���Ȳ, ��ǰ ����, ���� ����)
- [x] ��ǰ ���� ���
- [x] �ؿܹ�� ��û �ٴܰ� �÷ο� (���� �ڽ� ����)
- [x] �ؿ� ����� �ּҷ� (����/����/����)
- [x] �κ��̽� �ۼ� (�����Ű� ��ǰ ���)
- [x] EMS ��ۺ� �ڵ� ���� ��ȸ + ���̵�� ����
- [x] �ֹ� ���� API (`POST /api/orders`)
- [x] �����Ȳ ������ (�ֹ� ��� + ����)
- [x] ���� (Toss Payments SDK + confirm API)
- [x] ���� īŻ�α� DB ���� (services, order_services, parcel_services)
- [x] ��ǰ ��û DB ���� + ��û UI
- [x] �˼� ��� DB ���� (inspection_results)
- [x] ���� ���� �̺�Ʈ ���̺�
- [x] ������: �԰�/�ֹ�/��ǰ �⺻ CRUD ȭ��
- [x] ������: EMS ���� API

### Phase 1.5 ? ������� �ڵ�ȭ ? �Ϸ�

- [x] ������ ��� ���� Ȯ�� �� ��� ���� �÷ο�
- [x] ���� �� EMS/K-Packet �ڵ� ���� (`payment/confirm`)
- [x] EMS ���� �ɼ� (016) �� ��� �� ���
- [x] ���� EMS ���������� �и� (019)
- [x] Ȩ �׼� ��ú��� �� �Ϲ�/��� �Է� ���
- [x] ���ǥ(`/pricing`) �� �̿� ���̵�(`/guide`)
- [x] ��� in-app �˸� �� �ֹ� ��� �� ���������� ����
- [x] ���� ���� Cron (`sync-intl-tracking`, 6�ð�)
- [x] ������ ��ú��� ��� ī��

### Phase 1.6 ? ���丮�� ���� �ý��� ? �Ϸ�

- [x] ���丮�� �����̼� DB ���� (026~031.sql)
- [x] �����̼� ��Ȳ���� ������ (Zone �׸���, ���� �뷮 ��)
- [x] �԰�ó�� ���� ������ + ���� ���ڵ� (032.sql)
- [x] ���丮�� Ÿ�� �뷮����� ���� UI
- [x] ����=����Ʈ �ڵ� ����: �ܰ��� ������¡ + ���� ���� (033~035.sql)
- [x] ���Ž�û ���� parcel_size_code �ڵ� ����
- [x] �����̼� �̵�ó�� ���� ������ (���ڵ� 2-��ĵ ��ũ�÷ο�)
- [x] ���� ��ġ �̵� �̷� Ÿ�Ӷ���

### Phase 1.7 ? ��ŷ����� ��ũ�÷ο� ? �Ϸ�

- [x] ��ŷ����� ���� Ȯ�� (037.sql): PAID �� PICKING �� PICKING_DONE �� OUTBOUND_WAIT �� IN_TRANSIT
- [x] parcel_barcodes ������ ���� storage_location_id (036.sql)
- [x] ��ŷ ������ ���� (038_picking_item_tracking.sql): WAITING/DONE/HOLD/NOT_FOUND ����, picking_scan_logs ���̺�
- [x] ��� ���� DB (038_outbound_sessions.sql): outbound_sessions ���̺� (��ĵ �α�, �ڽ� ���, ���� ���ε�, �����)
- [x] ������ ��ŷ ��� `/picking` ? �����Ϸ� �ֹ� ���
- [x] ������ ��ŷ �� `/picking/[id]` ? ���ڵ� ��ĵ, ��ǰ�� ���� ó��
- [x] ������ ��� ��� `/outbound` ? ����� �ֹ� ���
- [x] ������ ��� ���� `/outbound/[id]` ? �ڽ� ��ĵ, Cloudflare Stream ���� ���ε�
- [x] ���� �ֹ� ��ϡ��󼼡��� ������ (`/domestic-orders`)
- [x] ��ŷ ���� ��� (`/orders/[id]/packing-slip`)

### Phase 2 ? ������� ���� + ����� ���� ? �Ϸ�

> ���߱��� ��� ���� ������� ���� (`/shop`). �α��� ���ʿ�, KG Inicis ����.

- [x] ������� ��ǰ ��� (S/M/L/XL �ڽ�, ���� 15,000~28,000��)
- [x] KO/EN ���̸����� UI (��� ���)
- [x] ���� �����ȣ �ּ� �˻� ���� (`/postcode`)
- [x] KG Inicis INIStdPay PC ���� ����
- [x] KG Inicis INImobile ����� ���� (UA ���� �ڵ� �б�)
- [x] �̿�������������ó����ħ ���� ������ (`/shop/terms`, `/shop/privacy`)
- [x] ��ޱ�����ǰ��ȯ����å���̿����� �ȳ�
- [x] API ���� ��� + rate limiting

### Phase 3 ? ��� ���� ���� ?? ���� ��

> PDF ��� ���丮�� ���������� ����. KG Inicis �ܰǰ��� ���� �Ϸ�, �����÷��̼ǡ���⺸�� ����.

- [x] DB ��Ű�� (040~049): customer_storages, storage_payments, storage_recurring_profiles, pickup_box_fees, �뷮 ������ �� ��ȯ, parcels FK ����, SHIPPABLE �ұ� ����, ī�� ���� �÷�
- [x] �� ��� ���丮�� ��ú��� (`/storage`, `/storage/new`, `/storage/[id]`)
  - ��ü ���ī�� (�̿� �� �� �ְ���� �� ���� ������)
  - **3D ȸ�� ĳ����** ī�� �׸��� (�巡�ס��������������콺�� ������̼�, Ŭ������ Ȱ�� ī�� �̵�)
  - **ī�� ���� ��� ����** (5���� �׸�: green/purple/red/blue/pink, �⺻ ����) ? �̸� ���� ��Ʈ�� ����
  - **���� ������** �뷮 ǥ�� (20ĭ ���׸�Ʈ, 5%��)
  - ��ǰ ��� ���ڵ�� (����/��ġ��) + ���� �� + ����¡ (10/30/50/��ü)
  - �˼� ���� ����� (hover Ȯ�� �̸�����)
  - ��� ��û �� ����/�ؿ� ���� ���� ���ҽ�Ʈ �� shipping-request / domestic-shipping ����
  - �뷮 ���� ���ҽ�Ʈ (storage_types ��� ����)
  - ������ �̸� ��� ���� ���� (RenameSheet)
- [x] ���丮�� ��(`/storage/[id]`): ��� ���� ī�� ǥ�� (����� card_color �ݿ�)
- [x] Admin ��� ���� ���� (`/customer-storages`, `/customer-storages/[id]`)
- [x] ���ź� ���� ����: �ڽ� ũ�⺰ ��� DB ���� + Admin ���� ȭ��
- [x] �ܱ⺸�� ���� API: KG Inicis �ܰǰ��� (`/api/inicis/storage-return`)
- [x] PENDING_PAYMENT ���� ó�� (���ź� �̰��� �帧)
- [x] ���� ��û �� ��⺸�� ���� ��û �ɼ� (`/pickup` Step 3 ���)
- [x] �ܱ⺸�� ����Ⱓ(3��) + �ܿ���/���� ���� ǥ��
- [x] ���� �� ������ �ڵ� ���� (auto_link Ʈ����, used_score ����)
- [x] �ؿ�/���� ��� ��û �� ?parcels= URL�� �����Ű� �κ��̽� �ڵ� ä��
- [x] **��ǰ ��� �÷ο�**: ���丮�� ��� "��û" �� "��ǰ ���" ��ư, storage_id �����Ķ���ͷ� pickup ����
- [x] **���� ��Ȳ ������** (`/pickup/history`): ���� ��/�̵� ��/�԰� �� ��, ���� ��� ���
- [ ] **���� ���� �����÷��̼� cron** (�� Phase 6, 4����)
- [ ] **�ؿܹ�� ���� Ȯ�κ�** (�� Phase 7, 5����)

---

> **�Ʒ� Phase 4~8�� ��ȹ�� ���� ���� �ܰ��Դϴ�.**  
> �켱������ �� Phase ���� ǥ���߽��ϴ�.

### Phase 4 ? ��⺸�� ��� ?? (6���� �� ��� ��� �� �ǿ���)

> KG Inicis �������(���) ����� �Ϸ�Ǹ� �ǿ���. �� ������ ���� ���� ����.

- [ ] storage_recurring_profiles ��� ������ �ڵ����� ���� ����
- [ ] ��ü ó�� (1~30�� �ܰ躰 ��õ�)
- [ ] ���Ű ��ϡ����š����� �帧
- [ ] ��� �̸��� �˸� (���� ����������������)
- [ ] Admin ������� ��Ȳ ��ú���

### Phase 5 ? �ܱ����� ��ȯ cron ?? (7���� �� Phase 4 ����)

> �ܱ⺸�� ���� �� ��⺸������ �ڵ� ��ȯ�ϴ� Cron ��.

- [ ] �ܱ⺸�� ���� ���� cron (Vercel Cron)
- [ ] ��� ��ȯ ���� �˸� �߼� (in-app + �̸���)
- [ ] ��⺸�� �ڵ� ��ȯ ó�� (storage_recurring_profiles ����)
- [ ] ��ȯ ��� �� ��� �ȳ� �帧

### Phase 6 ? ���� ���� �����÷��̼� cron ?? (4����)

> ���� ���� ���� ���� �� D+0/3/7/14/30 �ܰ躰 �ڵ� ó��.

- [ ] storage_escalation_logs ���̺� Ȱ�� (Phase 3 DB �̹� �غ��)
- [ ] Vercel Cron: ���� �̳� �� ��ĵ �� �ܰ躰 ����� �õ�
- [ ] D+0: ��� ��õ� + ��� �˸�
- [ ] D+3��7: ��õ� + ��� �˸�
- [ ] D+14: ������ SUSPENDED ó�� + ��� �ȳ�
- [ ] D+30: OVERDUE ó�� + ��� �����÷��̼�

### Phase 7 ? �ؿܹ�� ���� Ȯ�κ� ?? (5����)

> ���� �ؿܹ�� ��û �帧�� "���� Ȯ�κ�" �ɼ��� Ȯ��.

- [ ] �ؿܹ�� ��û �ܰ迡 ���� Ȯ�κ� �ɼ� �߰� (UI)
- [ ] ���� API�� ���� Ȯ�κ� �׸� �ݿ�
- [ ] ���� �ܰ迡 ���� Ȯ�κ� ���� ó��
- [ ] Admin: ���� Ȯ�� �Ϸ� ó�� + ���� ���ε�

---

> ?? **Phase 8�� ���� ��� �Ϸ� �� �����ϴ� ���� ���� �ܰ��Դϴ�.**

### Phase 8 ? �۷ι� ���� ? (���� ���� �ܰ� �� ���� ��� �Ϸ� ��)

> �ؿ� ī�� �� �۷ι� ���� ����(PayPal, Alipay ��) ����. ���� PG ��� �Ϸ� �� ����.

- [ ] �۷ι� PG ���� ���� �� ���
- [ ] ���� ��ȭ ���� (USD, CNY, EUR ��)
- [ ] �ؿ� ī�� ���� (Visa/Mastercard)
- [ ] ��ê���̡��˸����� �� �߱� ���� ����
- [ ] �ٱ��� ���� UI Ȯ��
- [ ] ȯ�� �ڵ� ���� �� ���� ó��

---

### ������ ���� �۾� (Phase 2~3 ����)

- [ ] **�԰� �ڵ� ����ȭ** ?? ? GetResInfo + tracker.delivery, Cron�������� (020~021)
- [ ] **��� ����** ?? ? ����� ��ǰ���ֹ� ��ȸ (�׺���̼� ���� ����)
- [ ] ������: ���¹ڽ� ���� ���ε� (Cloudflare Stream)
- [ ] ������: �˼� ��� �Է� + ���� ���ε� (Supabase Storage)
- [ ] ������: ���� �� ���� Ȯ�� �� ���� ��û �˸� (QUOTE_SENT)
- [ ] ������: ��ǰ ó�� ��ũ�÷ο�
- [ ] ���: ��ǰ ����/���� Ÿ�Ӷ��� Ȯ��
- [ ] FCM Ǫ�� �˸� ��ü ����
- [ ] Capacitor WebView �� ��� (iOS/Android)
- [ ] ��� ��ú��� (����, ������, ���񽺺�)

---

## ?? ȯ�溯��

| ���� | ���� |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase ������Ʈ URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase �͸� Ű |
| `SUPABASE_SERVICE_ROLE_KEY` | ���� ���� ���� �� Ű |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | �佺���̸��� Ŭ���̾�Ʈ Ű (����) |
| `TOSS_SECRET_KEY` | �佺���̸��� ��ũ�� Ű (���� ����) |
| `EPOST_CUSTOMER_ID` | ��ü�� ��� ID |
| `EPOST_APPROVAL_NO` | ��ü�� ���ι�ȣ |
| `EPOST_SECURITY_KEY` | ��ü�� SEED128 ��ȣȭ Ű |
| `EPOST_TRACE_SERVICE_KEY` | ��ü�� EMS �����ȸ OpenAPI ����Ű (��������������) |
| `CRON_SECRET` | Vercel Cron ���� (`Authorization: Bearer ��`) |
| `PUBLIC_DATA_API_KEY` | �������������� ����Ű ? **����û ���� ����ȯ��(�ְ�)** EMS ���� USD��KRW ���� (1����) |
| `KOREAEXIM_AUTH_KEY` | (����) �ѱ����������� ȯ�� API ? ����û API ���� �� ���� |
| `EMS_USD_KRW_RATE` | (����) ���� ���� ȯ�� ? DB��API ��� ���� �� ���� |
| `INFRONT_CENTER_ORD_NM` | ��ü�� ord/rec ���͸� (�⺻ `������Ʈ`, modo `CENTER_RECIPIENT_NAME`) |
| `INFRONT_CENTER_NAME` | ǥ�ÿ� ���� �̸� |
| `INFRONT_CENTER_ZIPCODE` | **���� ������** �����ȣ (modo ����, �⺻ `41142`) |
| `INFRONT_CENTER_ADDR1` | **���� ������** �ּ� (�⺻ `�뱸������ ���� ���̷� 1` ? ���뱸��ü��) |
| `INFRONT_CENTER_ADDR2` | **���� ������** �� (�⺻ `���뱸��ü�� 2�� ������`, modo `CENTER_ADDRESS2`) |
| `INFRONT_CENTER_PHONE` | ���� ����ó (modo `CENTER_PHONE`) ? **���ڸ�** `01027239490` (���顤�������� �ڵ忡�� ����, ���� ���� �� ERR-522) |

> **��ü�� ����(reqType=2)**: `ord*` = ���뱸��ü�� ������(����), `rec*` = ��� ������. ȸ�� ������(�Ƚɷ�)�� ������� �ʽ��ϴ�. modo `shipments-book` �� �����մϴ�.
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare ���� ID |
| `CLOUDFLARE_STREAM_API_TOKEN` | Cloudflare Stream API ��ū |
| `ADMIN_EMAILS` | ������ �̸��� ��� (�޸� ����) |

---

## ?? ���� ��Ģ

- **���� ��Ȳ**: [docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md) ? ��ɺ� �� ���� (README �ε�ʰ� ����ȭ)
- **Ŀ�� �޽���**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **����**: ��� ��ũ���� `.env.local`���� ����, Git Ŀ�� ����
- **DB ����**: ������ ���� ���Ʈ�� `SUPABASE_SERVICE_ROLE_KEY` ���, ��� ���� RLS ����
- **����� �켱**: �ִ� 600px �����̳�, Safe Area CSS ���� ����
- **���� ��å**: �׻� â�� �˼� �� ���� Ȯ�� �� ��� ���� ������ ����
- **����**: ��ü�� ePost API�� Vercel ICN1(����) ���������� ȣ��

---

## ?? ���� �̷�

### 2026-06-11

#### ���š���ǰ��� �̰��� �ڽ� UX ���� + ���丮�� ��� ������ �ݿ�

**���� ��û (`/pickup`) �̰��� �ڽ� ���**
- Step 1(���� ����) �ϴܿ� **�̰��� �ڽ� ����** ��� �߰�
  - üũ �� Step 2(��ǰ ����) ���� �ǳʶ� �� Step 3(Ȯ�� �� ��û)���� ����
  - �ڷΰ��⵵ Step 1�� �����н� (Step 2 ����)
  - submit payload: `{ name_en: "Sealed Box", is_sealed: true, quantity: 1, ... }` ���� �׸� �ڵ� ����
  - Step 3 Ȯ�� ȭ��: "�̰��� �ڽ� ����" + ��ǰ ���� �Է� ���� �޽��� ǥ��, "��ǰ ���� ����" ��ư ����
  - "�ؿ� ��� ��� �� ���� �� ó��" ���� �ȳ� ǥ��

**��ǰ ��� (`/register-parcel`) �̰��� per-item üũ�ڽ�**
- **��ǰ ����** ���������� SEALED(�̰���) �ɼ� ���� �� grid-cols-3 �� grid-cols-2 (�� ��ǰ / �߰�ǰ��)
- �� ǰ�� ī�忡 **�ڽ� �̰��� ����** üũ�ڽ� �߰� (pickup �������� ������ UX)
  - üũ ��: �ڽ� �̸�(�ʼ�) �� �κ��̽� �ʵ�(ǰ����/����/�ܰ�/HS�ڵ�/������) ����
  - �̰��� �������� ��ǰ��Ư��ó�� ���� ��� "?? �̰��� ����" �ȳ� �޽��� ǥ��
  - `canStep2()` ����: �̰��� �������� �ڽ� �̸��� ������ ���
  - submit payload: `name_en: "Sealed Box"`, `is_sealed: true` �ڵ� ó��

**���丮�� �뷮���桤��⺸�� ��� �� ���� ǥ��**
- DB: `050_storage_type_price_per_month.sql` ? storage_types�� `price_per_month` �÷� �߰�
- DB: `051_oversize_price_fix.sql` ? OVERSIZE 29,900��/�� ����ȭ, price_max NULL ó��
- `/storage` CapacityChangeSheet: `price_per_month` ���� �� `/��` ǥ��, �̼��� �� `price_per_week` `/��` ����
- `/pickup` ��⺸�� ������ ����: ���� ���� �ݿ�

**���丮�� ĳ���� �� ��ũ�� ���� ����**
- ĳ���� �������� ���콺 �� ��� �� ������ ��ũ���� ������ ���ܵǴ� ���� ����
  - ����: `e.preventDefault()` ������ ȣ�� �� �� �̺�Ʈ ���� ĳ������ ����
  - ����: ��Ÿ �� 20�̸� `return` (������ ��ũ�� ���), 20 �ʰ� �ÿ��� `preventDefault()` + ī�� �̵�

---

### 2026-06-10

#### ���丮�� UX ���ȭ + ������̼� ����

**���丮�� ī�� 3D ĳ���� (Phase 3 ����)**
- `/storage`: 2-�÷� �׸��� �� **3D ȸ�� ĳ����** ���� ��ü
  - �巡�ס��������������콺�� ������̼�, Ŭ������ Ȱ�� ī�� �̵�
  - ī�� 1.7:1 ���� ����, CSS `zoom` + `ResizeObserver`�� ����� ������ �ڵ� ����
  - ���� ī�� 25% ������ ����, ���� ����(rounded-xl)
  - ���� ������ �뷮 ǥ�� (20ĭ ���׸�Ʈ, 5%��)
  - `INFRONT STORAGE` �ؽ�Ʈ ����
- **ī�� ���� ��� ����** (`049_storage_card_color.sql`)
  - 5���� �׸� (green/purple/red/blue/pink) + �⺻ ����
  - �̸� ���� ��Ʈ(RenameSheet)�� ���� ���� ����
  - `/api/storage/[id]` PATCH ? card_color ���塤��ȸ
  - `/storage/[id]` �� ��� ī�忡�� ���� ���� �ݿ�
- **��ǰ ��� �÷ο� ����**
  - ���丮�� ��� "��û" ��ư �� "��ǰ ���"(`/pickup?storage_id=...`) ����
  - "���� ��Ȳ" ��ư �߰� (`/pickup/history`)
  - `/pickup`: `useSearchParams`�� storage_id ���� �� `customer_storage_id` API ����
  - `048_parcel_storage_link_shippable.sql`: SHIPPABLE ���� ���� �ұ� ����, Ʈ���� Ȯ��
- **���� ��Ȳ ������** (`/pickup/history` �ű�)
  - ���� �� �� �̵� �� �� �԰� �� 3�� + �Ǽ� ����
  - ���� �� ���� "���� ���" ��ư (`DELETE /api/pickup/[id]`)

**������̼� ����**
- �ϴ� �ǹ�: "�����Ȳ" �� ���� �� 5�� (Ȩ/���Ž�û/���丮��/����û/MY)
- Ȩ ���� ���� �׸���: "��� ��Ȳ" ��ư �߰� (Globe ������, `/orders`)
- ����������: "��� ��Ȳ"(Globe, `/orders`) �� "���� ��Ȳ"(Truck, `/pickup/history`) �޴� �߰�

---

### 2026-06-09

#### ��� ���� ���� Phase 3 ? ���丮�� UX ���� ����

**DB ��Ű�� Ȯ�� (045~047)**
- `045_capacity_item_count.sql`: �뷮 ���� ���� �� ������ �� ��� ��ȯ (capacity_score = �ִ� ��ǰ ��)
- `046_parcel_storage_link.sql`: `parcels.customer_storage_id` FK �߰�, auto_link Ʈ����, used_score Ʈ���� Ȯ��
- `047_mock_parcel_items.sql` + `047b`: MOCK ���� �����Ű� ������ ä���

**���丮�� ��ú��� UI ���� �缳�� (`/storage`)**
- ��� ī��: �̿� �� N�� �� �ְ� ��� �� ���� ������
- �������� ��Ÿ�� 2-�÷� ī�� �׸��� (���� �׶���Ʈ, ��뷮 ��, ���� Ĩ)
- ���丮�� ���� �߰� ī�� (�׸��� �� + ��ư)
- ��ǰ ��� ���ڵ�� (��� Ŭ������ ����/��ġ��)
- ��ǰ ��� ����¡ (10/30/50/��ü, �⺻ 10��)
- �˼� ���� ����� + hover 256px Ȯ�� �̸�����
- �Ľ� ���� ���̺� ��Ȯȭ (�˼� ��� / ��� ���� / ��� �Ϸ�)

**�ű� API ��������Ʈ**
- `/api/storage/all-items`: ��ü ���� �����Ű� ��ǰ ��� (��ǰ�������ϡ����¡�shippable)
- `/api/storage/my-locations`: ��� ���� �����̼� + Ÿ�ԡ��ְ���� ���
- `/api/storage/types`: Ȱ�� storage_types ��ü ���

**UX ��� �߰�**
- `ReleaseTypeSheet`: ��� ��û �� ����/�ؿ� ���� ���� ���ҽ�Ʈ
- `CapacityChangeSheet`: �뷮 ���� ���ҽ�Ʈ (600px ����, �ϴܹ� �� ��ư ����)
- `RenameSheet`: ������ �̸� ��� ���� ����
- ������ �ڵ� ���� �̸� ("�� ���丮��", "�� ���丮�� 2", ...)
- `/pickup`: ��⺸�� ���� ��û ��� (Step 3)
- `/storage/new`: ��⺸�� ���� �ܼ�ȭ
- �ܱ⺸�� ����Ⱓ(3��) + �ܿ���/���� ���� ǥ��
- ���丮�� ��(`/storage/[id]`): ��� ���� ��ǰ�� ǥ��

**��� ����**
- `/shipping-request`: `?parcels=` URL �� �����Ű� �κ��̽� �ڵ� ä��
- `/domestic-shipping`: `?parcels=` URL �� �ڽ����� �ܰ� �ǳʶٱ�

---

### 2026-06-08

#### ��� ���� ���� Phase 3 ? ���ź� ���� ���� + ���� ����ȭ

**DB ��Ű�� Ȯ�� (043~044)**
- `043_storage_status_pending_payment.sql`: customer_storages ���� Ȯ�� ? PENDING_PAYMENT �߰� (���ź� �̰��� ����)
- `044_pickup_box_fees.sql`: pickup_box_fees ���̺� ? �ڽ� ũ�⺰ ���ſ�� Admin ����

**���ź� ���� ����**
- `apps/web/app/api/storage/box-fees/route.ts` ? �ڽ� ũ�⺰ ��� ��ȸ API
- Admin ���� ȭ�鿡�� ���ź� ���� ���� ���� (DEFAULT/SMALL/MEDIUM/LARGE/XL)
- �ű� ���� ��û �� �ڽ� ũ�⿡ ���� ���ź� �ڵ� �ݿ�

**���� ����ȭ (KG Inicis)**
- INImobile UA ���� �ڵ� �б� (PC/�����)
- resultCode 0000 üũ, idc_name authUrl ����, netCancel ó��
- HPP(2) acceptmethod �߰� (�ڵ��� ���� ����)
- �ϴ� �׺� ���� �� �� `/storage` ����� ����

---

### 2026-06-05 ~ 06-07

#### ������� ���� (Phase 2) �ϼ�

**���� ����**
- KG Inicis INIStdPay (PC) ���� ���� �Ϸ�
- INImobile (�����) UA ���� �б� �Ϸ�
- PortOne v2 �� KG Inicis ���� �������� ��ȯ

**���� �ϼ���**
- ������� �ڽ� ���� ���� Ȯ�� (S 15,000 / M 18,000 / L 22,000 / XL 28,000��)
- �ֹ� ó�� �Ⱓ �ȳ� ��� �߰�
- ���� �����ȣ �ּ� �˻� ����
- �̿��� ���� üũ�ڽ� �߰�
- `/shop/terms`, `/shop/privacy` ���� ������ (���� ����Ʈ UI ����)

---

### 2026-06-04

#### ��ŷ����� ��ũ�÷ο� �ϼ� (Phase 1.7)

**DB ��Ű�� Ȯ�� (036~038)**
- `036_parcel_barcode_location.sql`: `parcel_barcodes.storage_location_id` ? ������ ���� ���� ��ġ ����
- `037_outbound_picking.sql`: `orders` / `domestic_orders`�� ��ŷ����� �÷� �߰�; �ֹ� ���� Ȯ�� (`PICKING` / `PICKING_DONE` / `OUTBOUND_WAIT`)
- `038_outbound_sessions.sql`: `outbound_sessions` ���̺� ? ��� �۾� ���� (�ڽ� ���, ���� URL, ��ĵ �α�, �����)
- `038_picking_item_tracking.sql`: `parcel_barcodes` ��ŷ ���� (`WAITING/DONE/HOLD/NOT_FOUND`), `picking_scan_logs` ���̺� �ż�

**������ ��ŷ ������**
- `apps/admin/app/(dashboard)/picking/page.tsx` ? PAID ���� �ֹ� ��ŷ ��� ��� (����/���� ����)
- `apps/admin/app/(dashboard)/picking/[id]/page.tsx` ? ��ŷ ��: ���ڵ� ��ĵ �� ��ǰ�� DONE/HOLD/NOT_FOUND ó��, ��ü �Ϸ� �� PICKING_DONE ��ȯ
- `apps/admin/app/api/admin/picking/[id]/route.ts` ? ��ŷ ���� ��ȸ/���� ������Ʈ
- `apps/admin/app/api/admin/picking/[id]/scan/route.ts` ? ��ŷ ���ڵ� ��ĵ ó��

**������ ��� ������**
- `apps/admin/app/(dashboard)/outbound/page.tsx` ? PICKING_DONE �ֹ� ��� ��� ���
- `apps/admin/app/api/admin/outbound/[id]/route.ts` ? ��� ���� ��ȸ/������Ʈ
- `apps/admin/app/api/admin/outbound/[id]/session/route.ts` ? ��� ���� ����/�Ϸ�
- `apps/admin/app/api/admin/outbound/[id]/stream-upload/route.ts` ? Cloudflare Stream ���� ���ε�

**������ ���� �ֹ� �� ��Ÿ**
- `/domestic-orders`, `/domestic-orders/[id]`, `/domestic-orders/[id]/label` ? ���� ��� �ֹ� ����
- `/orders/[id]/packing-slip` ? ��ŷ ���� ���
- `DashboardNav.tsx`: ��ũ ���ǿ� "��ŷ", "���" �޴� �߰�

---

### 2026-06-02

#### ���丮�� ����=����Ʈ �ڵ� ���� �ý��� �ϼ�

**parcel_size_code ���� (MINI/STANDARD/LONG/XL/OVERSIZE)**
- `admin/lib/parcels/size.ts`, `web/lib/parcels/size.ts` �ű� �ۼ�
  - ���� SMALL/MEDIUM/LARGE/XLARGE �� storage_types.code �� ������ �ڵ�� ����
  - `weightKgToSizeCode(kg)` �Լ�: �Ⱦ� ���� �� size code �ڵ� ����
    - ��2kg �� MINI(16L) / ��5kg �� STANDARD(40.5L) / ��10kg �� LONG(96L) / ��20kg �� XL(108.2L) / ��30kg �� OVERSIZE(480L)
- `sql/035_parcel_size_code_migrate.sql`: ���� �ڵ� �ϰ� ��ȯ + pickup_weight_kg ��� �̼��� ���� �ڵ� ä���

**���Ž�û ���� �ڵ� size code ����**
- `apps/web/app/api/pickup/route.ts`
  - �ڽ� ����(`spec.weight`) ��� `parcel_size_code` ��� �� DB ����
  - ���Ž�û �������� ���丮�� ����Ʈ�� Ȯ����

**�԰� ó�� �ڵ� �����̼� ���� ���ȭ** (`api/admin/inbound/process`)
1. ���� ��� �����̼� ���� ���� üũ (���� �켱)
2. **�ܰ��� ������¡**: �� �´� Ÿ�� �� �� �ܰ� ū Ÿ�� �� ... ������ Ž��
3. **���� ����**: ���� �����̼����� �����ϸ� ���� �����̼��� ���� �ջ� �뷮 Ȯ��
4. ���� fallback: Ÿ�ԡ�ũ�� ���� �ƹ� �� �ڸ�
- �԰� �Ϸ� ȭ�鿡 ���� ���� �� �߰� �����̼� �ڵ� ǥ��

#### ���丮�� Ÿ�� ���ݡ��뷮 �ζ��� ����

- `apps/admin/app/(dashboard)/storage/manage/page.tsx`
  - Ÿ�� ī�忡 ?? �ִ�Ǽ� + ?? �ְ����/���ѿ�� �ζ��� ���� UI �߰�
- `apps/admin/app/api/admin/storage/route.ts` PATCH
  - `price_per_week`, `price_max` ���� ���� �߰�

#### �����̼� �̵�ó�� ���� ������ �ż�

- `apps/admin/app/(dashboard)/transfer/page.tsx` �ű�
  - **���ڵ� 2�� ��ĵ**���� ��� �̵�ó��: �� ���� ���ڵ� �� �� ������ �����̼� �ڵ�
  - ���� ���ڵ塤������ȣ�������̼� �ڵ� �ڵ� �Ǻ�
  - �Ϸ� �� "���� ���� ��ĵ" ��ư���� ���� ó��
- `apps/admin/app/api/admin/transfer/scan/route.ts` �ű�
  - ��ĵ �Է� �ڵ� �Ǻ�: ���ڵ� �� ���� / �����̼� �ڵ� �� �����̼�+�����������
- `DashboardNav.tsx`: ���丮�� ���ǿ� "�̵�ó��" �޴� �߰�

---

### 2026-06-01

#### ���丮�� �ý��� �ϼ� (026~034 ���̱׷��̼�)

**���丮�� �����̼� ����**
- `026~031`: storage_locations, storage_zones, storage_types, �׸��塤�˸� �� ����
- `/storage` ������: Zone�� �׸���, Ÿ�� �������������ݡ������ϼ� ǥ��
- `/storage/[id]` ��: ���� �뷮 ��, ���� ���� ī��, ��� ���� ����

**�԰�ó�� ���� ������ + ���� ���ڵ� �ý���**
- `032`: parcel_barcodes ���̺� (`{tracking_no}-01` ���� ���� ���ڵ�)
- `/inbound` ���� ������: ���ڵ� ��ĵ �� ���� Ȯ�� �� ���� �Կ� �� �����̼� ����

**���丮�� �뷮 ���� ���**
- `033~034`: storage_locations.max_parcels, parcels.parcel_size_code �÷� �߰�
- `/storage/manage` ������: Zone������ ����, Ÿ�� ����, ���ڵ�� UI, �ϰ� ����

**���� ��ġ �̵� �̷�**
- `035_parcel_location_history.sql`: parcel_location_events ���̺�
- `/parcels/[id]` ��: ��ġ �̵� �̷� Ÿ�Ӷ��� ǥ��

#### ������� ���� ���̵�� ���� �߰�
- `apps/web/components/ui/SidebarDomesticCalculator.tsx` �ű� ����
  - â������ ������ ��� ��� (ũ�� L+W+H �հ� �� ���� ��� 8����)
  - �����갣������ üũ�ڽ� ���� �� +2,500�� �ڵ� ����
  - ��ü ���ǥ ����/��ġ�� ����
- `SidebarWrapper.tsx` ������Ʈ: ��κ� ���� �б�
  - `/domestic-shipping`, `/domestic-rates` �� `SidebarDomesticCalculator`
  - `/shipping-request` �� �ؿܹ�� �� ���� `SidebarCalculator` (EMS �� K-Packet) ����
  - `/shipping-calc` �� `SidebarShippingCalcInfo` ����

#### ������� ����ǥ ������ ���� (`/domestic-rates`)
- ���� ���ϱ�/Ÿ�� �߷��� ���ǥ �� **â������ ������** ���ǥ�� ��ü (������ ������ ��ġ)
- �ΰ����� �׸� ����: ���ҡ����衤����Ư�� ����, ��԰� ���� (+3,000��)�� ����
- ���� �ȳ� ���� ����: �ܹ���(��) �� �ֹ���(��) ǥ��

#### Ȩ ����ũ ����
- "����ǥ" �� **�ؿܹ�� ����ǥ**, "���� �ù� ���" �� **������� ����ǥ** ���̺� ����
- ����ũ ���� ����: ������� ����ǥ�� ���� ���̵庸�� ������

---

## ?? 변경 이력

### 2026-06-11 스토리지 비즈니스 로직 구현

**장기보관 고객 단기보관함 생성 차단**
- `POST /api/storage`: 이미 장기보관 슬롯이 있으면 short_term 생성 시 409 반환
- 장기보관 고객은 기존 장기보관함으로만 입고 가능

**수거신청 시 스토리지 자동 연결** (`POST /api/pickup/route.ts`)
- 클라이언트 지정 `customer_storage_id` 우선 사용
- 없으면 장기보관함 자동 매핑 (가장 오래된 슬롯)
- 장기보관도 없으면 단기보관함 조회 후 없으면 자동 생성
- → 최초 수거신청 시 장기보관 미선택 = 단기보관 자동 배정

**수거신청 슬롯 피커 UI** (`pickup/page.tsx`)
- 장기보관 슬롯이 있으면 "어느 보관함으로 입고할까요?" 피커 표시
- 없으면 기존 장기보관 신청 opt-in UI 유지

**슬롯 간 이동 신청** (`storage/[id]/page.tsx`)
- 장기보관 슬롯이 여러 개인 경우 "다른 보관함으로 이동 신청" 버튼 노출
- `TransferToSlotSheet`: 대상 슬롯 선택 → TRANSFER_ITEMS 변경요청 접수

**슬롯 합치기** (`storage/page.tsx`)
- 활성 슬롯 2개 이상일 때 "슬롯 합치기" 버튼 노출
- `MergeSlotSheet`: **리터 기반 실시간 용량 검증** (`target_free >= source_used`)
  - 합산 용량 초과 시 버튼 비활성화 + 부족량 표시
  - 요청 즉시 소스 슬롯 CANCELLED, DB 자동 반영

**즉시 적용 타입 vs 승인 필요 타입**
- 즉시 적용 (`CAPACITY_CHANGE`, `MERGE_SLOTS`): DB 자동 반영 → 관리자 작업지시서 수신
- 승인 필요 (`CONVERT_TO_LONG_TERM`, `TRANSFER_ITEMS`): 관리자가 승인/반려

**API 확장** (`change-request/route.ts`)
- `CAPACITY_CHANGE`: `plan_type`·`capacity_score` 즉시 업데이트 후 work order 생성
- `CAPACITY_CHANGE`: 다운그레이드 차단 (422), 최대 사이즈 차단 (`suggest_add_slot: true`)
- `MERGE_SLOTS`: 리터 용량 검증 → 소스 슬롯 즉시 CANCELLED → work order 생성
- `TRANSFER_ITEMS` + `target_storage_id`, `MERGE_SLOTS` + `source_storage_ids` 지원

**어드민 UI** (`admin/storage/manage`)
- 즉시적용 타입에 "📋 작업지시 / DB 자동적용" 배지 표시
- "작업완료" 버튼 (amber 색상)으로 물리적 작업 완료 표시
- 승인 필요 타입은 기존 "승인/반려" 유지
- **강제 용량 변경 모달**: 고객 요청 없이 관리자가 직접 변경 (다운그레이드 포함)
- `PATCH /api/admin/storage/[id]/force-plan` 신규 엔드포인트

**DB 마이그레이션**
- `053_storage_transfer_items.sql`: `target_storage_id` 컬럼 + `TRANSFER_ITEMS` 타입
- `054_storage_merge_slots.sql`: `source_storage_ids UUID[]` 컬럼 + `MERGE_SLOTS` 타입
---

### 2026-06-12 ~ 2026-06-15 스토리지 고도화 + UI 정비

**DB 마이그레이션**
- `055_capacity_score_numeric.sql`: `capacity_score` / `used_score` 컬럼 INTEGER → NUMERIC(8,2) 변경
  - `volume_liter`가 40.5(STANDARD) 등 소수점 값이어서 발생하던 `invalid input syntax for type integer` 오류 수정
  - `usage_percent` generated column + `trg_update_storage_max_plan` 트리거 재생성
- `056_customer_storages_storage_type_id.sql`: `customer_storages`에 `storage_type_id UUID REFERENCES storage_types(id)` 컬럼 추가
  - `plan_type`(청구 플랜 S/M/L/XL FK) ≠ 물리 박스 타입(MINI/STANDARD/LONG...) 분리
  - `CAPACITY_CHANGE` / `force-plan` 에서 `plan_type`에 storage_types.code를 넣던 FK 위반 수정
- `057_storage_type_names.sql`: 스토리지 타입 명칭 변경
  - MINI → 파인트블록 / STANDARD → 싱글블록 / LONG → 더블블록 / XL → 패밀리블록 / OVERSIZE → 하프블록

**스토리지 용량 변경 로직 개선**
- 다운그레이드 허용: `used_score <= newVolume`이면 더 작은 용량으로 변경 가능
  - 초과 시 "XXL 비워야 합니다" 에러 반환 (422)
  - 기존: 업그레이드 전용 → 변경: 사용량 기반 다운그레이드 허용
- `CapacityChangeSheet` UI 전면 개편
  - 현재 사용 중 블록 상단 카드 표시 ("현재 사용 중" 배지 + 사용량 %)
  - 업그레이드 / 다운그레이드 섹션 분리
  - 다운그레이드 옵션별 가/불가 실시간 표시 (초록/빨강 인디케이터)
  - 단기보관(`short_term`) 슬롯은 주단위 요금, 장기보관은 월단위 요금 표시
  - 타입 아이콘: 영문 코드 앞 2자 → 한글 명칭 앞 2자로 변경

**로케이션 이동 페이지 작업지시서 패널 추가** (`/transfer`)
- 레이아웃: `max-w-md` 단일 컬럼 → `max-w-5xl` 2열 (`xl:grid-cols-[1fr_400px]`)
- 좌측 `WorkOrderPanel`: PENDING `storage_change_requests` 자동 로딩
  - 요청 타입별 색상 구분 (용량변경/슬롯추가/합치기/물품이동/장기전환)
  - DB자동적용 타입에 "DB자동적용" 뱃지 표시
  - "작업완료" 버튼 → APPROVED 처리 후 목록 갱신
- 우측: 기존 바코드 스캐너 (기능 그대로)
- `change-requests` API GET에 `target_storage_id` 필드 추가

**스토리지 페이지 실시간 상태 유지**
- 변경 완료 후 `onDone()` 콜백으로 조용한 재로드 (`load(true)`)
- `visibilitychange` 이벤트: 탭 복귀 시 자동 새로고침
- 적용 시트: `CapacityChangeSheet`, `MergeSlotSheet`, `ConvertToLongTermSheet`, `TransferToSlotSheet`
- 기존 `window.location.reload()` 제거

**API 수정**
- `change-request/route.ts`: `plan_type` 대신 `storage_type_id` 업데이트
- `force-plan/route.ts`: 동일
- `storage/route.ts` GET: `storage_types` join 추가 (`storage_type_id` FK 기반)

**UI 정비**
- 프로필 수정 팝업: 바텀시트 → 화면 중앙 모달 (`rounded-3xl`, 다른 팝업과 동일 스타일)
- 스토리지 명칭 `TYPE_SIZE_KO` 매핑 업데이트 (파인트블록/싱글블록/더블블록/패밀리블록/하프블록)

---

## ?? 라이선스

Private ? ���� ���� �� ���� ����
