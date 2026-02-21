import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/** 請求書詳細 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const supabase = createServerClient();

    const { data: row, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (error || !row) {
      return NextResponse.json(null, { status: 404 });
    }

    const { data: itemsData } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('line_no');

    const items = (itemsData || []).map((r) => ({
      description: r.description,
      amount: Number(r.amount) || 0,
    }));

    return NextResponse.json({
      invoiceId: row.id,
      clientName: row.client_name,
      amount: Number(row.amount) || 0,
      issueDate: row.issue_date,
      isIssued: row.is_issued,
      pdfFileId: row.pdf_file_id,
      emailTo: row.email_to || '',
      note: row.note || '',
      items,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
