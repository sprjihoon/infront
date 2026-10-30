import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import { renderInboundBarcodePdf } from '@/lib/parcels/barcode-label-pdf';
import { markBarcodesAsPrinted } from '@/lib/parcels/barcode';

/**
 * GET /api/admin/inbound/barcode-pdf?parcel_id=
 * 입고 바코드. 페이지 한 장이 62×38mm 스티커 한 장이다.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parcelId = req.nextUrl.searchParams.get('parcel_id');
  if (!parcelId) return NextResponse.json({ error: 'parcel_id 필수' }, { status: 400 });

  const { data: parcel, error } = await adminDb
    .from('parcels')
    .select('id, tracking_no, customers(name, customer_code)')
    .eq('id', parcelId)
    .single();

  if (error || !parcel) {
    return NextResponse.json({ error: '소포를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: rows, error: barcodeError } = await adminDb
    .from('parcel_barcodes')
    .select('barcode_no, seq, item_name')
    .eq('parcel_id', parcelId)
    .order('seq', { ascending: true });

  if (barcodeError) return NextResponse.json({ error: barcodeError.message }, { status: 500 });
  if (!rows?.length) {
    return NextResponse.json({ error: '출력할 바코드가 없습니다.' }, { status: 400 });
  }

  const customer = Array.isArray(parcel.customers) ? parcel.customers[0] : parcel.customers;
  const vendor = (customer?.name || customer?.customer_code || '').trim();
  const pdf = await renderInboundBarcodePdf(rows.map((row) => ({
    barcode: row.barcode_no,
    product: row.item_name || '',
    vendor,
  })));

  await markBarcodesAsPrinted(adminDb, parcelId);

  const filename = `barcode-${(parcel.tracking_no || parcelId).replace(/[^\w-]/g, '_')}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
