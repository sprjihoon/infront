import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const { data: order, error } = await adminDb
    .from('domestic_orders')
    .select(`
      id, status, customer_id,
      recipient_name, recipient_phone, recipient_zip, recipient_addr1, recipient_addr2,
      parcel_ids, items_desc, delivery_msg,
      weight_g, vol_length, vol_width, vol_height,
      epost_regi_no, epost_req_no, epost_price, epost_regi_po,
      created_at, updated_at,
      customers(name, customer_code, email)
    `)
    .eq('id', id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: '국내 배송 신청을 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ order });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { status?: string };

  const { error } = await adminDb
    .from('domestic_orders')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
