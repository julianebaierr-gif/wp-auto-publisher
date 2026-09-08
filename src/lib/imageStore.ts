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

export function savePreviewImage(dataUrl: string): string {
  cleanOldImages();
  const id = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  store.set(id, {
    dataUrl,
    createdAt: Date.now(),
  });

  // Also write to public/temp_images as fallback
  try {
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches) {
      const buffer = Buffer.from(matches[2], 'base64');
      fs.writeFileSync(path.join(TEMP_DIR, `${id}.png`), buffer);
    }
  } catch (e) {
    console.warn('Could not write preview image to disk:', e);
  }

  return id;
}

export function getPreviewImage(id: string): string | null {
  // 1. Check memory store
  const entry = store.get(id);
  if (entry) return entry.dataUrl;

  // 2. Check disk file
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

  return null;
}
