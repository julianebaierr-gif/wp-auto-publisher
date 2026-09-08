import fs from 'fs';
import path from 'path';

// Global in-memory and disk cache for generated preview images
type ImageStoreEntry = {
  dataUrl: string;
  createdAt: number;
};

const globalForImages = globalThis as unknown as {
  __previewImageStore?: Map<string, ImageStoreEntry>;
};

if (!globalForImages.__previewImageStore) {
  globalForImages.__previewImageStore = new Map<string, ImageStoreEntry>();
}

const store = globalForImages.__previewImageStore;

const TEMP_DIR = path.join(process.cwd(), 'public', 'temp_images');
if (!fs.existsSync(TEMP_DIR)) {
  try {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  } catch (e) {
    // Ignore
  }
}

function cleanOldImages() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, entry] of store.entries()) {
    if (entry.createdAt < oneHourAgo) {
      store.delete(id);
      try {
        const filePath = path.join(TEMP_DIR, `${id}.png`);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {}
    }
  }
}

export async function savePreviewImage(dataUrlOrHttpUrl: string): Promise<string> {
  cleanOldImages();
  const id = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Store in memory
  store.set(id, {
    dataUrl: dataUrlOrHttpUrl,
    createdAt: Date.now(),
  });

  // Also write to public/temp_images synchronously or via fetch
  try {
    const filePath = path.join(TEMP_DIR, `${id}.png`);
    if (dataUrlOrHttpUrl.startsWith('data:')) {
      const matches = dataUrlOrHttpUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches) {
        const buffer = Buffer.from(matches[2], 'base64');
        fs.writeFileSync(filePath, buffer);
      }
    } else if (dataUrlOrHttpUrl.startsWith('http://') || dataUrlOrHttpUrl.startsWith('https://')) {
      // Remote OpenAI image URL
      const res = await fetch(dataUrlOrHttpUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(filePath, buffer);
        // Also update memory with data URL so it doesn't expire if OpenAI URL expires
        const mime = res.headers.get('content-type') || 'image/png';
        store.set(id, {
          dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
          createdAt: Date.now(),
        });
      }
    }
  } catch (e) {
    console.warn('Could not write preview image to disk:', e);
  }

  return id;
}

export function getPreviewImage(id: string): string | null {
  // 1. Check disk file first for exact bytes
  try {
    const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(TEMP_DIR, `${cleanId}.png`);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }
  } catch (e) {
    console.warn('Could not read preview image from disk:', e);
  }

  // 2. Check memory store
  const entry = store.get(id);
  if (entry) return entry.dataUrl;

  return null;
}
