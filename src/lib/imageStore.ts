// Global in-memory cache for generated preview images to avoid huge JSON payloads in API requests
type ImageStoreEntry = {
  dataUrl: string;
  createdAt: number;
};

// Use globalThis to persist across hot-reloads and requests in Node.js
const globalForImages = globalThis as unknown as {
  __previewImageStore?: Map<string, ImageStoreEntry>;
};

if (!globalForImages.__previewImageStore) {
  globalForImages.__previewImageStore = new Map<string, ImageStoreEntry>();
}

const store = globalForImages.__previewImageStore;

function cleanOldImages() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, entry] of store.entries()) {
    if (entry.createdAt < oneHourAgo) {
      store.delete(id);
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
  return id;
}

export function getPreviewImage(id: string): string | null {
  const entry = store.get(id);
  if (!entry) return null;
  return entry.dataUrl;
}
