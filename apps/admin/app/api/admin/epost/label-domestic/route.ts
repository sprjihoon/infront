import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import type { DomesticLabelData } from '@/components/epost/DomesticLabelSheet';

/**
 * GET /api/admin/epost/label-domestic?domestic_order_id=UUID
 * 국내 소포 라벨 데이터 반환
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const domestic_order_id = req.nextUrl.searchParams.get('domestic_order_id');
  if (!domestic_order_id) return NextResponse.json({ error: 'domestic_order_id 필수' }, { status: 400 });

  const { data: order, error } = await adminDb
    .from('domestic_orders')
    .select(`
      id, status, epost_regi_no, epost_req_no, epost_price,
      recipient_name, recipient_phone, recipient_zip,
      recipient_addr1, recipient_addr2,
      items_desc, weight_g, vol_length, vol_width, vol_height,
      parcel_ids, delivery_msg, created_at,
      customers(name, customer_code)
    `)
    .eq('id', domestic_order_id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: '국내 배송 신청을 찾을 수 없습니다.' }, { status: 404 });
  }

  const SENDER_ADDR = [
    process.env.INFRONT_SENDER_ADDR1 ?? '',
    process.env.INFRONT_SENDER_ADDR2 ?? '',
  ].filter(Boolean).join(' ');

  const weightKg = order.weight_g ? `${(order.weight_g / 1000).toFixed(1)}` : '2';
  let volumeCm = '60';
  if (order.vol_length && order.vol_width && order.vol_height) {
    volumeCm = String(Math.floor((order.vol_length * order.vol_width * order.vol_height) / 5000));
  }

  const parcelCount = Array.isArray(order.parcel_ids) ? order.parcel_ids.length : 0;

  const label: DomesticLabelData = {
    trackingNo:       order.epost_regi_no ?? '',
    orderDate:        new Date(order.created_at).toLocaleDateString('ko-KR'),
    orderNumber:      `DOM-${domestic_order_id.slice(0, 8).toUpperCase()}`,
    senderAddress:    SENDER_ADDR,
    senderName:       process.env.INFRONT_SENDER_NAME ?? '인프론트',
    senderPhone:      process.env.INFRONT_SENDER_TEL2 ?? '',
    recipientName:    order.recipient_name,
    recipientPhone:   order.recipient_phone,
    recipientZipcode: order.recipient_zip,
    recipientAddress: `${order.recipient_addr1} ${order.recipient_addr2 ?? ''}`.trim(),
    totalQuantity:    parcelCount || 1,
    itemsList:        order.items_desc || '의류',
    weight:           weightKg,
    volume:           volumeCm,
    memo:             order.delivery_msg ?? undefined,
  };

  return NextResponse.json({ label, order });
}
