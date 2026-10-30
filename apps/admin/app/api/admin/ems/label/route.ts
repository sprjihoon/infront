import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import { renderLabelPdf } from '@/lib/ems/form-pdf';
import { buildOrderLabelData, renderLabelHtml, toOfficialLabel, type LabelBoxRow } from '@/lib/ems/label';

export const preferredRegion = 'icn1';

const ORDER_SELECT = `
  id, order_no, status, shipping_method,
  ems_regino, ems_fee, ems_req_no, ems_receive_seq, ems_premium_cd, ems_applied_at,
  ems_post_office, ems_post_office_code,
  recipient_name, recipient_country, recipient_phone, recipient_email,
  recipient_addr1, recipient_addr2, recipient_addr3, recipient_zip,
  item_list, customs_value, actual_weight,
  insurance_enabled, insurance_amount,
  created_at
`;

/**
 * GET /api/admin/ems/label?order_id={uuid}&format=json|html|pdf
 *
 * 해외배송 송장. format=pdf 는 배송수단별 우체국 A4 양식이다.
 * EMS, EMS 프리미엄, K-Packet 은 서로 다른 양식을 쓴다.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const orderId = req.nextUrl.searchParams.get('order_id');
  if (!orderId) {
    return NextResponse.json({ error: 'order_id 필수' }, { status: 400 });
  }

  const format = req.nextUrl.searchParams.get('format') ?? 'json';

  const { data: order, error } = await adminDb
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
  }

  const label = buildOrderLabelData(order);

  if (format === 'pdf') {
    const { data: boxes } = await adminDb
      .from('shipping_boxes')
      .select('box_seq, weight_kg, length_cm, width_cm, height_cm, intl_tracking_no')
      .eq('order_id', orderId)
      .order('box_seq', { ascending: true });
    const pdf = await renderLabelPdf(toOfficialLabel(order, (boxes ?? []) as LabelBoxRow[]));
    const filename = `label-${String(order.order_no).replace(/[^\w-]/g, '_')}.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'html') {
    const html = renderLabelHtml(label);
    const filename = `label-${order.order_no.replace(/[^\w-]/g, '_')}.html`;
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ ok: true, label });
}
