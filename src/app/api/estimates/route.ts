import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/** 見積一覧（続きから用） */
export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('client_estimates')
      .select('id, project_name, client_name, create_date, status, pdf_file_id')
      .order('id', { ascending: false })
      .limit(20);

    if (error) throw error;

    const list = (data || []).map((r) => ({
      estimateId: r.id,
      projectName: r.project_name,
      clientName: r.client_name,
      createDate: r.create_date,
      status: r.status,
      pdfFileId: r.pdf_file_id,
    }));

    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

/** 見積作成 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      projectName,
      clientName,
      baseItems = [],
      defaultRate = 15,
      forceNew = true,
    } = body;

    const rate = Number(defaultRate) || 15;
    const supabase = createServerClient();

    if (!forceNew) {
      const { data: existing } = await supabase
        .from('client_estimates')
        .select('id')
        .eq('project_name', projectName)
        .eq('client_name', clientName)
        .eq('status', '下書き')
        .limit(1)
        .single();

      if (existing) {
        return NextResponse.json({
          estimateId: existing.id,
          isNew: false,
        });
      }
    }

    const { data: inserted, error } = await supabase
      .from('client_estimates')
      .insert({
        project_name: projectName,
        client_name: clientName,
        default_profit_rate: rate,
        status: '下書き',
      })
      .select('id')
      .single();

    if (error) throw error;
    const estimateId = inserted!.id;

    for (let idx = 0; idx < baseItems.length; idx++) {
      const item = baseItems[idx];
      const cost = Number(item.costPrice ?? item.price) || 0;
      const qty = Number(item.qty) || 1;
      const itemRate = (item.profitRate != null && item.profitRate !== '') ? Number(item.profitRate) : rate;
      const applyMargin = item.applyMargin !== false;
      const sellPrice = applyMargin ? Math.floor(cost * (1 + itemRate / 100)) : cost;
      const amount = sellPrice * qty;

      await supabase.from('client_estimate_items').insert({
        estimate_id: estimateId,
        line_no: idx + 1,
        name: item.name || '',
        qty,
        unit: item.unit || '式',
        cost_price: cost,
        profit_rate: applyMargin ? itemRate : null,
        apply_margin: applyMargin,
        sell_price: sellPrice,
        amount,
      });
    }

    return NextResponse.json({
      estimateId,
      isNew: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
