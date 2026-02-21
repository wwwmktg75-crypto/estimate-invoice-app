import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/** 請求書一覧 */
export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list = (data || []).map((r) => ({
      invoiceId: r.id,
      clientName: r.client_name,
      amount: r.amount,
      issueDate: r.issue_date,
      isIssued: r.is_issued,
      pdfFileId: r.pdf_file_id,
      emailTo: r.email_to,
      note: r.note,
      createdAt: r.created_at,
    }));

    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

/** 請求書作成 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientName, amount = 0, items = [], emailTo = '' } = body;

    const invoiceId =
      'INV-' +
      new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

    const supabase = createServerClient();

    await supabase.from('invoices').insert({
      id: invoiceId,
      client_name: clientName,
      amount: Number(amount) || 0,
      is_issued: false,
      email_to: emailTo || '',
    });

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      await supabase.from('invoice_items').insert({
        invoice_id: invoiceId,
        line_no: idx + 1,
        description: String(item.description || '').trim(),
        amount: Number(item.amount) || 0,
      });
    }

    return NextResponse.json({ success: true, invoiceId });
  } catch (e) {
    const msg = (e as Error).message || '';
    if (msg.indexOf('権限') >= 0 || msg.indexOf('permission') >= 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'データベースに書き込む権限がありません。',
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: '請求書の作成に失敗しました: ' + msg },
      { status: 500 }
    );
  }
}
