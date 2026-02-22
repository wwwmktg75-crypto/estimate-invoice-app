import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/** 見積書PDFアップロード（クライアント側でキャプチャしたPDFを受け取りStorageに保存） */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const estimateId = parseInt(id, 10);
    if (isNaN(estimateId)) {
      return NextResponse.json(
        { success: false, error: '無効な見積ID' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'PDFファイルが必要です' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: header, error: headerErr } = await supabase
      .from('client_estimates')
      .select('id, project_name, client_name')
      .eq('id', estimateId)
      .single();

    if (headerErr || !header) {
      return NextResponse.json(
        { success: false, error: '見積が見つかりません' },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const projectName = (header.project_name || header.client_name || '見積').replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = `estimates/【見積書】${projectName}_${dateStr}.pdf`;

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      return NextResponse.json(
        { success: false, error: 'PDFのアップロードに失敗しました: ' + uploadErr.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    await supabase
      .from('client_estimates')
      .update({
        pdf_file_id: uploadData.path,
        status: '発行済',
      })
      .eq('id', estimateId);

    return NextResponse.json({
      success: true,
      viewUrl: urlData?.publicUrl || '',
      fileId: uploadData.path,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
