import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows, DEFAULT_SHEET_ID } from '@/lib/googleSheets';
import { processSingleBulkArticle } from '@/lib/bulkQueue';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handlePublish(req);
}

export async function GET(req: NextRequest) {
  return handlePublish(req);
}

async function handlePublish(req: NextRequest) {
  try {
    let settings: any = {};
    try {
      if (req.method === 'POST') {
        settings = await req.json();
      }
    } catch {
      // ignore
    }

    const sheetId = settings.sheetId || process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID;
    const rows = await fetchSheetRows(sheetId);

    const pendingItem = rows.find((r) => r.status.toLowerCase() === 'pending');
    if (!pendingItem) {
      return NextResponse.json({
        success: true,
        message: 'All keywords in Google Sheet have already been published!',
      });
    }

    const keyword = pendingItem.keyword.trim();
    console.log('[Auto Publisher] Processing Google Sheet row #' + pendingItem.rowIndex + ': ' + keyword);

    const effectiveSettings = {
      wpUrl: settings.wpUrl || process.env.WORDPRESS_URL || 'https://tgcenters.com',
      wpUsername: settings.wpUsername || process.env.WORDPRESS_USERNAME || 'n8n-bot',
      wpAppPassword: (settings.wpAppPassword || process.env.WORDPRESS_APP_PASSWORD || 'RPbI TjbC Hb08 wC5E Ok0U Dtpo').replace(/\s+/g, ''),
      openaiApiKey: settings.openaiApiKey || process.env.OPENAI_API_KEY,
      publishStatus: 'publish',
    };

    if (!effectiveSettings.openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API Key is missing. Please save it in Credentials & API settings.' }, { status: 400 });
    }

    const result = await processSingleBulkArticle(keyword, undefined, effectiveSettings);

    return NextResponse.json({
      success: true,
      keyword,
      rowIndex: pendingItem.rowIndex,
      status: 'Live',
      postUrl: result.postUrl,
      title: result.title,
      message: 'Successfully generated and published: ' + result.title,
    });
  } catch (error: any) {
    console.error('[Auto Publisher Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Auto publisher failed' },
      { status: 500 }
    );
  }
}