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

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11 },
  title: { fontSize: 18, marginBottom: 8, fontWeight: 'bold' },
  subtitle: { fontSize: 11, marginBottom: 4 },
  company: { fontSize: 10, marginBottom: 16, color: '#333' },
  date: { fontSize: 10, marginBottom: 16 },
  totalLabel: { fontSize: 11, fontWeight: 'bold', marginTop: 16, marginBottom: 4 },
  totalAmount: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  table: { marginTop: 8 },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeader: { backgroundColor: '#eee', fontWeight: 'bold' },
  col1: { width: '8%', textAlign: 'center' },
  col2: { width: '40%' },
  col3: { width: '12%', textAlign: 'center' },
  col4: { width: '12%', textAlign: 'center' },
  col5: { width: '14%', textAlign: 'right' },
  col6: { width: '14%', textAlign: 'right' },
});

function EstimatePdfDoc({
  projectName,
  companyName,
  createDate,
  items,
  totalAmount,
}: {
  projectName: string;
  companyName: string;
  createDate: string;
  items: Array<{ name: string; qty: number; unit: string; sellPrice: number; amount: number }>;
  totalAmount: number;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>御見積書</Text>
        <Text style={styles.subtitle}>件名: {projectName || '（件名）'}</Text>
        <Text style={styles.company}>{companyName}</Text>
        <Text style={styles.date}>{createDate}</Text>
        <Text style={styles.totalLabel}>御見積合計金額</Text>
        <Text style={styles.totalAmount}>¥{totalAmount.toLocaleString()}</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.col1}>No</Text>
            <Text style={styles.col2}>品名</Text>
            <Text style={styles.col3}>数量</Text>
            <Text style={styles.col4}>単位</Text>
            <Text style={styles.col5}>単価</Text>
            <Text style={styles.col6}>金額</Text>
          </View>
          {items.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.col1}>{idx + 1}</Text>
              <Text style={styles.col2}>{item.name || ''}</Text>
              <Text style={styles.col3}>{item.qty}</Text>
              <Text style={styles.col4}>{item.unit}</Text>
              <Text style={styles.col5}>¥{item.sellPrice.toLocaleString()}</Text>
              <Text style={styles.col6}>¥{item.amount.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (data: Buffer) => chunks.push(data));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/** 見積書PDFプレビュー（保存せずにPDFを返す） */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectName, clientName, items: rawItems = [] } = body;

    const items = rawItems.map((i: { name?: string; qty?: number; unit?: string; costPrice?: number; profitRate?: number; applyMargin?: boolean }) => {
      const cost = Number(i.costPrice) || 0;
      const qty = Number(i.qty) || 1;
      const rate = (i.profitRate != null && i.applyMargin !== false) ? 1 + (i.profitRate / 100) : 1;
      const sellPrice = Math.floor(cost * rate);
      return {
        name: i.name || '',
        qty,
        unit: i.unit || '式',
        sellPrice,
        amount: sellPrice * qty,
      };
    }).filter((i: { name: string }) => (i.name || '').trim());

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: '明細を1件以上入力してください' }, { status: 400 });
    }

    const totalAmount = items.reduce((s: number, i: { amount: number }) => s + i.amount, 0);
    const supabase = createServerClient();
    const { data: settingsRows } = await supabase.from('settings').select('key, value');
    const settings: Record<string, string> = {};
    (settingsRows || []).forEach((r: { key?: string; value?: string }) => {
      if (r.key) settings[r.key] = r.value || '';
    });
    const companyName = settings.companyName || '（会社名を設定）';
    const createDate = new Date().toISOString().slice(0, 10).replace(/-/g, '/');

    const doc = (
      <EstimatePdfDoc
        projectName={(projectName || clientName || '見積').toString()}
        companyName={companyName}
        createDate={createDate}
        items={items}
        totalAmount={totalAmount}
      />
    );
    const pdfStream = await renderToStream(doc);
    const buffer = await streamToBuffer(pdfStream);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="estimate_preview.pdf"',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
