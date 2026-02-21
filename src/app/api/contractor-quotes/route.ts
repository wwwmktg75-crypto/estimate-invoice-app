import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/** 取り込み済み業者見積一覧 */
export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('contractor_quotes')
      .select('*')
      .order('imported_at', { ascending: false });

    if (error) throw error;

    const list = (data || []).map((r) => ({
      quoteId: r.id,
      importedAt: r.imported_at,
      fileName: r.file_name,
      subject: r.subject,
      contractorName: r.contractor_name || '',
      totalCost: Number(r.total_cost) || 0,
    }));

    return NextResponse.json({ list, error: null });
  } catch (e) {
    const msg = (e as Error).message || '';
    const errMsg =
      msg.indexOf('権限') >= 0 || msg.indexOf('permission') >= 0
        ? 'データベースにアクセスできません。'
        : '取得に失敗しました: ' + msg;
    return NextResponse.json({ list: [], error: errMsg }, { status: 500 });
  }
}
