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

function toReiwaDate(isoDate: string): string {
  const [y, m, d] = isoDate.replace(/-/g, '/').split('/');
  const reiwa = parseInt(y || '0', 10) - 2018;
  return `令和${reiwa}年${parseInt(m || '1', 10)}月${parseInt(d || '1', 10)}日`;
}

const DEFAULT_COMPANY = {
  name: '株式会社　AFECT',
  representative: '代表取締役　小松　裕介',
  tel: '092-519-7189',
  fax: '092-519-6307',
};

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  headerRight: { fontSize: 9, textAlign: 'right', width: 120 },
  bodyRow: { flexDirection: 'row', marginBottom: 12 },
  clientBlock: { flex: 1 },
  subjectBlock: { flex: 1 },
  clientName: { fontSize: 11, marginBottom: 4 },
  subjectText: { fontSize: 10 },
  termsTable: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  termsRow: { flexDirection: 'row', width: '100%', borderBottomWidth: 1, borderBottomColor: '#999', paddingVertical: 4 },
  termsLabel: { width: '25%', fontSize: 9 },
  termsValue: { width: '75%', fontSize: 9 },
  totalRow: { flexDirection: 'row', marginBottom: 16 },
  totalLabel: { fontSize: 12, fontWeight: 'bold', marginRight: 8 },
  totalAmount: { fontSize: 18, fontWeight: 'bold' },
  vendorBlock: { fontSize: 9, textAlign: 'right' },
  table: { marginTop: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#999', paddingVertical: 6, paddingHorizontal: 4 },
  tableHeader: { backgroundColor: '#eee', fontWeight: 'bold' },
  colKo: { width: '8%', textAlign: 'center' },
  colName: { width: '42%' },
  colQty: { width: '18%', textAlign: 'center' },
  colPrice: { width: '16%', textAlign: 'right' },
  colAmount: { width: '16%', textAlign: 'right' },
  summaryWrap: { alignItems: 'flex-end', marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#999' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', width: 140, marginBottom: 4 },
});

function EstimatePdfDoc({
  projectName,
  clientName,
  estimateNo,
  createDate,
  items,
  subtotal,
  tax,
  totalAmount,
  companyName,
  representative,
  tel,
  fax,
}: {
  projectName: string;
  clientName: string;
  estimateNo: string;
  createDate: string;
  items: Array<{ name: string; qty: number; unit: string; sellPrice: number; amount: number }>;
  subtotal: number;
  tax: number;
  totalAmount: number;
  companyName: string;
  representative: string;
  tel: string;
  fax: string;
}) {
  const reiwaDate = toReiwaDate(createDate);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>御見積書</Text>
          <View style={styles.headerRight}>
            <Text>見積No. {estimateNo}</Text>
            <Text>{reiwaDate}</Text>
            <Text>日付見積御照会の件</Text>
          </View>
        </View>
        <View style={styles.bodyRow}>
          <View style={styles.clientBlock}>
            <Text style={styles.clientName}>{clientName || '（宛先）'} 御中</Text>
          </View>
          <View style={styles.subjectBlock}>
            <Text style={styles.subjectText}>{projectName || '（件名）'}</Text>
            <Text style={styles.subjectText}>に対し、次の通り御見積致しますので何卒御用命下さいますよう御願い申し上げます。</Text>
          </View>
        </View>
        <View style={styles.termsTable}>
          <View style={[styles.termsRow, styles.tableHeader]}>
            <Text style={styles.termsLabel}>納　期</Text>
            <Text style={styles.termsValue}>ご指定日</Text>
          </View>
          <View style={styles.termsRow}>
            <Text style={styles.termsLabel}>受渡場所</Text>
            <Text style={styles.termsValue}>ご指定場所</Text>
          </View>
          <View style={styles.termsRow}>
            <Text style={styles.termsLabel}>御支払条件</Text>
            <Text style={styles.termsValue}>別途お打合せ</Text>
          </View>
          <View style={styles.termsRow}>
            <Text style={styles.termsLabel}>見積有効期限</Text>
            <Text style={styles.termsValue}>別途お打合せ</Text>
          </View>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>合計金額</Text>
          <Text style={styles.totalAmount}>¥{subtotal.toLocaleString()}</Text>
        </View>
        <View style={[styles.bodyRow, { justifyContent: 'flex-end' }]}>
          <View style={styles.vendorBlock}>
            <Text>{companyName}</Text>
            <Text>{representative}</Text>
            <Text>TEL: {tel}  FAX: {fax}</Text>
          </View>
        </View>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.colKo}>項</Text>
            <Text style={styles.colName}>品　名</Text>
            <Text style={styles.colQty}>数　量</Text>
            <Text style={styles.colPrice}>単　価</Text>
            <Text style={styles.colAmount}>合　計</Text>
          </View>
          {items.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.colKo} />
              <Text style={styles.colName}>{item.name || ''}</Text>
              <Text style={styles.colQty}>{item.qty}{item.unit || ''}</Text>
              <Text style={styles.colPrice}>¥{item.sellPrice.toLocaleString()}</Text>
              <Text style={styles.colAmount}>¥{item.amount.toLocaleString()}</Text>
            </View>
          ))}
        </View>
        <View style={styles.summaryWrap}>
          <View style={styles.summaryRow}>
            <Text>合　計</Text>
            <Text>¥{subtotal.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>消費税</Text>
            <Text>¥{tax.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>御請求合計</Text>
            <Text>¥{totalAmount.toLocaleString()}</Text>
          </View>
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

    const subtotal = items.reduce((s: number, i: { amount: number }) => s + i.amount, 0);
    const tax = Math.floor(subtotal * 0.1);
    const totalAmount = subtotal + tax;

    const supabase = createServerClient();
    const { data: settingsRows } = await supabase.from('settings').select('key, value');
    const settings: Record<string, string> = {};
    (settingsRows || []).forEach((r: { key?: string; value?: string }) => {
      if (r.key) settings[r.key] = r.value || '';
    });
    const companyName = settings.companyName || DEFAULT_COMPANY.name;
    const representative = settings.companyRepresentative || DEFAULT_COMPANY.representative;
    const tel = settings.companyTel || DEFAULT_COMPANY.tel;
    const fax = settings.companyFax || DEFAULT_COMPANY.fax;

    const createDate = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const estimateNo = 'PRV-' + Date.now().toString().slice(-6);

    const doc = (
      <EstimatePdfDoc
        projectName={(projectName || clientName || '見積').toString()}
        clientName={(clientName || '').toString()}
        estimateNo={estimateNo}
        createDate={createDate}
        items={items}
        subtotal={subtotal}
        tax={tax}
        totalAmount={totalAmount}
        companyName={companyName}
        representative={representative}
        tel={tel}
        fax={fax}
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
