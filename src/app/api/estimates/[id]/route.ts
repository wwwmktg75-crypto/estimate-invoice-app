import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/** 見積詳細取得 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const estimateId = parseInt(id, 10);
    if (isNaN(estimateId)) {
      return NextResponse.json(
        { success: false, message: '無効な見積ID' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: header, error: headerErr } = await supabase
      .from('client_estimates')
      .select('*')
      .eq('id', estimateId)
      .single();

    if (headerErr || !header) {
      return NextResponse.json(
        { success: false, message: '見積が見つかりません' },
        { status: 404 }
      );
    }

    const { data: itemsData, error: itemsErr } = await supabase
      .from('client_estimate_items')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('line_no');

    if (itemsErr) throw itemsErr;

    const items = (itemsData || []).map((r) => ({
      lineNo: r.line_no,
      name: r.name,
      qty: Number(r.qty) || 0,
      unit: r.unit || '式',
      costPrice: Number(r.cost_price) || 0,
      profitRate: r.profit_rate != null ? Number(r.profit_rate) : null,
      applyMargin: r.apply_margin !== false,
      sellPrice: Number(r.sell_price) || 0,
      amount: Number(r.amount) || 0,
    }));

    return NextResponse.json({
      success: true,
      estimateId: header.id,
      projectName: header.project_name,
      clientName: header.client_name,
      createDate: header.create_date,
      expiryDate: header.expiry_date,
      defaultProfitRate: Number(header.default_profit_rate) || 15,
      status: header.status,
      pdfFileId: header.pdf_file_id,
      note: header.note,
      items,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
