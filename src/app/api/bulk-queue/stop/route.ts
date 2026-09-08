import { NextResponse } from 'next/server';
import { stopBackgroundBulkQueue } from '@/lib/bulkQueue';
export async function POST() {
  try {
    const state = await stopBackgroundBulkQueue();
    return NextResponse.json({ success: true, message: 'Queue stopped', completed: state.completed, failed: state.failed, remaining: state.items.filter(i => i.status === 'pending').length });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}