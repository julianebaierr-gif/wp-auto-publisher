export const DEFAULT_SHEET_ID = '1aZ7i0sZ83-gBK7zdLfjZQM-UnqUV_xFtIgv65QuGgRc';

export interface SheetRow {
  rowIndex: number; // 1-based index (header is 1)
  keyword: string;
  status: string;
  postUrl: string;
}

/**
 * Extract Sheet ID from full Google Sheet URL or return the ID directly
 */
export function extractSheetId(urlOrId: string): string {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return urlOrId.trim();
}

/**
 * Fetch and parse all rows from a public or shared Google Sheet
 */
export async function fetchSheetRows(sheetId: string = DEFAULT_SHEET_ID): Promise<SheetRow[]> {
  const cleanId = extractSheetId(sheetId);
  const csvUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv&gid=0`;

  const res = await fetch(csvUrl, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to read Google Sheet (${res.status}): Make sure General access is set to 'Anyone with the link'`);
  }

  const csvText = await res.text();
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const rows: SheetRow[] = [];

  // Line 0 is header (Keyword, Status, Post URL)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Simple CSV parser for 3 columns: Keyword, Status, Post URL
    const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    const kw = cols[0] || '';
    const status = cols[1] || 'Pending';
    const postUrl = cols[2] || '';

    if (kw) {
      rows.push({
        rowIndex: i + 1, // 1-based row number
        keyword: kw,
        status,
        postUrl,
      });
    }
  }

  return rows;
}

/**
 * Update Google Sheet row status and Post URL via Google Apps Script Webhook or Apps Script URL if configured
 */
export async function updateSheetRowStatus(
  webhookUrl: string,
  data: {
    keyword: string;
    status: 'Live' | 'Scheduled' | 'Published';
    postUrl: string;
    rowIndex?: number;
  }
): Promise<boolean> {
  if (!webhookUrl) return false;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (err) {
    console.warn('Google Sheet webhook update notice:', err);
    return false;
  }
}
