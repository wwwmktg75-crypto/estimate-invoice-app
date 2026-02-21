# 見積・請求アプリ（Vercel + Supabase 版）

GAS版の見積・請求アプリを Vercel と Supabase で再実装したものです。

## 機能

1. **業者見積の取り込み** … Excelファイルをアップロードして取り込み
2. **クライアント見積書** … 業者見積をベースに利益を乗せて見積書を作成 → PDF発行
3. **請求書** … 請求書の作成・プレビュー・PDF出力

## 技術構成

- **Next.js 14** (App Router) … フロントエンド + APIルート
- **Supabase** … PostgreSQL（データベース）+ Storage（PDF保存）
- **Vercel** … デプロイ先
- **@react-pdf/renderer** … PDF生成
- **xlsx** … Excelパース

## セットアップ

### 1. Supabase プロジェクト作成

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. **SQL Editor** で `supabase/migrations/001_initial.sql` の内容を実行
3. **Storage** で `documents` バケットを新規作成（Public にチェック）
4. **Settings → API** から `Project URL` と `anon key`、`service_role key` をコピー

### 2. 環境変数

`.env.local` を作成し、以下を設定：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

※ ビルド時には上記が未設定だとエラーになります。開発時は `.env.local.example` をコピーしてプレースホルダーを入れておくか、実際の値を設定してください。

### 3. 設定データ（任意）

Supabase の `settings` テーブルに以下を登録すると、見積書・請求書に表示されます：

| key | value |
|-----|-------|
| companyName | 会社名 |
| bankInfo | 振込先情報 |

### 4. ローカル開発

```bash
npm install
npm run dev
```

http://localhost:3000 でアクセス

### 5. Vercel デプロイ

1. [Vercel](https://vercel.com) にリポジトリをインポート
2. 環境変数を設定（上記と同じ）
3. デプロイ

## GAS版との主な違い

| 項目 | GAS版 | Vercel + Supabase 版 |
|------|-------|----------------------|
| 業者見積取り込み | Drive フォルダ内のExcelを選択 | ファイルアップロード |
| データ保存 | Google スプレッドシート | Supabase PostgreSQL |
| PDF保存 | Google Drive | Supabase Storage |
| メール送付 | GmailApp | 未実装（Resend等の追加が必要） |

## 注意事項

- メール送付機能は未実装です。Resend や SendGrid を組み込む場合は API ルートを追加してください。
- Storage バケット `documents` が存在しない場合、PDF はブラウザで直接ダウンロードされます。
