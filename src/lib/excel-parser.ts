/**
 * Excelから見積明細を抽出（GAS extractQuoteDetailsFromSheet 相当）
 */
import * as XLSX from 'xlsx';

const KW = {
  name: ['品名', '項目', '名称', '明細'],
  qty: ['数量'],
  price: ['単価', '原価', '仕入'],
  amount: ['金額', '小計'],
};

function parseNum(val: unknown): number {
  if (val == null || val === '') return 0;
  const s = String(val).replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
  if (/[^0-9,.\-¥円\s]/.test(s)) return 0;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

export interface QuoteItem {
  name: string;
  qty: number;
  unit: string;
  price: number;
  amount: number;
}

export function extractQuoteDetailsFromBuffer(buffer: Buffer): QuoteItem[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let headerRow = -1;
  const col = { name: -1, qty: -1, price: -1, amount: -1 };

  for (let i = 0; i < Math.min(data.length, 30); i++) {
    const row = (data[i] || []).map((c) =>
      String(c ?? '')
        .replace(/\s+/g, '')
        .trim()
    );
    const hasName = row.some((v) =>
      KW.name.some((k) => v.indexOf(k) >= 0)
    );
    const hasPrice = row.some((v) =>
      [...KW.price, ...KW.amount].some((k) => v.indexOf(k) >= 0)
    );
    if (hasName && hasPrice) {
      headerRow = i;
      row.forEach((v, idx) => {
        if (col.name === -1 && KW.name.some((k) => v.indexOf(k) >= 0))
          col.name = idx;
        else if (col.qty === -1 && KW.qty.some((k) => v.indexOf(k) >= 0))
          col.qty = idx;
        else if (col.price === -1 && KW.price.some((k) => v.indexOf(k) >= 0))
          col.price = idx;
        else if (col.amount === -1 && KW.amount.some((k) => v.indexOf(k) >= 0))
          col.amount = idx;
      });
      break;
    }
  }

  if (headerRow < 0) return [];

  const out: QuoteItem[] = [];
  for (let j = headerRow + 1; j < data.length; j++) {
    const r = data[j] || [];
    const itemName =
      col.name >= 0 ? String(r[col.name] ?? '').trim() : '';
    if (['小計', '合計', '消費税'].some((k) => itemName.indexOf(k) >= 0)) break;
    if (!itemName) continue;

    let qty = col.qty >= 0 ? parseNum(r[col.qty]) : 1;
    let price = col.price >= 0 ? parseNum(r[col.price]) : 0;
    let amount = col.amount >= 0 ? parseNum(r[col.amount]) : 0;
    if (amount === 0 && price > 0) amount = price * (qty || 1);
    if (price === 0 && amount > 0) price = Math.floor(amount / (qty || 1));

    out.push({
      name: itemName,
      qty: qty || 1,
      unit: '式',
      price,
      amount,
    });
  }
  return out;
}
