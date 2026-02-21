import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// クライアント用（ブラウザ）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// サーバー用（APIルートでService Roleを使用）
export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY が設定されていません');
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}
