import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/** クライアント一覧（datalist用）- clients + estimates/invoices から重複排除 */
export async function GET() {
  try {
    const supabase = createServerClient();
    const names = new Set<string>();

    const { data: clients } = await supabase.from('clients').select('name');
    (clients || []).forEach((r) => {
      if (r.name) names.add(r.name);
    });

    const { data: est } = await supabase
      .from('client_estimates')
      .select('client_name');
    (est || []).forEach((r) => {
      if (r.client_name) names.add(r.client_name);
    });

    const { data: inv } = await supabase.from('invoices').select('client_name');
    (inv || []).forEach((r) => {
      if (r.client_name) names.add(r.client_name);
    });

    const list = Array.from(names).sort();
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json([], { status: 500 });
  }
}
