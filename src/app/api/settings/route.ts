import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');

    if (error) throw error;

    const obj: Record<string, string> = {};
    (data || []).forEach((row) => {
      const k = String(row.key || '').trim();
      if (k) obj[k] = String(row.value ?? '').trim();
    });
    return NextResponse.json(obj);
  } catch (e) {
    return NextResponse.json({}, { status: 500 });
  }
}
