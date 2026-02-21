import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '見積・請求',
  description: '業者見積の取り込みから、クライアント見積書・請求書の作成まで',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1b4332" />
      </head>
      <body>{children}</body>
    </html>
  );
}
