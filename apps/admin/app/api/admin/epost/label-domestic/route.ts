import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import type { DomesticLabelData } from '@/components/epost/DomesticLabelSheet';
import { renderDomesticLabelPdf } from '@/lib/epost/domestic-label-pdf';

function seoulDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

/**
 * GET /api/admin/epost/label-domestic?domestic_order_id=UUID&format=json|pdf
 * format=pdf 는 우체국 신형 C형 송장이다.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const domestic_order_id = req.nextUrl.searchParams.get('domestic_order_id');
  if (!domestic_order_id) return NextResponse.json({ error: 'domestic_order_id 필수' }, { status: 400 });

  const format = req.nextUrl.searchParams.get('format') ?? 'json';

  const { data: order, error } = await adminDb
    .from('domestic_orders')
    .select(`
      id, status, epost_order_no, epost_regi_no, epost_req_no, epost_res_no, epost_price,
      epost_regi_po, epost_res_date, epost_v_tel_no, epost_applied_at,
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
  const orderNo = order.epost_order_no || `DOM-${domestic_order_id.slice(0, 8).toUpperCase()}`;

  if (format === 'pdf') {
    const pdf = await renderDomesticLabelPdf({
      print_sender_name: process.env.INFRONT_SENDER_NAME ?? '인프론트',
      print_sender_phone: process.env.INFRONT_SENDER_TEL2 ?? '',
      print_sender_zip: process.env.INFRONT_SENDER_ZIPCODE ?? '',
      print_sender_addr1: process.env.INFRONT_SENDER_ADDR1 ?? '',
      print_sender_addr2: process.env.INFRONT_SENDER_ADDR2 ?? '',
      recipient_name: order.recipient_name,
      recipient_phone: order.recipient_phone,
      v_tel_no: order.epost_v_tel_no ?? '',
      recipient_zip: order.recipient_zip,
      recipient_addr1: order.recipient_addr1,
      recipient_addr2: order.recipient_addr2 ?? '',
      goods_name: order.items_desc || '의류',
      goods_qty: parcelCount || 1,
      order_no: orderNo,
      tracking_no: order.epost_regi_no ?? '',
      post_office: order.epost_regi_po ?? '',
      res_date: order.epost_res_date || seoulDate(order.epost_applied_at || order.created_at),
      notes: order.delivery_msg ?? '',
      status: order.status === 'CANCELLED' ? 'canceled' : order.status,
    });
    const filename = `domestic-${orderNo.replace(/[^\w-]/g, '_')}.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const label: DomesticLabelData = {
    trackingNo:       order.epost_regi_no ?? '',
    orderDate:        seoulDate(order.epost_applied_at || order.created_at),
    orderNumber:      orderNo,
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
