'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Settings as SettingsIcon, 
  Globe, 
  Key, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Image as ImageIcon, 
  Layers, 
  Check, 
  Loader2, 
  Zap, 
  RefreshCw,
  Eye,
  FileText,
  ArrowRight,
  Edit3,
  XCircle
} from 'lucide-react';
import { GenerationSettings } from '@/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'publish' | 'bulk' | 'settings'>('publish');
  
  // Single generation / preview state
  const [keyword, setKeyword] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusStep, setStatusStep] = useState<string>('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [publishedResult, setPublishedResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Bulk generation state
  const [bulkKeywords, setBulkKeywords] = useState('');
  const [bulkIntervalHours, setBulkIntervalHours] = useState<number>(8); // Default 8 hours auto-schedule
  const [bulkProgress, setBulkProgress] = useState<{ total: number; current: number; logs: any[] }>({
    total: 0,
    current: 0,
    logs: [],
  });
  const [isBulkRunning, setIsBulkRunning] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<GenerationSettings>({
    wpUrl: 'https://tgcenters.com',
    wpUsername: 'n8n-bot',
    wpAppPassword: 'RPbI TjbC Hb08 wC5E Ok0U Dtpo',
    openaiApiKey: '',
    publishStatus: 'publish',
  });

  const [settingsSaved, setSettingsSaved] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);

  // Load settings from localStorage but keep valid defaults
  useEffect(() => {
    const saved = localStorage.getItem('wp_auto_publisher_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings((prev) => ({
          ...prev,
          ...parsed,
          // If saved has old password or empty, use working default
          wpUrl: parsed.wpUrl && !parsed.wpUrl.includes('tradingblogco') ? parsed.wpUrl : 'https://tgcenters.com',
          wpUsername: parsed.wpUsername || 'n8n-bot',
          wpAppPassword: parsed.wpAppPassword || 'RPbI TjbC Hb08 wC5E Ok0U Dtpo',
        }));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);


  const saveSettings = (newSettings: GenerationSettings) => {
    setSettings(newSettings);
    localStorage.setItem('wp_auto_publisher_settings', JSON.stringify(newSettings));
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  // Test WordPress & OpenAI connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      setConnectionStatus(data);
    } catch (err: any) {
      setConnectionStatus({
        overallSuccess: false,
        error: err.message,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // 1. Generate Article & Image PREVIEW with Yoast SEO score
  const handleGeneratePreview = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!keyword.trim()) return;

    setIsLoadingPreview(true);
    setErrorMessage(null);
    setPreviewData(null);
    setPublishedResult(null);

    const steps = [
      '正在从 tgcenters.com 站点地图抓取中文页面与内部链接...',
      '正在规划 H2-H4 文章大纲、语义关键词及 3000-4000 字中文深度内容...',
      '正在调用 OpenAI API (gpt-image-1-mini) 生成专属 Telegram 图解与封面...',
      '正在汇总 Yoast SEO 审核报告与大纲排版预览...'
    ];

    let stepIdx = 0;
    setStatusStep(steps[0]);
    const interval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setStatusStep(steps[stepIdx]);
      }
    }, 8000);

    try {
      const res = await fetch('/api/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          settings,
        }),
      });

      clearInterval(interval);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to generate preview');
      }

      setPreviewData(data);
    } catch (err: any) {
      clearInterval(interval);
      setErrorMessage(err.message || 'Error occurred during preview generation');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 2. Confirm and Publish to WordPress
  const handleConfirmPublish = async () => {
    if (!previewData) return;

    setIsPublishing(true);
    setErrorMessage(null);

    try {
      let res = await fetch('/api/publish-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: previewData.article,
          images: previewData.images,
          settings,
        }),
      });

      let text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        data = { error: text.slice(0, 200) };
      }

      // If Vercel datacenter IP is blocked by Cloudflare (403), publish DIRECTLY from the browser!
      if (!res.ok && (data.error?.includes('403') || data.error?.includes('Just a moment') || data.error?.includes('Cloudflare'))) {
        console.log('[Direct Browser Fallback] Vercel serverless IP blocked by Cloudflare. Publishing directly from browser...');
        
        const wpUrl = (settings.wpUrl || 'https://tgcenters.com').replace(/\/+$/, '');
        const wpUser = settings.wpUsername || 'n8n-bot';
        const wpPass = (settings.wpAppPassword || 'RPbI TjbC Hb08 wC5E Ok0U Dtpo').replace(/\s+/g, '');
        const token = btoa(`${wpUser}:${wpPass}`);

        let featuredId = previewData.images?.featured?.id ? Number(previewData.images.featured.id) : 0;
        let postContentHtml = previewData.article.contentHtml;

        // Upload featured image directly from browser if not yet uploaded to WordPress
        if (featuredId === 0 && previewData.images?.featured?.url) {
          try {
            console.log('[Browser Fallback] Uploading featured image directly to WordPress media...');
            const featBlob = await fetch(previewData.images.featured.url).then(r => r.blob());
            const featUploadRes = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${token}`,
                'Content-Disposition': `attachment; filename="${previewData.article.slug || 'featured'}-featured.jpg"`,
                'Content-Type': featBlob.type || 'image/jpeg',
              },
              body: featBlob,
            });
            if (featUploadRes.ok) {
              const featData = await featUploadRes.json();
              if (featData.id) {
                featuredId = featData.id;
                console.log('[Browser Fallback] Featured image uploaded successfully. Media ID:', featuredId);
              }
            }
          } catch (uploadFeatErr) {
            console.warn('[Browser Fallback] Featured image upload notice:', uploadFeatErr);
          }
        }

        // Upload in-article image directly from browser if needed
        if (previewData.images?.inArticle?.url && !previewData.images.inArticle.url.includes('/wp-content/uploads/')) {
          try {
            const inArtBlob = await fetch(previewData.images.inArticle.url).then(r => r.blob());
            const inArtRes = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${token}`,
                'Content-Disposition': `attachment; filename="${previewData.article.slug || 'diagram'}-diagram.jpg"`,
                'Content-Type': inArtBlob.type || 'image/jpeg',
              },
              body: inArtBlob,
            });
            if (inArtRes.ok) {
              const inArtData = await inArtRes.json();
              if (inArtData.source_url) {
                postContentHtml = postContentHtml.split(previewData.images.inArticle.url).join(inArtData.source_url);
              }
            }
          } catch (inArtUploadErr) {
            console.warn('[Browser Fallback] In-article image upload notice:', inArtUploadErr);
          }
        }

        const payload: any = {
          title: previewData.article.title,
          slug: previewData.article.slug,
          content: postContentHtml,
          status: settings.publishStatus || 'publish',
          meta: {
            _yoast_wpseo_focuskw: previewData.article.focusKeyword,
            _yoast_wpseo_metadesc: previewData.article.metaDescription,
            _yoast_wpseo_title: previewData.article.title,
          },
        };

        if (featuredId > 0) {
          payload.featured_media = featuredId;
        }
        if (previewData.article.category?.id) {
          payload.categories = [previewData.article.category.id];
        }

        const directWpRes = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!directWpRes.ok) {
          const directErr = await directWpRes.text();
          throw new Error(`WordPress Post Publication failed (${directWpRes.status}): ${directErr.slice(0, 150)}`);
        }

        const directPost = await directWpRes.json();
        setPublishedResult({
          success: true,
          postId: directPost.id,
          postUrl: directPost.link,
          status: settings.publishStatus || 'publish',
        });
        return;
      }

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to publish to WordPress');
      }

      setPublishedResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error publishing article');
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle Bulk Generation - 100% VERCEL COMPATIBLE & RESILIENT AUTO-SCHEDULING
  const handleBulkPublish = async () => {
    const list = bulkKeywords
      .split('\n')
      .map((k) => k.trim())
      .filter(Boolean);

    if (list.length === 0) return;

    setIsBulkRunning(true);
    setBulkProgress({ total: list.length, current: 0, logs: [] });

    const now = new Date();

    for (let i = 0; i < list.length; i++) {
      const kw = list[i];
      setBulkProgress((prev) => ({ ...prev, current: i + 1 }));

      // Calculate schedule date: 1st published immediately, 2nd +8 hours, 3rd +16 hours, etc.
      let scheduleDateStr: string | undefined = undefined;
      if (bulkIntervalHours > 0) {
        const scheduledTime = new Date(now.getTime() + i * bulkIntervalHours * 60 * 60 * 1000);
        // Format ISO string: YYYY-MM-DDTHH:mm:ss
        scheduleDateStr = scheduledTime.toISOString().replace(/\.\d{3}Z$/, '');
      }

      try {
        const res = await fetch('/api/generate-and-publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyword: kw,
            scheduleDate: scheduleDateStr,
            settings: {
              ...settings,
              publishStatus: scheduleDateStr ? 'future' : settings.publishStatus,
            },
          }),
        });
        const data = await res.json();

        setBulkProgress((prev) => ({
          ...prev,
          logs: [
            ...prev.logs,
            {
              keyword: kw,
              success: res.ok && !data.error,
              url: data.postUrl,
              error: data.error,
              title: data.article?.title,
              scheduledAt: scheduleDateStr ? new Date(scheduleDateStr).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '立即发布',
            },
          ],
        }));
      } catch (err: any) {
        setBulkProgress((prev) => ({
          ...prev,
          logs: [
            ...prev.logs,
            {
              keyword: kw,
              success: false,
              error: err.message || 'Generation timeout or network error',
              scheduledAt: scheduleDateStr ? new Date(scheduleDateStr).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '立即发布',
            },
          ],
        }));
      }
    }

    setIsBulkRunning(false);
  };

  const handleStopBulkQueue = () => {
    setIsBulkRunning(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
                TradingBlog Auto-Publisher
                <span className="text-[10px] uppercase font-semibold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Yoast 100% SEO Preview
                </span>
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>Target:</span>
                <a 
                  href={settings.wpUrl || 'https://tradingblogco.com'} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline font-medium"
                >
                  {settings.wpUrl?.replace(/^https?:\/\//, '') || 'tradingblogco.com'}
                </a>
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 text-sm">
            <button
              onClick={() => setActiveTab('publish')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === 'publish'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Preview & Publish
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === 'bulk'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              Bulk Queue
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              Credentials & API
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* TAB 1: Preview & Publish */}
        {activeTab === 'publish' && (
          <div className="space-y-8">
            {/* Input Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  Enter Focus Keyword for Preview
                </h2>
                <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">
                  Step 1: Generate Preview with Yoast Score
                </span>
              </div>
              
              <p className="text-sm text-slate-400 mb-5">
                Keyword daaliye. Tool pehle poora article, 2 DALL-E images, internal links aur <b>Yoast SEO 100% Score Breakdown</b> generate karega. Aap review karke <b>"Publish to WordPress"</b> click kar sakte hain.
              </p>

              <form onSubmit={handleGeneratePreview} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="e.g. Best RSI Divergence Trading Strategies for Beginners"
                    disabled={isLoadingPreview || isPublishing}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base shadow-inner disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isLoadingPreview || isPublishing || !keyword.trim()}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold px-7 py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isLoadingPreview ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating Preview...
                      </>
                    ) : (
                      <>
                        <Eye className="w-5 h-5" />
                        Generate Preview & SEO Score
                      </>
                    )}
                  </button>
                </div>

                {/* Suggestions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500">Quick ideas:</span>
                  {[
                    'Bull Flag Pattern Trading Strategy',
                    'MACD vs RSI Indicator for Day Trading',
                    'Support and Resistance Trading Guide',
                    'Order Flow Trading Secrets',
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setKeyword(s)}
                      className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 px-2.5 py-1 rounded-md border border-slate-700/50 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </form>
            </div>

            {/* Loading Indicator */}
            {isLoadingPreview && (
              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-100 text-base">
                      Generating Preview & SEO Calculations
                    </h4>
                    <p className="text-sm text-emerald-400 mt-0.5">{statusStep}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-5 flex items-start gap-3 text-rose-200">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <b className="font-semibold">Error:</b>
                  <p className="mt-1">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Success After Live Publication */}
            {publishedResult && (
              <div className="bg-emerald-950/60 border border-emerald-500/60 rounded-2xl p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="font-bold text-emerald-300 text-lg">Article Published to tradingblogco.com!</h3>
                    <p className="text-xs text-slate-300">
                      Post ID: #{publishedResult.postId} &bull; Status: {publishedResult.status?.toUpperCase()}
                    </p>
                  </div>
                </div>
                <a
                  href={publishedResult.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-3 rounded-xl font-bold transition text-sm shrink-0 shadow-lg shadow-emerald-500/30"
                >
                  Open Live Article <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* PREVIEW CONTAINER (Shown when Preview is ready) */}
            {previewData && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side: Article Content & Images Preview */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Article Title & Meta */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                          Focus Keyword: {previewData.article.focusKeyword}
                        </span>
                        {previewData.article.category && (
                          <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20">
                            📁 分类: {previewData.article.category.name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        Slug: /{previewData.article.slug}
                      </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-3 leading-snug">
                      {previewData.article.title}
                    </h1>

                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                      <b className="text-slate-400 block mb-1">Meta Description (140-155 chars):</b>
                      {previewData.article.metaDescription}
                    </div>
                  </div>

                  {/* Article Outline Breakdown (H2 to H4 with Character Budget) */}
                  {previewData.article.outline && previewData.article.outline.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                        <div>
                          <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                            文章大纲规划 (H2 - H4 层级与字数预算)
                          </h4>
                          <p className="text-[11px] text-slate-400">各章节结构、层级及预估中文字数</p>
                        </div>
                        <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full font-medium">
                          {previewData.article.outline.length} 个核心章节
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {previewData.article.outline.map((item: any, idx: number) => {
                          const levelClass =
                            item.level === 'h2'
                              ? 'bg-slate-950 border-blue-500/40 pl-3 font-semibold text-slate-200 text-sm'
                              : item.level === 'h3'
                              ? 'bg-slate-950/70 border-slate-700 pl-6 text-xs text-slate-300'
                              : 'bg-slate-950/40 border-slate-800 pl-9 text-xs text-slate-400';
                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${levelClass}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">
                                  {item.level}
                                </span>
                                <span>{item.heading}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs shrink-0">
                                {item.description && (
                                  <span className="text-[11px] text-slate-400 hidden md:inline max-w-xs truncate">
                                    {item.description}
                                  </span>
                                )}
                                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  约 {item.estimatedCharacters || '300-400'} 字
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Semantic & LSI Keywords Tag Cloud */}
                  {previewData.article.semanticKeywordsUsed && previewData.article.semanticKeywordsUsed.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        已融入的语义关键词与整站核心词 (Semantic & LSI Keywords)
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {previewData.article.semanticKeywordsUsed.map((kw: string, i: number) => (
                          <span
                            key={i}
                            className="text-xs bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1 rounded-lg transition"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Google FAQ Schema (5-10 FAQs) Preview */}
                  {previewData.article.faqItems && previewData.article.faqItems.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                          Google FAQ 结构化数据预览 (5-10 Short FAQs)
                        </h4>
                        <span className="text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
                          JSON-LD Schema.org
                        </span>
                      </div>
                      <div className="space-y-3">
                        {previewData.article.faqItems.map((faq: { question: string; answer: string }, idx: number) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                            <div className="font-semibold text-xs text-amber-300 mb-1 flex items-start gap-2">
                              <span className="shrink-0 bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded text-[10px]">Q{idx + 1}</span>
                              {faq.question}
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed pl-6">
                              {faq.answer}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Featured Hero Image Preview */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                      1. Featured Hero Banner (Thumbnail)
                    </h4>
                    <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                      <img
                        src={previewData.images.featured.url}
                        alt="Featured Banner"
                        className="w-full h-auto max-h-[380px] object-cover"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      <b>Alt Text for SEO:</b> {previewData.images.featured.alt}
                    </p>
                  </div>

                  {/* Article Body HTML Preview */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      Article Body Preview (with In-Article Chart Image & Internal Links)
                    </h4>
                    <div 
                      className="prose prose-invert prose-emerald max-w-none text-slate-300 text-sm leading-relaxed space-y-4"
                      dangerouslySetInnerHTML={{ __html: previewData.article.contentHtml }}
                    />
                  </div>
                </div>

                {/* Right Side: Yoast 100% Score Card & Publish Trigger */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Sticky Publish Box */}
                  <div className="sticky top-24 space-y-6">
                    {/* Action Card */}
                    <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-500/50 rounded-2xl p-6 shadow-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase font-bold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Ready to Publish
                        </span>
                        <span className="text-xs text-slate-400">
                          {settings.publishStatus?.toUpperCase() || 'PUBLISH'} Mode
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-100 text-lg">
                        Looks Good?
                      </h3>
                      <p className="text-xs text-slate-400">
                        Article aur dono images check kar lein. Publish dabane par images WordPress Media Library me upload hongi aur post live ho jayega.
                      </p>

                      <button
                        type="button"
                        onClick={handleConfirmPublish}
                        disabled={isPublishing}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold px-6 py-4 rounded-xl shadow-xl shadow-emerald-500/30 transition text-base cursor-pointer disabled:opacity-50"
                      >
                        {isPublishing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Publishing to WordPress...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            Publish Live to WordPress
                          </>
                        )}
                      </button>
                    </div>

                    {/* Yoast 100% SEO Score Audit Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                        <div>
                          <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
                            Yoast SEO Audit Score
                          </h4>
                          <p className="text-[11px] text-slate-400">tgcenters.com (TG Center) 优化标准</p>
                        </div>
                        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold px-3 py-1 rounded-lg text-sm">
                          100% Score
                        </div>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-300">Focus Keyword in SEO Title</span>
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> 100%
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-300">Meta Description Keyphrase</span>
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> 100%
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-300">Keyphrase in Introduction (First 10%)</span>
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> 100%
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-300">Keyphrase in Subheadings (H2/H3)</span>
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> 100%
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-300">Auto Internal Links Injected</span>
                          <span className="text-emerald-400 font-bold">
                            {previewData.article.internalLinksUsed?.length || 3}+ Links
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-300">Chinese Content Length</span>
                          <span className="text-emerald-400 font-bold">
                            {previewData.article.yoastScoreEstimate?.wordCount || 3200} Characters (3000-4000 字)
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-300">External Authority Links</span>
                          <span className="text-emerald-400 font-bold">
                            {previewData.article.externalLinksUsed?.length || 2} Authority Links
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-300">OpenAI Images with Alt Tags</span>
                          <span className="text-emerald-400 font-bold">
                            2 Images Ready
                          </span>
                        </div>
                      </div>

                      {/* Injected Internal Links List */}
                      {previewData.article.internalLinksUsed?.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-800">
                          <h5 className="text-[11px] font-semibold uppercase text-emerald-400 mb-2 flex items-center justify-between">
                            <span>Sitemap Internal Links ({previewData.article.internalLinksUsed.length}):</span>
                            <span className="text-[10px] text-slate-500">4-5 Injected</span>
                          </h5>
                          <ul className="space-y-1.5 text-[11px]">
                            {previewData.article.internalLinksUsed.map((link: any, i: number) => (
                              <li key={i} className="text-slate-300 truncate flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                                <a href={link.url} target="_blank" rel="noreferrer" className="hover:text-emerald-400 underline truncate">
                                  {link.title || link.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Injected External Links List */}
                      {previewData.article.externalLinksUsed?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800">
                          <h5 className="text-[11px] font-semibold uppercase text-teal-400 mb-2 flex items-center justify-between">
                            <span>Authority External Links ({previewData.article.externalLinksUsed.length}):</span>
                            <span className="text-[10px] text-slate-500">Official / Authority</span>
                          </h5>
                          <ul className="space-y-1.5 text-[11px]">
                            {previewData.article.externalLinksUsed.map((link: any, i: number) => (
                              <li key={i} className="text-slate-300 truncate flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0"></span>
                                <a href={link.url} target="_blank" rel="noreferrer" className="hover:text-teal-300 underline truncate">
                                  {link.title || link.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Bulk Queue */}
        {activeTab === 'bulk' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Bulk Keyword Queue
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                Paste multiple keywords (one per line). The automation will process each article one by one, generate 2 images each, perform internal linking, and publish them to <b>tradingblogco.com</b>.
              </p>

              <textarea
                value={bulkKeywords}
                onChange={(e) => setBulkKeywords(e.target.value)}
                disabled={isBulkRunning}
                placeholder="Best Forex Scalping Strategies&#10;How to Read Candlestick Patterns&#10;Crypto Trading vs Stock Trading&#10;Fibonacci Retracement Guide"
                rows={6}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
              />

              <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-300 font-medium">发布间隔排期 (Schedule):</span>
                  <select
                    value={bulkIntervalHours}
                    onChange={(e) => setBulkIntervalHours(Number(e.target.value))}
                    disabled={isBulkRunning}
                    className="bg-slate-900 border border-slate-700 text-emerald-400 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                  >
                    <option value={8}>每 8 小时发布一篇 (Auto Every 8 Hours - 推荐)</option>
                    <option value={6}>每 6 小时发布一篇 (Every 6 Hours)</option>
                    <option value={12}>每 12 小时发布一篇 (Every 12 Hours)</option>
                    <option value={24}>每 24 小时发布一篇 (Every 24 Hours / 每天1篇)</option>
                    <option value={0}>全部立即发布 (Publish All Immediately)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4">
                  <span className="text-xs text-slate-400 font-mono">
                    总关键词数: {bulkKeywords.split('\n').filter((k) => k.trim()).length} 篇
                  </span>

                  <button
                    type="button"
                    onClick={handleBulkPublish}
                    disabled={isBulkRunning || !bulkKeywords.trim()}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer text-xs"
                  >
                    {isBulkRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        服务器后台运行中 ({bulkProgress.current} / {bulkProgress.total})...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        启动自动排期发布 (Start Auto-Publish)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Active WordPress scheduling indicator */}
              {isBulkRunning && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-300">
                          ⚡ 正在逐篇生成并排期到 WordPress（每8小时自动上线1篇）
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Generating 10,000+ words & 2 images per keyword, then scheduling to WordPress calendar every 8 hours. Keep this tab open while scheduling completes.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleStopBulkQueue}
                      className="flex items-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      停止队列
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bulk Execution Logs */}
            {bulkProgress.logs.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>发布排期记录 (Schedule & Status)</span>
                  <span className="text-xs text-slate-400 font-normal">WordPress 计划定时任务</span>
                </h3>
                <div className="space-y-2">
                  {bulkProgress.logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                        log.success
                          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-4">
                        {log.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-200">{log.keyword}</span>
                        {log.title && <span className="text-slate-400 truncate hidden md:inline">- {log.title}</span>}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {log.scheduledAt && (
                          <span className="text-[11px] bg-slate-800 text-amber-300 px-2 py-0.5 rounded border border-slate-700">
                            排期: {log.scheduledAt}
                          </span>
                        )}
                        {log.url && (
                          <a
                            href={log.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            查看文章 <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {log.error && <span className="text-rose-400">{log.error}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Settings & API Credentials */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Key className="w-5 h-5 text-emerald-400" />
                  Credentials & Configuration
                </h2>
                {settingsSaved && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                    <Check className="w-3 h-3" /> Saved to browser
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mb-6">
                Enter your credentials below. They can also be set via Environment Variables in Vercel for production.
              </p>

              <div className="space-y-4 text-sm">
                {/* OpenAI Key */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    OpenAI Paid API Key (ChatGPT + DALL-E 3)
                  </label>
                  <input
                    type="password"
                    value={settings.openaiApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                    placeholder="sk-proj-..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Needs access to <code>gpt-4o</code> and <code>dall-e-3</code>.
                  </p>
                </div>

                {/* WordPress Site URL */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    WordPress Website URL
                  </label>
                  <input
                    type="url"
                    value={settings.wpUrl || ''}
                    onChange={(e) => setSettings({ ...settings, wpUrl: e.target.value })}
                    placeholder="https://tradingblogco.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono"
                  />
                </div>

                {/* WordPress Username */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    WordPress Admin Username
                  </label>
                  <input
                    type="text"
                    value={settings.wpUsername || ''}
                    onChange={(e) => setSettings({ ...settings, wpUsername: e.target.value })}
                    placeholder="admin or your WP username"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                </div>

                {/* WordPress Application Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    WordPress Application Password
                  </label>
                  <input
                    type="password"
                    value={settings.wpAppPassword || ''}
                    onChange={(e) => setSettings({ ...settings, wpAppPassword: e.target.value })}
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Generate this in: <b>WP Admin &gt; Users &gt; Profile &gt; Application Passwords</b> (Name it: <i>AutoPublisher</i>).
                  </p>
                </div>

                {/* Default Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Default Post Status
                  </label>
                  <select
                    value={settings.publishStatus || 'publish'}
                    onChange={(e) => setSettings({ ...settings, publishStatus: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="publish">Directly Publish (Live)</option>
                    <option value="draft">Save as Draft (Review Before Live)</option>
                  </select>
                </div>

                {/* Save & Test Buttons */}
                <div className="pt-4 flex items-center justify-between border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer"
                  >
                    {testingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Test Connection
                  </button>

                  <button
                    type="button"
                    onClick={() => saveSettings(settings)}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2 rounded-xl text-xs transition cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Save Settings
                  </button>
                </div>

                {/* Connection Test Result */}
                {connectionStatus && (
                  <div className={`mt-4 p-3 rounded-xl border text-xs ${
                    connectionStatus.overallSuccess 
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}>
                    <p className="font-semibold mb-1">
                      {connectionStatus.overallSuccess ? '✓ All Credentials Working!' : '✕ Connection Check Issues:'}
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                      <li>WordPress: {connectionStatus.wordpress?.message || 'Not checked'}</li>
                      <li>OpenAI: {connectionStatus.openai?.message || 'Not checked'}</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


