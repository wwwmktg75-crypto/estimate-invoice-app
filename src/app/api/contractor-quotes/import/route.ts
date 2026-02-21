import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { extractQuoteDetailsFromBuffer } from '@/lib/excel-parser';

/** Excelファイルをアップロードして業者見積を取り込み */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'ファイルが指定されていません' },
        { status: 400 }
      );
    }

    const name = file.name;
    const isExcel =
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (!isExcel) {
      return NextResponse.json(
        { success: false, error: 'Excelファイル（.xlsx / .xls）のみ対応しています' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const details = extractQuoteDetailsFromBuffer(buffer);

    const subject = name.replace(/\.(xlsx|xls)$/i, '');
    const totalCost = details.reduce(
      (sum, item) => sum + (item.amount || item.price * (item.qty || 1)),
      0
    );

    const quoteId =
      'CQ-' +
      new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14) +
      '-' +
      String(Math.floor(Math.random() * 1000));

    const supabase = createServerClient();

    await supabase.from('contractor_quotes').insert({
      id: quoteId,
      file_name: name,
      subject,
      contractor_name: '',
      total_cost: totalCost,
    });

    for (let idx = 0; idx < details.length; idx++) {
      const item = details[idx];
      const amt =
        item.amount != null ? item.amount : (item.price || 0) * (item.qty || 1);
      await supabase.from('contractor_quote_items').insert({
        quote_id: quoteId,
        line_no: idx + 1,
        name: item.name || '',
        qty: item.qty != null ? item.qty : 1,
        unit: item.unit || '式',
        cost_price: item.price != null ? item.price : 0,
        amount: amt,
      });
    }

    return NextResponse.json({
      success: true,
      quoteId,
      subject,
      itemCount: details.length,
      totalCost,
      items: details,
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: (e as Error).message,
      },
      { status: 500 }
    );
  }
}
