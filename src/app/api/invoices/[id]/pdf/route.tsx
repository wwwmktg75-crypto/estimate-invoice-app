import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToStream,
} from '@react-pdf/renderer';

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (data: Buffer) => chunks.push(data));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11 },
  title: { fontSize: 18, marginBottom: 8, fontWeight: 'bold' },
  row: { marginBottom: 4, fontSize: 11 },
  table: { marginTop: 16 },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingVertical: 6,
  },
  tableHeader: { backgroundColor: '#eee', fontWeight: 'bold' },
  col1: { width: '70%' },
  col2: { width: '30%', textAlign: 'right' },
  total: { marginTop: 16, fontSize: 14, fontWeight: 'bold' },
});

function InvoicePdfDoc({
  companyName,
  clientName,
  issueDate,
  items,
  total,
}: {
  companyName: string;
  clientName: string;
  issueDate: string;
  items: Array<{ description: string; amount: number }>;
  total: number;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>請求書</Text>
        <Text style={styles.row}>{companyName}</Text>
        <Text style={styles.row}>請求先: {clientName}</Text>
        <Text style={styles.row}>発行日: {issueDate}</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.col1}>摘要</Text>
            <Text style={styles.col2}>金額</Text>
          </View>
          {items.map((i, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.col1}>{i.description || ''}</Text>
              <Text style={styles.col2}>¥{i.amount.toLocaleString()}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.total}>合計: ¥{total.toLocaleString()}</Text>
      </Page>
    </Document>
  );
}

/** 請求書PDF生成 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const supabase = createServerClient();

    const { data: inv, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (error || !inv) {
      return NextResponse.json(
        { success: false, error: '請求書が見つかりません' },
        { status: 404 }
      );
    }

    const { data: itemsData } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('line_no');

    const items = (itemsData || []).map((r) => ({
      description: r.description || '',
      amount: Number(r.amount) || 0,
    }));

    const total =
      Number(inv.amount) ||
      items.reduce((s, i) => s + i.amount, 0);

    const { data: settingsRows } = await supabase
      .from('settings')
      .select('key, value');
    const settings: Record<string, string> = {};
    (settingsRows || []).forEach((r) => {
      if (r.key) settings[r.key] = r.value || '';
    });
    const companyName = settings.companyName || '（会社名）';
    const issueDate =
      inv.issue_date ||
      new Date().toISOString().slice(0, 10).replace(/-/g, '/');

    const pdfStream = await renderToStream(
      <InvoicePdfDoc
        companyName={companyName}
        clientName={inv.client_name}
        issueDate={issueDate}
        items={items}
        total={total}
      />
    );
    const buf = await streamToBuffer(pdfStream);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `invoices/請求書_${inv.client_name}_${dateStr}.pdf`;

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(fileName, buf, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="invoice_${invoiceId}.pdf"`,
        },
      });
    }

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    await supabase
      .from('invoices')
      .update({ pdf_file_id: uploadData.path, is_issued: true })
      .eq('id', invoiceId);

    return NextResponse.json({
      success: true,
      viewUrl: urlData?.publicUrl || '',
      fileId: uploadData.path,
      fileName: `請求書_${inv.client_name}_${dateStr}.pdf`,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
