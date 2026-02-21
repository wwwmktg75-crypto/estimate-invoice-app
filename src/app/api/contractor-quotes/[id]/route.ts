import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/** 業者見積1件の削除（明細はCASCADEで削除） */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params;
    const supabase = createServerClient();

    const { error } = await supabase
      .from('contractor_quotes')
      .delete()
      .eq('id', quoteId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}

/** 業者見積1件のヘッダー＋明細取得 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params;
    const supabase = createServerClient();

    const { data: headerRow, error: headerErr } = await supabase
      .from('contractor_quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (headerErr && headerErr.code !== 'PGRST116') throw headerErr;

    const header = headerRow
      ? {
          quoteId: headerRow.id,
          importedAt: headerRow.imported_at,
          fileName: headerRow.file_name || '',
          subject: headerRow.subject || '',
          contractorName: headerRow.contractor_name || '',
          totalCost: Number(headerRow.total_cost) || 0,
        }
      : {
          quoteId,
          importedAt: '',
          fileName: '',
          subject: '',
          contractorName: '',
          totalCost: 0,
        };

    const { data: itemsData, error: itemsErr } = await supabase
      .from('contractor_quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('line_no');

    if (itemsErr) throw itemsErr;

    const items = (itemsData || []).map((r) => ({
      name: r.name,
      qty: Number(r.qty) || 1,
      unit: r.unit || '式',
      costPrice: Number(r.cost_price) || 0,
      amount: Number(r.amount) || 0,
    }));

    return NextResponse.json({
      success: true,
      quoteId,
      header,
      items,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
