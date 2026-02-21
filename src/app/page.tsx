'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const API = '/api';

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(API + path);
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

interface QuoteDetail {
  success: boolean;
  quoteId: string;
  header: { contractorName: string; subject: string; fileName: string; importedAt: string; totalCost: number };
  items: QuoteItem[];
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
      const result = await apiGet<{ list: ContractorQuote[]; error: string | null }>('/contractor-quotes');
      const list = result?.list ?? [];
      const err = result?.error ?? null;
      if (err) {
        listEl.innerHTML = `<p style="font-size:0.875rem; color: var(--text-muted);">${err}</p>`;
      } else if (!list.length) {
        listEl.innerHTML = '<p style="font-size:0.875rem; color: var(--text-muted);">まだ取り込んだ業者見積がありません。上でExcelファイルをアップロードして追加してください。</p>';
      } else {
        listEl.innerHTML = list.map((q) => {
          const label = (q.subject || q.fileName || q.quoteId || '').toString();
          const contractor = (q.contractorName || '').toString();
          const total = q.totalCost != null ? '¥' + Number(q.totalCost).toLocaleString() : '';
          const dateStr = (q.importedAt != null && q.importedAt !== '') ? String(q.importedAt).replace(/T.*/, '') : '';
          const sub = (contractor ? '業者: ' + contractor + '　' : '') + total + (dateStr ? ' · ' + dateStr : '');
          return `<div class="quote-item" data-quote-id="${q.quoteId || ''}" style="border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div><strong>${label || '（件名なし）'}</strong><br><span style="font-size:0.75rem; color: var(--text-muted)">${sub}</span></div>
              <div style="display:flex; gap:6px;">
                <button type="button" class="btn btn-secondary btn-sm btn-show-detail" data-quote-id="${q.quoteId || ''}">明細を見る</button>
                <button type="button" class="btn btn-primary btn-sm btn-create-estimate" data-quote-id="${q.quoteId || ''}">見積書を作成</button>
              </div></div></div>`;
        }).join('');
        bindQuoteButtons(listEl);
      }
      done?.();
    } catch {
      listEl.innerHTML = '<p style="font-size:0.875rem; color: var(--text-muted);">取得できませんでした。</p>';
      done?.();
    }
  }, []);

  const bindQuoteButtons = (container: HTMLElement) => {
    const detailEl = document.getElementById('importedQuoteDetail');
    container.querySelectorAll('.btn-show-detail').forEach((btn) => {
      btn.addEventListener('click', async function (this: HTMLElement) {
        const qid = this.getAttribute('data-quote-id');
        if (!qid || !detailEl) return;
        detailEl.classList.remove('hidden');
        detailEl.innerHTML = '<span style="color: var(--text-muted)">読み込み中…</span>';
        try {
          const res = await apiGet<QuoteDetail>(`/contractor-quotes/${qid}`);
          if (!res.success || !res.items?.length) {
            detailEl.innerHTML = '<p style="font-size:0.875rem; color: var(--text-muted)">明細がありません</p>';
            return;
          }
          const tableRows = res.items.map((i) => {
            const cost = Number(i.costPrice) || 0;
            const qty = Number(i.qty) || 1;
            const amt = Number(i.amount) || cost * qty;
            return `<tr><td style="padding:4px 6px; border-bottom:1px solid var(--border)">${i.name || ''}</td><td style="padding:4px 6px; border-bottom:1px solid var(--border)">${qty}</td><td style="padding:4px 6px; border-bottom:1px solid var(--border)">${i.unit || '式'}</td><td style="padding:4px 6px; border-bottom:1px solid var(--border); text-align:right">¥${cost.toLocaleString()}</td><td style="padding:4px 6px; border-bottom:1px solid var(--border); text-align:right">¥${amt.toLocaleString()}</td></tr>`;
          }).join('');
          detailEl.innerHTML = '<strong>業者見積明細</strong><table style="width:100%; border-collapse:collapse; font-size:0.8rem; margin-top:8px"><tr style="background:var(--border)"><th style="padding:4px 6px; text-align:left">品名</th><th style="padding:4px 6px">数量</th><th style="padding:4px 6px">単位</th><th style="padding:4px 6px; text-align:right">原価単価</th><th style="padding:4px 6px; text-align:right">金額</th></tr>' + tableRows + '</table>';
        } catch {
          detailEl.innerHTML = '取得失敗';
        }
      });
    });
    container.querySelectorAll('.btn-create-estimate').forEach((btn) => {
      btn.addEventListener('click', function (this: HTMLElement) {
        const quoteId = this.getAttribute('data-quote-id');
        if (quoteId) openEstimatePreview(quoteId);
      });
    });
  };

  const openEstimatePreview = async (quoteId: string) => {
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
    if (els.previewProfitRate) els.previewProfitRate.value = '15';
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
    } catch {
      setPreviewQuoteHeader(null);
      setPreviewQuoteItems([]);
      setPreviewSettings({});
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
      const sellPrice = Math.floor(cost * (1 + rate / 100));
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

    const companyName = settings.companyName || '（会社名）';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    if (docEl) {
      docEl.innerHTML = '<div style="font-family:sans-serif; font-size:14px;">' +
        '<h2 style="margin:0 0 8px 0">御見積書</h2>' +
        '<p style="margin:0 0 4px 0">件名: ' + (clientName || '（クライアント名を入力）') + '</p>' +
        '<p style="margin:0 0 16px 0; font-size:12px">' + companyName + '</p>' +
        '<p style="margin:0 0 8px 0; font-size:12px">' + dateStr + '</p>' +
        '<p style="margin:16px 0 4px 0; font-weight:bold">御見積合計金額</p>' +
        '<p style="margin:0 0 16px 0; font-size:18px; font-weight:bold">¥' + total.toLocaleString() + '</p>' +
        '<table style="width:100%; border-collapse:collapse; font-size:12px">' +
        '<tr style="background:#eee"><th style="border:1px solid #ccc; padding:6px">No</th><th style="border:1px solid #ccc; padding:6px">品名</th><th style="border:1px solid #ccc; padding:6px">数量</th><th style="border:1px solid #ccc; padding:6px">単位</th><th style="border:1px solid #ccc; padding:6px; text-align:right">単価</th><th style="border:1px solid #ccc; padding:6px; text-align:right">金額</th></tr>' +
        calcItems.map((i, idx) =>
          `<tr><td style="border:1px solid #ccc; padding:6px">${idx + 1}</td><td style="border:1px solid #ccc; padding:6px">${i.name}</td><td style="border:1px solid #ccc; padding:6px">${i.qty}</td><td style="border:1px solid #ccc; padding:6px">${i.unit}</td><td style="border:1px solid #ccc; padding:6px; text-align:right">¥${i.sellPrice.toLocaleString()}</td><td style="border:1px solid #ccc; padding:6px; text-align:right">¥${i.amount.toLocaleString()}</td></tr>`
        ).join('') + '</table></div>';
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
                Excelファイルをアップロードして取り込みます。
              </p>
              <FileUpload
                onSuccess={() => {
                  showToast('取り込みました');
                  loadImportedQuoteList();
                }}
                onError={(e) => showToast('取込失敗: ' + e)}
              />
            </div>
            <div className="card" id="cardImportedQuotes">
              <h2>2. 取り込んだ業者見積を表示 → 利益をのせて自社見積を作成</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                業者見積の「見積書を作成」を押すと、取り込んだ内容を表示します。確認してから利益率を設定し、クライアント向け見積書を作成できます。
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => loadImportedQuoteList()}
              >
                一覧を更新
              </button>
              <div id="importedQuoteList" style={{ marginTop: 12 }} />
              <div id="importedQuoteDetail" className="hidden preview-box" style={{ marginTop: 12, maxHeight: 200, overflow: 'auto' }} />
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
  onSuccess: () => void;
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
      await apiPostFormData<{ success: boolean; itemCount?: number }>('/contractor-quotes/import', fd);
      onSuccess();
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
  onIssueSuccess,
  onError,
}: {
  clientList: string[];
  previewQuoteItems: QuoteItem[];
  onIssueSuccess: () => void;
  onError: (e: string) => void;
}) {
  const [loading, setLoading] = useState(false);

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
    const rate = parseFloat((document.getElementById('previewProfitRate') as HTMLInputElement)?.value || '15') || 15;
    setLoading(true);
    try {
      const res = await apiPost<{ estimateId: number }>('/estimates', {
        projectName: clientName,
        clientName,
        baseItems: previewQuoteItems,
        defaultRate: rate,
        forceNew: true,
      });
      const pdfRes = await apiPost<{ success: boolean; viewUrl?: string; error?: string }>(
        `/estimates/${res.estimateId}/pdf`
      );
      if (pdfRes.success && pdfRes.viewUrl) {
        window.open(pdfRes.viewUrl, '_blank');
        document.getElementById('cardEstimateFromQuote')?.classList.add('hidden');
        onIssueSuccess();
      } else {
        onError(pdfRes.error || 'PDFの作成に失敗しました');
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
      <div id="estimatePreviewDoc" className="preview-box" style={{ marginTop: 8, maxHeight: 320, overflow: 'auto', background: '#fff', padding: 16, border: '1px solid var(--border)' }} />
      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 16 }}
        id="btnIssueEstimate"
        onClick={handleIssue}
        disabled={loading}
      >
        {loading ? '発行中…' : '発行（保存してPDFを作成）'}
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ marginLeft: 8 }}
        onClick={() => document.getElementById('cardEstimateFromQuote')?.classList.add('hidden')}
      >
        戻る
      </button>
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
      const res = await apiPost<{ success: boolean; viewUrl?: string; error?: string }>(
        `/estimates/${currentEstimateId}/pdf`
      );
      if (res.success && res.viewUrl) {
        window.open(res.viewUrl, '_blank');
        onPdfCreated();
      } else {
        onError(res.error || '失敗');
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

function RecentEstimates({ onOpen }: { onOpen: (id: number) => void }) {
  const [list, setList] = useState<Array<{ estimateId: number; clientName: string; projectName: string; createDate: string; status: string; pdfFileId?: string }>>([]);

  useEffect(() => {
    apiGet<typeof list>('/estimates').then(setList).catch(() => setList([]));
  }, []);

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
          return (
            <div key={e.estimateId} className="list-item">
              <div>
                <strong>{title}</strong>
                <br />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</span>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpen(e.estimateId)} style={{ width: 'auto' }}>
                開く
              </button>
              {e.pdfFileId && (
                <a href={e.pdfFileId.startsWith('http') ? e.pdfFileId : '#'} target="_blank" rel="noopener" style={{ fontSize: '0.875rem' }}>
                  PDF
                </a>
              )}
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

  useEffect(() => {
    apiGet<typeof inv>(`/invoices/${invoiceId}`).then(setInv).catch(() => setInv(null));
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
  return (
    <div className="card">
      <h2>請求書</h2>
      <p style={{ fontSize: '0.875rem' }}>{inv.clientName} · ¥{(inv.amount || 0).toLocaleString()}</p>
      <div className="preview-box">
        <strong>請求書</strong>
        <br />
        請求先: {inv.clientName}
        <br />
        発行日: {inv.issueDate}
        <br />
        {(inv.items || []).map((i, idx) => (
          <span key={idx}>
            {(i.description || '') + ' … ¥' + (i.amount || 0).toLocaleString()}
            <br />
          </span>
        ))}
        <strong>合計: ¥{(inv.amount || 0).toLocaleString()}</strong>
      </div>
      <button type="button" className="btn btn-primary btn-sm" onClick={createPdf}>
        PDFを作成・ダウンロード
      </button>
      <label style={{ marginTop: 16 }}>送付先メール</label>
      <input type="email" placeholder="example@example.com" defaultValue={inv.emailTo} />
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
        メール送付機能は別途 Resend 等の設定が必要です。
      </p>
      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={onClose}>
        閉じる
      </button>
    </div>
  );
}
