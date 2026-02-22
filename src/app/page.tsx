'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const API = '/api';

async function apiGet<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(API + path, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(API + path, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

interface ContractorQuote {
  quoteId: string;
  importedAt: string;
  fileName: string;
  subject: string;
  contractorName: string;
  totalCost: number;
}

interface QuoteItem {
  name: string;
  qty: number;
  unit: string;
  costPrice: number;
  amount: number;
}

/** 利益率・マージン適用を付与した明細（編集用） */
interface EditableQuoteItem extends QuoteItem {
  profitRate: number;
  applyMargin: boolean;
}

interface QuoteDetail {
  success: boolean;
  quoteId: string;
  header: { contractorName: string; subject: string; fileName: string; importedAt: string; totalCost: number };
  items: QuoteItem[];
}

const DEFAULT_PROFIT_RATE = 10;

/** 見積書HTMLを生成（キャプチャ用） */
function buildEstimateDocHtml(options: {
  calcItems: Array<{ name: string; qty: number; unit: string; cost: number; sellPrice: number; amount: number }>;
  clientName: string;
  settings: Record<string, string>;
}): string {
  const { calcItems, clientName, settings } = options;
  const companyName = settings.companyName || '株式会社　AFECT';
  const representative = settings.companyRepresentative || '代表取締役　小松　裕介';
  const companyTel = settings.companyTel || '092-519-7189';
  const companyFax = settings.companyFax || '092-519-6307';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const [y, m, d] = dateStr.split('/');
  const reiwa = parseInt(y || '0', 10) - 2018;
  const reiwaDate = `令和${reiwa}年${parseInt(m || '1', 10)}月${parseInt(d || '1', 10)}日`;
  const subtotal = calcItems.reduce((s, i) => s + i.amount, 0);
  const tax = Math.floor(subtotal * 0.1);
  const totalWithTax = subtotal + tax;

  return '<div style="font-family:sans-serif; font-size:12px; padding:16px; background:#fff;">' +
    '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">' +
    '<h2 style="margin:0; flex:1; text-align:center; font-size:18px;">御見積書</h2>' +
    '<div style="font-size:10px; text-align:right; width:100px;">見積No. PRV<br>' + reiwaDate + '<br>日付見積御照会の件</div></div>' +
    '<div style="display:flex; margin-bottom:12px;">' +
    '<div style="flex:1;"><strong>' + (clientName || '（宛先）') + ' 御中</strong></div>' +
    '<div style="flex:1;">' + (clientName || '（件名）') + ' に対し、次の通り御見積致しますので何卒御用命下さいますよう御願い申し上げます。</div></div>' +
    '<table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:12px;">' +
    '<tr style="border-bottom:1px solid #999;"><td style="width:20%; padding:4px;">納　期</td><td style="padding:4px;">ご指定日</td></tr>' +
    '<tr style="border-bottom:1px solid #999;"><td style="padding:4px;">受渡場所</td><td style="padding:4px;">ご指定場所</td></tr>' +
    '<tr style="border-bottom:1px solid #999;"><td style="padding:4px;">御支払条件</td><td style="padding:4px;">別途お打合せ</td></tr>' +
    '<tr style="border-bottom:1px solid #999;"><td style="padding:4px;">見積有効期限</td><td style="padding:4px;">別途お打合せ</td></tr></table>' +
    '<p style="margin:0 0 12px 0;"><strong>合計金額</strong> <span style="font-size:16px; font-weight:bold;">¥' + subtotal.toLocaleString() + '</span></p>' +
    '<div style="text-align:right; font-size:10px; margin-bottom:12px;">' + companyName + '<br>' + representative + '<br>TEL: ' + companyTel + '  FAX: ' + companyFax + '</div>' +
    '<table style="width:100%; border-collapse:collapse; font-size:11px">' +
    '<tr style="background:#eee"><th style="border:1px solid #999; padding:6px; width:8%">項</th><th style="border:1px solid #999; padding:6px;">品　名</th><th style="border:1px solid #999; padding:6px; width:15%">数　量</th><th style="border:1px solid #999; padding:6px; width:15%; text-align:right">単　価</th><th style="border:1px solid #999; padding:6px; width:15%; text-align:right">合　計</th></tr>' +
    calcItems.map((i) =>
      '<tr><td style="border:1px solid #999; padding:6px"></td><td style="border:1px solid #999; padding:6px">' + i.name + '</td><td style="border:1px solid #999; padding:6px">' + i.qty + (i.unit || '') + '</td><td style="border:1px solid #999; padding:6px; text-align:right">¥' + i.sellPrice.toLocaleString() + '</td><td style="border:1px solid #999; padding:6px; text-align:right">¥' + i.amount.toLocaleString() + '</td></tr>'
    ).join('') + '</table>' +
    '<div style="text-align:right; margin-top:12px; padding-top:8px; border-top:1px solid #999;">' +
    '<div style="display:flex; justify-content:flex-end; gap:24px;"><span>合　計</span><span style="width:80px; text-align:right">¥' + subtotal.toLocaleString() + '</span></div>' +
    '<div style="display:flex; justify-content:flex-end; gap:24px;"><span>消費税</span><span style="width:80px; text-align:right">¥' + tax.toLocaleString() + '</span></div>' +
    '<div style="display:flex; justify-content:flex-end; gap:24px;"><span>御請求合計</span><span style="width:80px; text-align:right">¥' + totalWithTax.toLocaleString() + '</span></div></div></div>';
}

/** HTML要素をキャプチャしてPDF Blobを生成（クライアント専用） */
async function captureElementToPdfBlob(element: HTMLElement): Promise<Blob> {
  const target = element.firstElementChild as HTMLElement || element;
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');
  const canvas = await html2canvas(target, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });
  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const imgWidth = pageWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 10;
  pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
  heightLeft -= pageHeight - 20;
  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - 20;
  }
  return pdf.output('blob');
}

function toEditableItem(i: QuoteItem): EditableQuoteItem {
  return {
    ...i,
    profitRate: DEFAULT_PROFIT_RATE,
    applyMargin: true,
  };
}

function ContractorQuoteDetailView({
  quoteId,
  clientList,
  onBack,
  onCreateEstimate,
  onDeleteQuote,
  showToast,
}: {
  quoteId: string;
  clientList: string[];
  onBack: () => void;
  onCreateEstimate: (items: EditableQuoteItem[], header: QuoteDetail['header'] | null | undefined) => void;
  onDeleteQuote: () => void;
  showToast: (msg: string) => void;
}) {
  const [detail, setDetail] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [costMode, setCostMode] = useState(false);
  const [editableItems, setEditableItems] = useState<EditableQuoteItem[]>([]);

  useEffect(() => {
    apiGet<QuoteDetail>(`/contractor-quotes/${quoteId}`)
      .then((d) => {
        setDetail(d);
        setEditableItems((d?.items ?? []).map(toEditableItem));
      })
      .catch(() => {
        setDetail(null);
        setEditableItems([]);
      })
      .finally(() => setLoading(false));
  }, [quoteId]);

  const header = detail?.header;
  const totalCost = costMode
    ? editableItems.reduce((s, i) => s + (Number(i.amount) || Number(i.costPrice) * (Number(i.qty) || 1)), 0)
    : editableItems.reduce((s, i) => {
        const amt = Number(i.amount) || Number(i.costPrice) * (Number(i.qty) || 1);
        return s + (i.applyMargin ? Math.floor(amt * (1 + i.profitRate / 100)) : amt);
      }, 0);

  const updateItem = (idx: number, upd: Partial<EditableQuoteItem>) => {
    setEditableItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...upd } : it)));
  };

  const deleteItem = (idx: number) => {
    setEditableItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    setEditableItems((prev) => [...prev, toEditableItem({ name: '', qty: 1, unit: '式', costPrice: 0, amount: 0 })]);
  };

  if (loading) {
    return (
      <div className="quote-detail-view">
        <div className="quote-detail-nav">
          <button type="button" className="nav-back" onClick={onBack}>← 戻る</button>
        </div>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中…</div>
      </div>
    );
  }

  return (
    <div className="quote-detail-view">
      <div className="quote-detail-nav">
        <button type="button" className="nav-back" onClick={onBack}>← 戻る</button>
        <div className="nav-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onCreateEstimate(editableItems, header ?? null)}>編集</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCostMode((c) => !c)}>
            {costMode ? '売上モード' : '原価モード'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
            onClick={async () => {
              if (!confirm('この取り込みを一覧から削除しますか？')) return;
              try {
                const res = await fetch(`/api/contractor-quotes/${encodeURIComponent(quoteId)}`, { method: 'DELETE' });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.success) {
                  showToast('削除しました');
                  onBack();
                  onDeleteQuote();
                } else {
                  showToast(data.error || '削除に失敗しました');
                }
              } catch (e) {
                showToast('削除に失敗しました: ' + String((e as Error).message));
              }
            }}
          >
            取り込みを削除
          </button>
        </div>
      </div>
      <div className="quote-detail-header">
        <div className="quote-title">
          {(header?.subject || header?.fileName || quoteId || '業者見積') + (header?.contractorName ? ' ' + header.contractorName : '')}_処理済み
        </div>
        <div className="quote-total-label">合計金額</div>
        <div className="quote-total-amount">¥{totalCost.toLocaleString()}</div>
      </div>
      <div className="quote-detail-items">
        {editableItems.length === 0 ? (
          <p style={{ padding: 24, color: 'var(--text-muted)', fontSize: '0.875rem' }}>明細がありません。下の「項目を追加」で追加できます。</p>
        ) : (
          editableItems.map((i, idx) => {
            const cost = Number(i.costPrice) || 0;
            const qty = Number(i.qty) || 1;
            const amt = Number(i.amount) || cost * qty;
            const unit = i.unit || '式';
            const displayAmt = costMode ? amt : (i.applyMargin ? Math.floor(amt * (1 + i.profitRate / 100)) : amt);
            const isNew = !(i.name || '').trim();
            return (
              <div key={idx} className="quote-detail-item">
                <div className="quote-detail-item-left">
                  {isNew ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        type="text"
                        placeholder="品名"
                        value={i.name}
                        onChange={(e) => updateItem(idx, { name: e.target.value })}
                        style={{ padding: 8, fontSize: '0.875rem' }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="number"
                          placeholder="数量"
                          value={qty}
                          onChange={(e) => updateItem(idx, { qty: parseFloat(e.target.value) || 1 })}
                          style={{ width: 70, padding: 8, fontSize: '0.875rem' }}
                        />
                        <input
                          type="number"
                          placeholder="単価"
                          value={cost || ''}
                          onChange={(e) => updateItem(idx, { costPrice: parseFloat(e.target.value) || 0, amount: 0 })}
                          style={{ width: 100, padding: 8, fontSize: '0.875rem' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="quote-detail-item-name">{i.name || '（品名未入力）'}</div>
                      <div className="quote-detail-item-meta">x{qty}{unit} @{cost.toLocaleString()}</div>
                    </>
                  )}
                  <div className="quote-detail-item-rate" style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>利益率:</span>
                    <button
                      type="button"
                      className={`quote-detail-profit-btn ${i.profitRate === 10 ? 'selected' : ''}`}
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={() => updateItem(idx, { profitRate: 10 })}
                    >+10%</button>
                    <button
                      type="button"
                      className={`quote-detail-profit-btn ${i.profitRate === 20 ? 'selected' : ''}`}
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={() => updateItem(idx, { profitRate: 20 })}
                    >+20%</button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="quote-detail-item-amount">¥{displayAmt.toLocaleString()}</div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ minHeight: 32, padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => deleteItem(idx)}
                    title="削除"
                  >削除</button>
                </div>
              </div>
            );
          })
        )}
        <div style={{ padding: '12px 0' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addItem} style={{ width: '100%' }}>
            ＋ 項目を追加
          </button>
        </div>
      </div>
      <div className="quote-detail-profit">
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onCreateEstimate(editableItems, header ?? null)}
            disabled={editableItems.length === 0}
          >この内容で見積書を作成</button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<'estimate' | 'invoice'>('estimate');
  const [toast, setToast] = useState('');
  const [clientList, setClientList] = useState<string[]>([]);
  const [currentEstimateId, setCurrentEstimateId] = useState<number | null>(null);
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);
  const [currentEstimateItems, setCurrentEstimateItems] = useState<Array<{ name: string; qty: number; unit: string; costPrice: number; profitRate?: number; applyMargin: boolean }>>([]);
  const [previewQuoteItems, setPreviewQuoteItems] = useState<QuoteItem[]>([]);
  const [previewQuoteHeader, setPreviewQuoteHeader] = useState<QuoteDetail['header'] | null>(null);
  const [previewSettings, setPreviewSettings] = useState<Record<string, string>>({});
  const [selectedQuoteIdForDetail, setSelectedQuoteIdForDetail] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const loadClients = useCallback(async () => {
    try {
      const list = await apiGet<string[]>('/clients');
      setClientList(list || []);
    } catch {}
  }, []);

  const loadImportedQuoteList = useCallback(async (done?: () => void) => {
    const listEl = document.getElementById('importedQuoteList');
    if (!listEl) return;
    try {
      const result = await apiGet<{ list: ContractorQuote[]; error: string | null }>(`/contractor-quotes?_t=${Date.now()}`);
      const list = result?.list ?? [];
      const err = result?.error ?? null;
      if (err) {
        listEl.innerHTML = `<p style="font-size:0.875rem; color: var(--text-muted);">${err}</p>`;
      } else if (!list.length) {
        listEl.innerHTML = '<p style="font-size:0.875rem; color: var(--text-muted);">まだ取り込んだ業者見積がありません。上で「Excelファイルを選択して取り込む」を押してExcelをアップロードすると、ここに一覧と各見積の「見積書を作成」ボタンが表示されます。</p>';
      } else {
        listEl.innerHTML = list.map((q) => {
          const label = (q.subject || q.fileName || q.quoteId || '').toString();
          const contractor = (q.contractorName || '').toString();
          const total = q.totalCost != null ? '¥' + Number(q.totalCost).toLocaleString() : '';
          const dateStr = (q.importedAt != null && q.importedAt !== '') ? String(q.importedAt).replace(/T.*/, '') : '';
          const sub = (contractor ? '業者: ' + contractor + '　' : '') + total + (dateStr ? ' · ' + dateStr : '');
          return `<div class="quote-item" data-quote-id="${q.quoteId || ''}" style="border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
              <div style="flex:1; min-width:0;">
                <strong>${label || '（件名なし）'}</strong><br>
                <span style="font-size:0.75rem; color: var(--text-muted)">${sub}</span><br>
                <a href="#" role="button" class="btn-delete-quote" data-quote-id="${q.quoteId || ''}" title="この取り込みを一覧から削除" style="font-size:0.7rem; color: var(--text-muted); text-decoration:underline; margin-top:4px; display:inline-block;">取り込みを削除</a>
              </div>
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <button type="button" class="btn btn-secondary btn-sm btn-show-detail" data-quote-id="${q.quoteId || ''}">明細を見る</button>
                <button type="button" class="btn btn-primary btn-sm btn-create-estimate" data-quote-id="${q.quoteId || ''}">見積書を作成</button>
              </div>
            </div>
          </div>`;
        }).join('');
        bindQuoteButtons(listEl, showToast, loadImportedQuoteList);
      }
      done?.();
    } catch (e) {
      listEl.innerHTML = '<p style="font-size:0.875rem; color: #c00;">取得できませんでした: ' + String((e as Error).message) + '</p>';
      done?.();
    }
  }, []);

  const bindQuoteButtons = (container: HTMLElement, toast: (msg: string) => void, reload: () => void) => {
    container.querySelectorAll('.btn-show-detail, .btn-create-estimate').forEach((btn) => {
      btn.addEventListener('click', function (this: HTMLElement) {
        const qid = this.getAttribute('data-quote-id');
        if (qid) setSelectedQuoteIdForDetail(qid);
      });
    });
    container.querySelectorAll('.btn-delete-quote').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const qid = (e.currentTarget as HTMLElement).getAttribute('data-quote-id');
        if (!qid || !confirm('この取り込みファイルを削除しますか？')) return;
        try {
          const res = await fetch(`/api/contractor-quotes/${encodeURIComponent(qid)}`, { method: 'DELETE' });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.success) {
            toast('削除しました');
            reload();
          } else {
            toast(data.error || `削除に失敗しました (${res.status})`);
          }
        } catch (e) {
          toast('削除に失敗しました: ' + String((e as Error).message));
        }
      });
    });
  };

  const openEstimatePreviewWithItems = async (items: EditableQuoteItem[], header: QuoteDetail['header'] | null | undefined) => {
    const card = document.getElementById('cardEstimateFromQuote');
    if (card) {
      card.classList.remove('hidden');
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setPreviewQuoteHeader(header ?? null);
    setPreviewQuoteItems(items);
    const settings = await apiGet<Record<string, string>>('/settings').catch(() => ({}));
    setPreviewSettings(settings || {});
    renderEstimatePreview(items, header ?? null, settings || {});
  };

  const openEstimatePreview = async (quoteId: string, initialProfitRate?: number) => {
    const card = document.getElementById('cardEstimateFromQuote');
    if (card) {
      card.classList.remove('hidden');
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const els = {
      previewClientName: document.getElementById('previewClientName') as HTMLInputElement,
      previewProfitRate: document.getElementById('previewProfitRate') as HTMLInputElement,
      previewContractorQuoteHeader: document.getElementById('previewContractorQuoteHeader'),
      previewContractorQuoteItems: document.getElementById('previewContractorQuoteItems'),
      previewItemsTable: document.getElementById('previewItemsTable'),
      estimatePreviewDoc: document.getElementById('estimatePreviewDoc'),
    };
    if (els.previewClientName) els.previewClientName.value = '';
    if (els.previewProfitRate) els.previewProfitRate.value = String(initialProfitRate ?? 15);
    if (els.previewContractorQuoteHeader) els.previewContractorQuoteHeader.innerHTML = '<span style="color: var(--text-muted)">読み込み中…</span>';
    if (els.previewContractorQuoteItems) els.previewContractorQuoteItems!.innerHTML = '';
    if (els.previewItemsTable) els.previewItemsTable.innerHTML = '<p style="color: var(--text-muted)">読み込み中…</p>';
    if (els.estimatePreviewDoc) els.estimatePreviewDoc.innerHTML = '';

    try {
      const res = await apiGet<QuoteDetail>(`/contractor-quotes/${quoteId}`);
      setPreviewQuoteHeader(res?.header ?? null);
      setPreviewQuoteItems((res?.items ?? []) as QuoteItem[]);
      const settings = await apiGet<Record<string, string>>('/settings').catch(() => ({}));
      setPreviewSettings(settings || {});
      renderEstimatePreview((res?.items ?? []) as QuoteItem[], res?.header ?? null, settings || {});
    } catch (e) {
      setPreviewQuoteHeader(null);
      setPreviewQuoteItems([]);
      setPreviewSettings({});
      const errEl = document.getElementById('previewContractorQuoteHeader');
      if (errEl) errEl.innerHTML = '<span style="color:#c00">読み込み失敗: ' + String((e as Error).message) + '</span>';
      const itemsEl = document.getElementById('previewContractorQuoteItems');
      if (itemsEl) itemsEl.innerHTML = '<p style="color:#c00">API接続を確認してください。環境変数（Supabase）が正しく設定されているか確認してください。</p>';
      renderEstimatePreview([], null, {});
    }
  };

  const renderEstimatePreview = (
    items: QuoteItem[],
    header: QuoteDetail['header'] | null,
    settings: Record<string, string>
  ) => {
    const headerEl = document.getElementById('previewContractorQuoteHeader');
    const itemsEl = document.getElementById('previewContractorQuoteItems');
    const tableEl = document.getElementById('previewItemsTable');
    const totalEl = document.getElementById('previewTotal');
    const docEl = document.getElementById('estimatePreviewDoc');
    const rateEl = document.getElementById('previewProfitRate') as HTMLInputElement;
    const clientEl = document.getElementById('previewClientName') as HTMLInputElement;

    const rate = parseFloat(rateEl?.value || '15') || 15;
    const clientName = (clientEl?.value || '').trim();

    if (headerEl) {
      if (header) {
        const parts = [];
        if (header.contractorName) parts.push('業者: ' + header.contractorName);
        if (header.subject) parts.push('件名: ' + header.subject);
        if (header.fileName) parts.push('ファイル: ' + header.fileName);
        if (header.importedAt) parts.push('取込日: ' + String(header.importedAt).replace(/T.*/, ''));
        if (header.totalCost != null && header.totalCost > 0) parts.push('合計原価: ¥' + Number(header.totalCost).toLocaleString());
        headerEl.innerHTML = parts.join('　｜　') || '（業者見積情報なし）';
      } else {
        headerEl.innerHTML = '（業者見積情報なし）';
      }
    }

    if (itemsEl) {
      if (items.length > 0) {
        itemsEl.innerHTML = '<table style="width:100%; border-collapse:collapse; font-size:0.8rem">' +
          '<tr style="background:var(--border)"><th style="padding:4px 6px; text-align:left">品名</th><th style="padding:4px 6px">数量</th><th style="padding:4px 6px">単位</th><th style="padding:4px 6px; text-align:right">原価単価</th><th style="padding:4px 6px; text-align:right">金額</th></tr>' +
          items.map((i) => {
            const cost = Number(i.costPrice) || 0;
            const qty = Number(i.qty) || 1;
            const amt = Number(i.amount) || cost * qty;
            return `<tr><td style="padding:4px 6px; border-bottom:1px solid var(--border)">${i.name || ''}</td><td style="padding:4px 6px; border-bottom:1px solid var(--border)">${qty}</td><td style="padding:4px 6px; border-bottom:1px solid var(--border)">${i.unit || '式'}</td><td style="padding:4px 6px; border-bottom:1px solid var(--border); text-align:right">¥${cost.toLocaleString()}</td><td style="padding:4px 6px; border-bottom:1px solid var(--border); text-align:right">¥${amt.toLocaleString()}</td></tr>`;
          }).join('') + '</table>';
      } else {
        itemsEl.innerHTML = '<p style="color: var(--text-muted); font-size:0.8rem">明細がありません</p>';
      }
    }

    const calcItems = items.map((i) => {
      const cost = Number(i.costPrice) || 0;
      const qty = Number(i.qty) || 1;
      const itemRate = (i as EditableQuoteItem).profitRate != null ? (i as EditableQuoteItem).profitRate : rate;
      const applyMargin = (i as EditableQuoteItem).applyMargin !== false;
      const sellPrice = applyMargin ? Math.floor(cost * (1 + itemRate / 100)) : cost;
      const amount = sellPrice * qty;
      return { name: i.name || '', qty, unit: i.unit || '式', cost, sellPrice, amount };
    });
    const total = calcItems.reduce((s, i) => s + i.amount, 0);

    if (tableEl) {
      tableEl.innerHTML = items.length > 0
        ? '<table style="width:100%; border-collapse:collapse; font-size:0.8rem">' +
          '<tr style="background:var(--border)"><th style="padding:6px; text-align:left">品名</th><th style="padding:6px">数量</th><th style="padding:6px">単位</th><th style="padding:6px; text-align:right">原価</th><th style="padding:6px; text-align:right">売上単価</th><th style="padding:6px; text-align:right">金額</th></tr>' +
          calcItems.map((i) =>
            `<tr><td style="padding:6px; border-bottom:1px solid var(--border)">${i.name}</td><td style="padding:6px; border-bottom:1px solid var(--border)">${i.qty}</td><td style="padding:6px; border-bottom:1px solid var(--border)">${i.unit}</td><td style="padding:6px; border-bottom:1px solid var(--border); text-align:right">¥${i.cost.toLocaleString()}</td><td style="padding:6px; border-bottom:1px solid var(--border); text-align:right">¥${i.sellPrice.toLocaleString()}</td><td style="padding:6px; border-bottom:1px solid var(--border); text-align:right">¥${i.amount.toLocaleString()}</td></tr>`
          ).join('') + '</table>'
        : '<p style="color: var(--text-muted)">明細がありません</p>';
    }
    if (totalEl) totalEl.textContent = '¥' + total.toLocaleString();

    const companyName = settings.companyName || '株式会社　AFECT';
    const representative = settings.companyRepresentative || '代表取締役　小松　裕介';
    const companyTel = settings.companyTel || '092-519-7189';
    const companyFax = settings.companyFax || '092-519-6307';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const [y, m, d] = dateStr.split('/');
    const reiwa = parseInt(y || '0', 10) - 2018;
    const reiwaDate = `令和${reiwa}年${parseInt(m || '1', 10)}月${parseInt(d || '1', 10)}日`;
    const subtotal = total;
    const tax = Math.floor(subtotal * 0.1);
    const totalWithTax = subtotal + tax;

    if (docEl) {
      docEl.innerHTML = '<div style="font-family:sans-serif; font-size:12px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">' +
        '<h2 style="margin:0; flex:1; text-align:center; font-size:18px;">御見積書</h2>' +
        '<div style="font-size:10px; text-align:right; width:100px;">見積No. PRV<br>' + reiwaDate + '<br>日付見積御照会の件</div></div>' +
        '<div style="display:flex; margin-bottom:12px;">' +
        '<div style="flex:1;"><strong>' + (clientName || '（宛先）') + ' 御中</strong></div>' +
        '<div style="flex:1;">' + (clientName || '（件名）') + ' に対し、次の通り御見積致しますので何卒御用命下さいますよう御願い申し上げます。</div></div>' +
        '<table style="width:100%; border-collapse:collapse; font-size:10px; margin-bottom:12px;">' +
        '<tr style="border-bottom:1px solid #999;"><td style="width:20%; padding:4px;">納　期</td><td style="padding:4px;">ご指定日</td></tr>' +
        '<tr style="border-bottom:1px solid #999;"><td style="padding:4px;">受渡場所</td><td style="padding:4px;">ご指定場所</td></tr>' +
        '<tr style="border-bottom:1px solid #999;"><td style="padding:4px;">御支払条件</td><td style="padding:4px;">別途お打合せ</td></tr>' +
        '<tr style="border-bottom:1px solid #999;"><td style="padding:4px;">見積有効期限</td><td style="padding:4px;">別途お打合せ</td></tr></table>' +
        '<p style="margin:0 0 12px 0;"><strong>合計金額</strong> <span style="font-size:16px; font-weight:bold;">¥' + subtotal.toLocaleString() + '</span></p>' +
        '<div style="text-align:right; font-size:10px; margin-bottom:12px;">' + companyName + '<br>' + representative + '<br>TEL: ' + companyTel + '  FAX: ' + companyFax + '</div>' +
        '<table style="width:100%; border-collapse:collapse; font-size:11px">' +
        '<tr style="background:#eee"><th style="border:1px solid #999; padding:6px; width:8%">項</th><th style="border:1px solid #999; padding:6px;">品　名</th><th style="border:1px solid #999; padding:6px; width:15%">数　量</th><th style="border:1px solid #999; padding:6px; width:15%; text-align:right">単　価</th><th style="border:1px solid #999; padding:6px; width:15%; text-align:right">合　計</th></tr>' +
        calcItems.map((i) =>
          '<tr><td style="border:1px solid #999; padding:6px"></td><td style="border:1px solid #999; padding:6px">' + i.name + '</td><td style="border:1px solid #999; padding:6px">' + i.qty + (i.unit || '') + '</td><td style="border:1px solid #999; padding:6px; text-align:right">¥' + i.sellPrice.toLocaleString() + '</td><td style="border:1px solid #999; padding:6px; text-align:right">¥' + i.amount.toLocaleString() + '</td></tr>'
        ).join('') + '</table>' +
        '<div style="text-align:right; margin-top:12px; padding-top:8px; border-top:1px solid #999;">' +
        '<div style="display:flex; justify-content:flex-end; gap:24px;"><span>合　計</span><span style="width:80px; text-align:right">¥' + subtotal.toLocaleString() + '</span></div>' +
        '<div style="display:flex; justify-content:flex-end; gap:24px;"><span>消費税</span><span style="width:80px; text-align:right">¥' + tax.toLocaleString() + '</span></div>' +
        '<div style="display:flex; justify-content:flex-end; gap:24px;"><span>御請求合計</span><span style="width:80px; text-align:right">¥' + totalWithTax.toLocaleString() + '</span></div></div></div>';
    }
  };

  useEffect(() => {
    loadClients();
    loadImportedQuoteList();
  }, [loadClients, loadImportedQuoteList]);

  useEffect(() => {
    const rateEl = document.getElementById('previewProfitRate');
    const clientEl = document.getElementById('previewClientName');
    const handler = () => renderEstimatePreview(previewQuoteItems, previewQuoteHeader, previewSettings);
    rateEl?.addEventListener('input', handler);
    clientEl?.addEventListener('input', handler);
    return () => {
      rateEl?.removeEventListener('input', handler);
      clientEl?.removeEventListener('input', handler);
    };
  }, [previewQuoteItems, previewQuoteHeader, previewSettings]);

  return (
    <>
      {selectedQuoteIdForDetail && (
        <ContractorQuoteDetailView
          quoteId={selectedQuoteIdForDetail}
          clientList={clientList}
          onBack={() => setSelectedQuoteIdForDetail(null)}
          onCreateEstimate={(items, header) => {
            const valid = items.filter((i) => (i.name || '').trim());
            if (valid.length === 0) {
              showToast('品名が入力された項目が1件以上必要です');
              return;
            }
            setSelectedQuoteIdForDetail(null);
            openEstimatePreviewWithItems(valid, header);
          }}
          onDeleteQuote={loadImportedQuoteList}
          showToast={showToast}
        />
      )}
      <div className="header">
        <h1>見積・請求</h1>
      </div>
      <div className="tabs">
        <button
          type="button"
          className={tab === 'estimate' ? 'active' : ''}
          onClick={() => { setTab('estimate'); loadImportedQuoteList(); }}
        >
          見積
        </button>
        <button
          type="button"
          className={tab === 'invoice' ? 'active' : ''}
          onClick={() => setTab('invoice')}
        >
          請求
        </button>
      </div>
      <div className="container">
        {tab === 'estimate' && (
          <div id="panelEstimate">
            <div className="card">
              <h2>1. 業者見積の取り込み</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Excelファイルをアップロードして取り込みます。1行目に「品名」「数量」「単価」「金額」などの列名がある形式に対応しています。
              </p>
              <FileUpload
                onSuccess={(itemCount) => {
                  showToast((itemCount ?? 0) > 0 ? '取り込みました（' + (itemCount ?? 0) + '項目）' : '取り込みました（明細0件の場合はExcel形式を確認）');
                  loadImportedQuoteList();
                }}
                onError={(e) => showToast('取込失敗: ' + e)}
              />
            </div>
            <div className="card" id="cardImportedQuotes">
              <h2>2. 取り込んだ業者見積を表示 → 利益をのせて自社見積を作成</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                ① 上でExcelをアップロードして取り込む → ② 下の一覧に表示された各見積の「見積書を作成」を押す → ③ 内容を確認し、利益率を設定して発行
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => loadImportedQuoteList()}
              >
                一覧を更新
              </button>
              <div id="importedQuoteList" style={{ marginTop: 12 }} />
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-primary" id="btnNewEstimateFromScratch">
                  手入力で見積書を作成
                </button>
                <NewEstimateForm
                  clientList={clientList}
                  onCreated={(id) => {
                    setCurrentEstimateId(id);
                    showToast('見積を作成しました');
                  }}
                  onError={(e) => showToast(e)}
                />
              </div>
            </div>
            <EstimateFromQuoteCard
              clientList={clientList}
              previewQuoteItems={previewQuoteItems}
              onRenderPreview={() => renderEstimatePreview(previewQuoteItems, previewQuoteHeader, previewSettings)}
              onIssueSuccess={() => {
                showToast('発行しました');
                loadImportedQuoteList();
              }}
              onError={(e) => showToast(e)}
            />
            <EstimateEditCard
              currentEstimateId={currentEstimateId}
              currentEstimateItems={currentEstimateItems}
              setCurrentEstimateItems={setCurrentEstimateItems}
              onClose={() => setCurrentEstimateId(null)}
              onSaved={() => showToast('保存しました')}
              onPdfCreated={() => showToast('PDFを作成しました')}
              onError={(e) => showToast(e)}
            />
            <RecentEstimates
              onOpen={(id) => {
                setCurrentEstimateId(id);
                setCurrentEstimateId(id);
              }}
            />
          </div>
        )}
        {tab === 'invoice' && (
          <InvoicePanel
            currentInvoiceId={currentInvoiceId}
            setCurrentInvoiceId={setCurrentInvoiceId}
            showToast={showToast}
          />
        )}
      </div>
      <datalist id="clientList">
        {clientList.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {toast && (
        <div className="toast" id="toast">
          {toast}
        </div>
      )}
    </>
  );
}

function FileUpload({
  onSuccess,
  onError,
}: {
  onSuccess: (itemCount?: number) => void;
  onError: (e: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await apiPostFormData<{ success: boolean; itemCount?: number }>('/contractor-quotes/import', fd);
      onSuccess(r?.itemCount ?? 0);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFile}
        disabled={loading}
        ref={inputRef}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? '取り込み中…' : 'Excelファイルを選択して取り込む'}
      </button>
    </div>
  );
}

function NewEstimateForm({
  clientList,
  onCreated,
  onError,
}: {
  clientList: string[];
  onCreated: (id: number) => void;
  onError: (e: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [clientName, setClientName] = useState('');
  const [rate, setRate] = useState(15);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const btn = document.getElementById('btnNewEstimateFromScratch');
    const handler = () => setVisible((v) => !v);
    btn?.addEventListener('click', handler);
    return () => btn?.removeEventListener('click', handler);
  }, []);

  const submit = async () => {
    if (!clientName.trim()) {
      onError('クライアント名を入力してください');
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost<{ estimateId: number }>('/estimates', {
        projectName: clientName,
        clientName,
        baseItems: [],
        defaultRate: rate,
        forceNew: true,
      });
      onCreated(res.estimateId);
      setVisible(false);
      setClientName('');
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <label style={{ fontSize: '0.875rem' }}>クライアント名</label>
      <input
        type="text"
        placeholder="株式会社〇〇"
        list="clientList"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
        style={{ width: '100%', maxWidth: 280, marginTop: 4 }}
      />
      <label style={{ fontSize: '0.875rem', marginTop: 8, display: 'block' }}>利益率（%）</label>
      <input
        type="number"
        value={rate}
        onChange={(e) => setRate(parseFloat(e.target.value) || 15)}
        min={0}
        max={100}
        style={{ width: 80, marginTop: 4 }}
      />
      <button
        type="button"
        className="btn btn-primary btn-sm"
        style={{ marginTop: 12 }}
        onClick={submit}
        disabled={loading}
      >
        この内容で見積書を作成
      </button>
    </div>
  );
}

function EstimateFromQuoteCard({
  clientList,
  previewQuoteItems,
  onRenderPreview,
  onIssueSuccess,
  onError,
}: {
  clientList: string[];
  previewQuoteItems: QuoteItem[];
  onRenderPreview: () => void;
  onIssueSuccess: () => void;
  onError: (e: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreviewPdf = async () => {
    const clientName = (document.getElementById('previewClientName') as HTMLInputElement)?.value?.trim() || '';
    if (!clientName) {
      onError('クライアント名を入力してください');
      return;
    }
    if (previewQuoteItems.length === 0) {
      onError('明細がありません');
      return;
    }
    const docEl = document.getElementById('estimatePreviewDoc');
    if (!docEl || !docEl.firstElementChild) {
      onError('プレビューを先に表示してください');
      return;
    }
    setPreviewLoading(true);
    try {
      const blob = await captureElementToPdfBlob(docEl);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      const msg = (e as Error).message || String(e);
      onError('プレビューの生成に失敗しました: ' + msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleIssue = async () => {
    const clientName = (document.getElementById('previewClientName') as HTMLInputElement)?.value?.trim() || '';
    if (!clientName) {
      onError('クライアント名を入力してください');
      return;
    }
    if (previewQuoteItems.length === 0) {
      onError('明細がありません');
      return;
    }
    const docEl = document.getElementById('estimatePreviewDoc');
    if (!docEl || !docEl.firstElementChild) {
      onError('プレビューを先に表示してください');
      return;
    }
    const rate = parseFloat((document.getElementById('previewProfitRate') as HTMLInputElement)?.value || '15') || 15;
    setLoading(true);
    try {
      onRenderPreview();
      await new Promise((r) => setTimeout(r, 100));
      const pdfBlob = await captureElementToPdfBlob(docEl);
      const res = await apiPost<{ estimateId: number }>('/estimates', {
        projectName: clientName,
        clientName,
        baseItems: previewQuoteItems,
        defaultRate: rate,
        forceNew: true,
      });
      const fd = new FormData();
      fd.append('pdf', pdfBlob, 'estimate.pdf');
      const pdfRes = await apiPostFormData<{ success: boolean; viewUrl?: string; error?: string }>(
        `/estimates/${res.estimateId}/pdf`,
        fd
      );
      if (pdfRes.success && pdfRes.viewUrl) {
        window.open(pdfRes.viewUrl, '_blank');
        document.getElementById('cardEstimateFromQuote')?.classList.add('hidden');
        onIssueSuccess();
      } else {
        onError((pdfRes as { error?: string }).error || 'PDFの作成に失敗しました');
      }
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card hidden" id="cardEstimateFromQuote">
      <h2>自社見積書の作成（プレビュー・発行）</h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        ① 取り込んだ業者見積を確認 → ② 利益率を設定 → ③ 自社見積を発行
      </p>
      <div id="previewContractorQuoteSection" style={{ marginTop: 12, padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginBottom: 6 }}>① 取り込んだ業者見積</div>
        <div id="previewContractorQuoteHeader" style={{ fontSize: '0.875rem' }} />
        <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>業者見積明細</div>
        <div id="previewContractorQuoteItems" style={{ marginTop: 4, overflowX: 'auto', fontSize: '0.8rem' }} />
      </div>
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginBottom: 8 }}>② クライアント・利益率を設定</div>
        <label style={{ fontSize: '0.875rem' }}>クライアント名（件名）</label>
        <input
          type="text"
          id="previewClientName"
          placeholder="株式会社〇〇"
          list="clientList"
          style={{ width: '100%', maxWidth: 280, marginTop: 4 }}
          defaultValue=""
        />
        <label style={{ fontSize: '0.875rem', marginTop: 8, display: 'block' }}>利益率（%）</label>
        <input
          type="number"
          id="previewProfitRate"
          defaultValue={15}
          min={0}
          max={100}
          style={{ width: 80, marginTop: 4 }}
        />
      </div>
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginBottom: 8 }}>③ 自社見積（利益をのせた金額）</div>
        <div id="previewItemsTable" style={{ marginTop: 8, overflowX: 'auto', fontSize: '0.875rem' }} />
        <div style={{ marginTop: 8 }}><strong>合計</strong> <span id="previewTotal">¥0</span></div>
      </div>
      <div style={{ marginTop: 16 }}><strong>見積書プレビュー</strong></div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>下のHTMLプレビュー、または「PDFプレビュー」で仕上がりを確認できます。</p>
      <div id="estimatePreviewDoc" className="preview-box" style={{ marginTop: 8, maxHeight: 320, overflow: 'auto', background: '#fff', padding: 16, border: '1px solid var(--border)' }} />
      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handlePreviewPdf}
          disabled={loading || previewLoading || previewQuoteItems.length === 0}
        >
          {previewLoading ? '生成中…' : 'PDFプレビュー'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          id="btnIssueEstimate"
          onClick={handleIssue}
          disabled={loading}
        >
          {loading ? '発行中…' : '発行（保存してPDFを作成）'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => document.getElementById('cardEstimateFromQuote')?.classList.add('hidden')}
        >
          戻る
        </button>
      </div>
    </div>
  );
}

function EstimateEditCard({
  currentEstimateId,
  currentEstimateItems,
  setCurrentEstimateItems,
  onClose,
  onSaved,
  onPdfCreated,
  onError,
}: {
  currentEstimateId: number | null;
  currentEstimateItems: Array<{ name: string; qty: number; unit: string; costPrice: number; profitRate?: number; applyMargin: boolean }>;
  setCurrentEstimateItems: React.Dispatch<React.SetStateAction<typeof currentEstimateItems>>;
  onClose: () => void;
  onSaved: () => void;
  onPdfCreated: () => void;
  onError: (e: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [rate, setRate] = useState(15);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!!currentEstimateId);
    if (!currentEstimateId) return;
    apiGet<{ success: boolean; clientName?: string; defaultProfitRate?: number; items?: typeof currentEstimateItems }>(
      `/estimates/${currentEstimateId}`
    ).then((d) => {
      if (d.success) {
        setLabel(d.clientName || '');
        setRate(d.defaultProfitRate ?? 15);
        const items = (d.items || []).map((r) => ({
          name: r.name,
          qty: r.qty,
          unit: r.unit || '式',
          costPrice: r.costPrice,
          profitRate: r.profitRate,
          applyMargin: r.applyMargin !== false,
        }));
        setCurrentEstimateItems(items.length ? items : [{ name: '', qty: 1, unit: '式', costPrice: 0, applyMargin: true }]);
      }
    }).catch(() => onError('取得失敗'));
  }, [currentEstimateId, setCurrentEstimateItems]);

  const save = async () => {
    if (!currentEstimateId) return;
    try {
      await apiPost(`/estimates/${currentEstimateId}/save`, {
        items: currentEstimateItems,
        defaultProfitRate: rate,
      });
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const createPdf = async () => {
    if (!currentEstimateId) return;
    const hasItem = currentEstimateItems.some((i) => String(i.name || '').trim() !== '');
    if (!hasItem) {
      onError('明細を1件以上入力してください');
      return;
    }
    try {
      await save();
      const defaultRate = rate;
      const calcItems = currentEstimateItems
        .filter((i) => String(i.name || '').trim())
        .map((i) => {
          const cost = Number(i.costPrice) || 0;
          const qty = Number(i.qty) || 1;
          const itemRate = i.profitRate != null ? i.profitRate : defaultRate;
          const applyMargin = i.applyMargin !== false;
          const sellPrice = applyMargin ? Math.floor(cost * (1 + itemRate / 100)) : cost;
          const amount = sellPrice * qty;
          return { name: i.name || '', qty, unit: i.unit || '式', cost, sellPrice, amount };
        });
      if (calcItems.length === 0) {
        onError('明細を1件以上入力してください');
        return;
      }
      const settings = await apiGet<Record<string, string>>('/settings').catch(() => ({}));
      const html = buildEstimateDocHtml({
        calcItems,
        clientName: label || '（宛先）',
        settings: settings || {},
      });
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;';
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
      const target = wrap.firstElementChild as HTMLElement;
      const pdfBlob = await captureElementToPdfBlob(target);
      document.body.removeChild(wrap);
      const fd = new FormData();
      fd.append('pdf', pdfBlob, 'estimate.pdf');
      const res = await apiPostFormData<{ success: boolean; viewUrl?: string; error?: string }>(
        `/estimates/${currentEstimateId}/pdf`,
        fd
      );
      if (res.success && (res as { viewUrl?: string }).viewUrl) {
        window.open((res as { viewUrl: string }).viewUrl, '_blank');
        onPdfCreated();
      } else {
        onError((res as { error?: string }).error || '失敗');
      }
    } catch (e) {
      onError((e as Error).message);
    }
  };

  if (!visible) return null;
  return (
    <div className="card" id="cardEstimateEdit">
      <h2>明細・利益率</h2>
      <p id="estimateEditLabel" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{label}</p>
      <label>一括 利益率（%）</label>
      <input
        type="number"
        id="estimateProfitRate"
        value={rate}
        onChange={(e) => setRate(parseFloat(e.target.value) || 15)}
        min={0}
        max={100}
      />
      <div id="estimateItemsContainer" style={{ marginTop: 12 }} />
      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} id="btnAddEstimateItem">
        ＋ 行を追加
      </button>
      <div style={{ marginTop: 16 }}><strong>合計</strong> <span id="estimateTotal">¥0</span></div>
      <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={save}>保存</button>
      <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} onClick={createPdf}>見積書PDFを作成</button>
      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={onClose}>閉じる</button>
    </div>
  );
}

function RecentEstimates({ onOpen, onDeleted }: { onOpen: (id: number) => void; onDeleted?: () => void }) {
  const [list, setList] = useState<Array<{ estimateId: number; clientName: string; projectName: string; createDate: string; status: string; pdfFileId?: string }>>([]);

  const load = useCallback(() => {
    apiGet<typeof list>('/estimates').then(setList).catch(() => setList([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (estimateId: number, status: string) => {
    if (status !== '下書き') return;
    if (!confirm('この下書きを削除しますか？')) return;
    try {
      const res = await fetch(`/api/estimates/${estimateId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        load();
        onDeleted?.();
      } else {
        alert(data.error || '削除に失敗しました');
      }
    } catch (e) {
      alert('削除に失敗しました: ' + String((e as Error).message));
    }
  };

  if (list.length === 0) {
    return (
      <div className="card">
        <h2>続きから（作成済みクライアント見積を開く）</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>過去に作成した見積書を開いて編集・PDF出力します。</p>
        <div id="recentEstimates">まだ見積がありません</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>続きから（作成済みクライアント見積を開く）</h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>過去に作成した見積書を開いて編集・PDF出力します。</p>
      <div id="recentEstimates">
        {list.map((e) => {
          const title = e.clientName || e.projectName || '見積 No.' + e.estimateId;
          const sub = (e.createDate ? String(e.createDate).replace(/T.*/, '') : '') + (e.status ? ' · ' + e.status : '');
          const isDraft = e.status === '下書き';
          return (
            <div key={e.estimateId} className="list-item">
              <div>
                <strong>{title}</strong>
                <br />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpen(e.estimateId)} style={{ width: 'auto' }}>
                  開く
                </button>
                {e.pdfFileId && (
                  <a href={e.pdfFileId.startsWith('http') ? e.pdfFileId : '#'} target="_blank" rel="noopener" style={{ fontSize: '0.875rem' }}>
                    PDF
                  </a>
                )}
                {isDraft && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}
                    onClick={() => handleDelete(e.estimateId, e.status)}
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InvoicePanel({
  currentInvoiceId,
  setCurrentInvoiceId,
  showToast,
}: {
  currentInvoiceId: string | null;
  setCurrentInvoiceId: (id: string | null) => void;
  showToast: (msg: string) => void;
}) {
  const [list, setList] = useState<Array<{ invoiceId: string; clientName: string; amount: number; issueDate: string }>>([]);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<typeof list>('/invoices');
      setList(data || []);
    } catch {
      setList([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div id="panelInvoice">
      <div className="card">
        <h2>請求書一覧</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
          新規請求書を作成
        </button>
        <div id="invoiceList" style={{ marginTop: 12 }}>
          {list.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>請求書がありません</p>
          ) : (
            list.map((inv) => (
              <div key={inv.invoiceId} className="list-item">
                <div>
                  <strong>{inv.clientName}</strong>
                  <br />
                  <span style={{ fontSize: '0.875rem' }}>¥{(inv.amount || 0).toLocaleString()} · {inv.issueDate || ''}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: 'auto' }}
                  onClick={() => setCurrentInvoiceId(inv.invoiceId)}
                >
                  開く
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      {showNew && (
        <InvoiceNewForm
          onCreated={(id) => {
            setCurrentInvoiceId(id);
            setShowNew(false);
            load();
            showToast('請求書を作成しました');
          }}
          onError={(e) => showToast(e)}
          onCancel={() => setShowNew(false)}
        />
      )}
      {currentInvoiceId && (
        <InvoiceDetail
          invoiceId={currentInvoiceId}
          onClose={() => setCurrentInvoiceId(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function InvoiceNewForm({
  onCreated,
  onError,
  onCancel,
}: {
  onCreated: (id: string) => void;
  onError: (e: string) => void;
  onCancel: () => void;
}) {
  const [client, setClient] = useState('');
  const [amount, setAmount] = useState('');
  const [itemsText, setItemsText] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!client.trim()) {
      onError('取引先名を入力してください');
      return;
    }
    const lines = itemsText.split('\n').filter((l) => l.trim());
    const items = lines.map((line) => {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      return { description: parts[0] || '', amount: parseFloat(parts[1]) || 0 };
    });
    setLoading(true);
    try {
      const res = await apiPost<{ success: boolean; invoiceId: string }>('/invoices', {
        clientName: client,
        amount: parseFloat(amount) || 0,
        items,
        emailTo: '',
      });
      onCreated(res.invoiceId);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>新規請求書</h2>
      <label>取引先名</label>
      <input type="text" placeholder="株式会社〇〇" value={client} onChange={(e) => setClient(e.target.value)} />
      <label style={{ marginTop: 12 }}>合計金額</label>
      <input type="number" placeholder="100000" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <label style={{ marginTop: 12 }}>明細（1行1項目）</label>
      <textarea
        rows={4}
        placeholder="摘要, 金額&#10;工事代金, 80000&#10;諸経費, 20000"
        value={itemsText}
        onChange={(e) => setItemsText(e.target.value)}
      />
      <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={submit} disabled={loading}>
        作成
      </button>
      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={onCancel}>
        キャンセル
      </button>
    </div>
  );
}

function InvoiceDetail({
  invoiceId,
  onClose,
  showToast,
}: {
  invoiceId: string;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const [inv, setInv] = useState<{
    clientName: string;
    amount: number;
    issueDate: string;
    items: Array<{ description: string; amount: number }>;
    emailTo: string;
  } | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    apiGet<typeof inv>(`/invoices/${invoiceId}`).then(setInv).catch(() => setInv(null));
    apiGet<Record<string, string>>('/settings').then((s) => setSettings(s || {})).catch(() => setSettings({}));
  }, [invoiceId]);

  const createPdf = async () => {
    try {
      const res = await apiPost<{ success: boolean; viewUrl?: string; error?: string }>(
        `/invoices/${invoiceId}/pdf`
      );
      if (res.success && res.viewUrl) {
        window.open(res.viewUrl, '_blank');
        showToast('PDFを作成しました');
      } else {
        showToast(res.error || '失敗');
      }
    } catch (e) {
      showToast((e as Error).message);
    }
  };

  if (!inv) return null;

  const companyName = settings.companyName || '（会社名）';
  const companyAddress = settings.companyAddress || '';
  const companyTel = settings.companyTel || '';
  const companyEmail = settings.companyEmail || '';
  const issueDateStr = (inv.issueDate || '').replace(/-/g, '/') || new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const totalAmount = inv.amount ?? (inv.items || []).reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <div className="invoice-detail-view">
      <div className="invoice-detail-nav">
        <button type="button" className="nav-back" onClick={onClose}>
          ← 請求書一覧に戻る
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={createPdf}>
          PDF出力
        </button>
      </div>
      <div className="invoice-detail-summary">
        <span>請求先: {inv.clientName}</span>
        <span>請求日: {issueDateStr}</span>
        <span>合計金額: ¥{totalAmount.toLocaleString()}</span>
      </div>
      <div className="invoice-detail-preview-wrapper">
        <div className="invoice-doc-preview">
          <h1 className="invoice-doc-title">請求書</h1>
          <div className="invoice-doc-body">
            <div className="invoice-doc-client">
              <p className="invoice-doc-client-name">{inv.clientName} 御中</p>
              <p>請求日: {issueDateStr}</p>
              <p>合計金額: ¥{totalAmount.toLocaleString()} (税込)</p>
            </div>
            <div className="invoice-doc-vendor">
              <p className="invoice-doc-vendor-name">{companyName}</p>
              {companyAddress && <p>{companyAddress}</p>}
              {companyTel && <p>TEL: {companyTel}</p>}
              {companyEmail && <p>E-mail: {companyEmail}</p>}
            </div>
          </div>
          <table className="invoice-doc-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>業務内容</th>
                <th>単価</th>
                <th>数量</th>
                <th>金額</th>
              </tr>
            </thead>
            <tbody>
              {(inv.items || []).map((i, idx) => (
                <tr key={idx}>
                  <td />
                  <td>{i.description || ''}</td>
                  <td className="text-right">¥{(i.amount || 0).toLocaleString()}</td>
                  <td className="text-right">1</td>
                  <td className="text-right">¥{(i.amount || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="invoice-doc-total">
            合計: ¥{totalAmount.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="invoice-detail-footer">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
