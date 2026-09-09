import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows, DEFAULT_SHEET_ID, extractSheetId } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sheetId = searchParams.get('sheetId') || DEFAULT_SHEET_ID;

    const rows = await fetchSheetRows(sheetId);
    return NextResponse.json({
      success: true,
      sheetId: extractSheetId(sheetId),
      totalRows: rows.length,
      pendingCount: rows.filter((r) => r.status.toLowerCase() === 'pending').length,
      rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to read Google Sheet' }, { status: 500 });
  }
}
