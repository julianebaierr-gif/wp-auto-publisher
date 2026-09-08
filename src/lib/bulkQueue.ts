import fs from 'fs';
import path from 'path';
import { fetchExistingPosts, uploadImageToWordPress, publishPostToWordPress, fetchWordPressCategories, autoDetermineCategory } from './wordpress';
import { generateSeoArticle, generateDalleImage } from './openai';

export interface BulkQueueItem {
  id: string; keyword: string; scheduleDate?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string; postUrl?: string; title?: string;
  createdAt: string; completedAt?: string;
}

export interface BulkQueueState {
  isRunning: boolean; total: number; completed: number; failed: number;
  currentItem?: string; items: BulkQueueItem[]; settings?: any;
}

const QUEUE_FILE = path.join(process.cwd(), 'data', 'bulk_queue.json');

function ensureDataDir() {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getBulkQueueState(): BulkQueueState {
  ensureDataDir();
  if (!fs.existsSync(QUEUE_FILE)) return { isRunning: false, total: 0, completed: 0, failed: 0, items: [] };
  try { const raw = fs.readFileSync(QUEUE_FILE, 'utf8'); return JSON.parse(raw); }
  catch { return { isRunning: false, total: 0, completed: 0, failed: 0, items: [] }; }
}

export function saveBulkQueueState(state: BulkQueueState) {
  ensureDataDir();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

let isWorkerActive = false;

export async function startBackgroundBulkQueue(keywords: string[], intervalHours: number, settings: any): Promise<BulkQueueState> {
  const now = new Date();
  const newItems: BulkQueueItem[] = keywords.map((kw, i) => {
    let scheduleDate: string | undefined = undefined;
    if (intervalHours > 0) {
      const t = new Date(now.getTime() + i * intervalHours * 60 * 60 * 1000);
      scheduleDate = t.toISOString().replace(/\.\d{3}Z$/, '');
    }
    return { id: String(Date.now()) + '_' + i + '_' + Math.random().toString(36).slice(2, 6), keyword: kw, scheduleDate, status: 'pending' as const, createdAt: new Date().toISOString() };
  });
  const state: BulkQueueState = { isRunning: true, total: newItems.length, completed: 0, failed: 0, items: newItems, settings };
  saveBulkQueueState(state);
  if (!isWorkerActive) { runBackgroundWorker().catch(err => console.error('[BG Worker Error]:', err)); }
  return state;
}

export async function stopBackgroundBulkQueue(): Promise<BulkQueueState> {
  const state = getBulkQueueState(); state.isRunning = false; state.currentItem = undefined;
  saveBulkQueueState(state); return state;
}

async function runBackgroundWorker() {
  if (isWorkerActive) return; isWorkerActive = true;
  try {
    while (true) {
      const state = getBulkQueueState();
      if (!state.isRunning) break;
      const pendingItem = state.items.find(item => item.status === 'pending');
      if (!pendingItem) { state.isRunning = false; state.currentItem = undefined; saveBulkQueueState(state); break; }
      pendingItem.status = 'processing'; state.currentItem = pendingItem.keyword; saveBulkQueueState(state);
      console.log('[Background Worker] Processing: ' + pendingItem.keyword);
      try {
        const result = await processSingleBulkArticle(pendingItem.keyword, pendingItem.scheduleDate, state.settings);
        pendingItem.status = 'completed'; pendingItem.postUrl = result.postUrl; pendingItem.title = result.title;
        pendingItem.completedAt = new Date().toISOString(); state.completed += 1;
      } catch (procErr: any) {
        console.error('[BG Worker] Failed: ' + pendingItem.keyword, procErr.message);
        pendingItem.status = 'failed'; pendingItem.error = procErr.message;
        pendingItem.completedAt = new Date().toISOString(); state.failed += 1;
      }
      state.currentItem = undefined; saveBulkQueueState(state);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } finally { isWorkerActive = false; }
}

async function processSingleBulkArticle(keyword: string, scheduleDate: string | undefined, settings: any = {}) {
  const trimmedKeyword = keyword.trim();
  const wpUrl = settings.wpUrl || process.env.WORDPRESS_URL || 'https://tgcenters.com';
  const wpUsername = settings.wpUsername || process.env.WORDPRESS_USERNAME || 'n8n-bot';
  const wpAppPassword = settings.wpAppPassword || process.env.WORDPRESS_APP_PASSWORD || 'RPbI TjbC Hb08 wC5E Ok0U Dtpo';
  const openaiApiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
  const publishStatus = settings.publishStatus || (process.env.WORDPRESS_DEFAULT_STATUS as 'publish' | 'draft') || 'draft';
  if (!openaiApiKey) throw new Error('OpenAI API key missing');
  const [existingPosts, categories] = await Promise.all([fetchExistingPosts(wpUrl), fetchWordPressCategories(wpUrl, wpUsername, wpAppPassword)]);
  const article = await generateSeoArticle({ keyword: trimmedKeyword, existingPosts, categories, apiKey: openaiApiKey });
  const [featuredImageUrl, inArticleImageUrl] = await Promise.all([
    generateDalleImage({ prompt: article.featuredImagePrompt, aspect: '1792x1024', apiKey: openaiApiKey }),
    generateDalleImage({ prompt: article.inArticleImagePrompt, aspect: '1024x1024', apiKey: openaiApiKey }),
  ]);
  const slug = article.slug || trimmedKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  let featuredMedia = { id: 0, sourceUrl: featuredImageUrl };
  let inArticleMedia = { id: 0, sourceUrl: inArticleImageUrl };
  try {
    const [featRes, inArtRes] = await Promise.all([
      uploadImageToWordPress({ imageUrl: featuredImageUrl, filename: slug + '-featured.jpg', title: article.title + ' - Featured', altText: trimmedKeyword, wpUrl, username: wpUsername, appPassword: wpAppPassword }).catch(() => ({ id: 0, sourceUrl: featuredImageUrl })),
      uploadImageToWordPress({ imageUrl: inArticleImageUrl, filename: slug + '-diagram.jpg', title: article.title + ' - Diagram', altText: trimmedKeyword, wpUrl, username: wpUsername, appPassword: wpAppPassword }).catch(() => ({ id: 0, sourceUrl: inArticleImageUrl })),
    ]);
    if (featRes && featRes.sourceUrl) featuredMedia = featRes;
    if (inArtRes && inArtRes.sourceUrl) inArticleMedia = inArtRes;
  } catch (err: any) { console.warn('Image upload fallback:', err.message); }
  const imgCls = inArticleMedia.id ? 'wp-image-' + inArticleMedia.id + ' ' : '';
  const inArticleImageHtml = '<figure class="wp-block-image size-large my-6"><img src="' + inArticleMedia.sourceUrl + '" alt="' + trimmedKeyword + '" class="' + imgCls + 'rounded-xl shadow-lg w-full" /><figcaption>' + trimmedKeyword + '</figcaption></figure>';
  let finalContent = article.contentHtml;
  if (finalContent.includes('<!-- IN_ARTICLE_IMAGE_HERE -->')) { finalContent = finalContent.replace('<!-- IN_ARTICLE_IMAGE_HERE -->', inArticleImageHtml); }
  else {
    const h2s = [...finalContent.matchAll(/<\/h2>/g)];
    if (h2s.length >= 2) { const m = h2s[Math.floor(h2s.length / 2)]; const idx = m.index! + 5; finalContent = finalContent.slice(0, idx) + inArticleImageHtml + finalContent.slice(idx); }
    else { const mp = Math.floor(finalContent.length / 2); const np = finalContent.indexOf('</p>', mp); if (np !== -1) { finalContent = finalContent.slice(0, np + 4) + inArticleImageHtml + finalContent.slice(np + 4); } else { finalContent = finalContent + inArticleImageHtml; } }
  }
  const categoryId = article.category?.id || autoDetermineCategory(trimmedKeyword, article.title).id;
  const publishedPost = await publishPostToWordPress({ title: article.title, slug: article.slug, contentHtml: finalContent, metaDescription: article.metaDescription, focusKeyword: article.focusKeyword, featuredMediaId: featuredMedia.id, categoryId, status: scheduleDate ? 'future' : publishStatus, date: scheduleDate, wpUrl, username: wpUsername, appPassword: wpAppPassword });
  return { postUrl: publishedPost.link, title: article.title };
}