import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import { buildOrderLabelData, renderLabelHtml } from '@/lib/ems/label';

export const preferredRegion = 'icn1';

const ORDER_SELECT = `
  id, order_no, shipping_method,
  ems_regino, ems_fee, ems_req_no, ems_receive_seq,
  recipient_name, recipient_country, recipient_phone, recipient_email,
  recipient_addr1, recipient_addr2, recipient_addr3, recipient_zip,
  item_list, customs_value,
  insurance_enabled, insurance_amount,
  created_at
`;

/**
 * GET /api/admin/ems/label?order_id={uuid}&format=json|html
 *
 * EMS 배송 라벨 데이터 조회 (자체 CN22 형식)
 * - format=json (기본): 라벨 JSON
 * - format=html: 인쇄용 HTML (브라우저/다운로드)
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
