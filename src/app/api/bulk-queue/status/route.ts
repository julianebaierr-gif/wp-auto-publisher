import { NextResponse } from 'next/server';
import { getBulkQueueState } from '@/lib/bulkQueue';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const state = getBulkQueueState();
    return NextResponse.json({ isRunning: state.isRunning, total: state.total, completed: state.completed, failed: state.failed, currentItem: state.currentItem, items: state.items.map(i => ({ id: i.id, keyword: i.keyword, scheduleDate: i.scheduleDate, status: i.status, error: i.error, postUrl: i.postUrl, title: i.title, completedAt: i.completedAt })) });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}