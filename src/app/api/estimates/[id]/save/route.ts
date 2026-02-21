import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/** 見積明細保存 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const estimateId = parseInt(id, 10);
    if (isNaN(estimateId)) {
      return NextResponse.json(
        { success: false },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { items = [], defaultProfitRate = 15 } = body;

    const filtered = (items as Array<{ name?: string }>).filter(
      (item) => String(item.name || '').trim() !== ''
    );
    if (filtered.length === 0) {
      return NextResponse.json({ success: true });
    }

    const supabase = createServerClient();

    await supabase
      .from('client_estimate_items')
      .delete()
      .eq('estimate_id', estimateId);

    const rate = Number(defaultProfitRate) || 15;

    for (let idx = 0; idx < filtered.length; idx++) {
      const item = filtered[idx] as {
        name?: string;
        qty?: number;
        unit?: string;
        costPrice?: number;
        profitRate?: number;
        applyMargin?: boolean;
      };
      const qty = Number(item.qty) || 0;
      const cost = Number(item.costPrice) || 0;
      const itemRate =
        item.profitRate != null && String(item.profitRate).trim() !== ''
          ? Number(item.profitRate)
          : rate;
      const applyRate = item.applyMargin !== false ? 1 + itemRate / 100 : 1;
      const sellPrice = Math.floor(cost * applyRate);
      const amount = sellPrice * qty;

      await supabase.from('client_estimate_items').insert({
        estimate_id: estimateId,
        line_no: idx + 1,
        name: String(item.name || '').trim(),
        qty,
        unit: item.unit || '式',
        cost_price: cost,
        profit_rate: item.profitRate != null ? item.profitRate : null,
        apply_margin: item.applyMargin !== false,
        sell_price: sellPrice,
        amount,
      });
    }

    await supabase
      .from('client_estimates')
      .update({ default_profit_rate: rate })
      .eq('id', estimateId);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
