import { NextRequest, NextResponse } from 'next/server';
import { startBackgroundBulkQueue } from '@/lib/bulkQueue';
export const maxDuration = 300;
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { keywords, intervalHours = 8, settings = {} } = body;
    if (!Array.isArray(keywords) || keywords.length === 0) return NextResponse.json({ error: 'Keywords array required' }, { status: 400 });
    const clean = keywords.map((k: string) => k.trim()).filter(Boolean);
    if (clean.length === 0) return NextResponse.json({ error: 'No valid keywords' }, { status: 400 });
    console.log('[Bulk Queue] Starting for ' + clean.length + ' keywords...');
    const state = await startBackgroundBulkQueue(clean, intervalHours, settings);
    return NextResponse.json({ success: true, message: 'Background queue started. Safe to close browser.', total: state.total, items: state.items.map(i => ({ keyword: i.keyword, scheduleDate: i.scheduleDate, status: i.status })) });
  } catch (error: any) {
    console.error('Error starting bulk queue:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}