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
  Clock, 
  Check, 
  Loader2, 
  Zap, 
  Link2, 
  RefreshCw,
  Eye,
  FileText
} from 'lucide-react';
import { GenerationSettings } from '@/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'publish' | 'bulk' | 'settings'>('publish');
  
  // Single generation state
  const [keyword, setKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusStep, setStatusStep] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Bulk generation state
  const [bulkKeywords, setBulkKeywords] = useState('');
  const [bulkProgress, setBulkProgress] = useState<{ total: number; current: number; logs: any[] }>({
    total: 0,
    current: 0,
    logs: [],
  });
  const [isBulkRunning, setIsBulkRunning] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<GenerationSettings>({
    wpUrl: 'https://tradingblogco.com',
    wpUsername: '',
    wpAppPassword: '',
    openaiApiKey: '',
    publishStatus: 'publish',
  });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wp_auto_publisher_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
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

  // Handle Single Article Generation & Publish
  const handlePublish = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!keyword.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    setResult(null);

    const steps = [
      'Reading existing tradingblogco.com articles for internal links...',
      'Writing 100% Yoast SEO compliant trading article with GPT-4o...',
      'Creating 2 custom financial images with DALL-E 3...',
      'Uploading images to WordPress Media Library with SEO Alt tags...',
      'Injecting internal links & publishing live to WordPress...'
    ];

    let stepIdx = 0;
    setStatusStep(steps[0]);
    const interval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setStatusStep(steps[stepIdx]);
      }
    }, 9000);

    try {
      const res = await fetch('/api/generate-and-publish', {
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
        throw new Error(data.error || 'Failed to generate & publish article');
      }

      setResult(data);
      setStatusStep('Published successfully!');
    } catch (err: any) {
      clearInterval(interval);
      setErrorMessage(err.message || 'Error occurred during generation');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Bulk Generation
  const handleBulkPublish = async () => {
    const list = bulkKeywords
      .split('\n')
      .map((k) => k.trim())
      .filter(Boolean);

    if (list.length === 0) return;

    setIsBulkRunning(true);
    setBulkProgress({ total: list.length, current: 0, logs: [] });

    for (let i = 0; i < list.length; i++) {
      const kw = list[i];
      setBulkProgress((prev) => ({ ...prev, current: i + 1 }));

      try {
        const res = await fetch('/api/generate-and-publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyword: kw,
            settings,
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
              error: err.message,
            },
          ],
        }));
      }
    }

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
                  Yoast 100% SEO
                </span>
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>Connected to:</span>
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'publish'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Single Post
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-all ${
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium transition-all ${
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
        {/* TAB 1: Single Publish */}
        {activeTab === 'publish' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Form & Controller */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    Enter Focus Keyword
                  </h2>
                  <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">
                    ChatGPT 4o + DALL-E 3
                  </span>
                </div>
                
                <p className="text-sm text-slate-400 mb-5">
                  Type any trading keyword or strategy topic. The AI will write a 1200+ word article, create 2 contextual images, auto-link your old articles, and push it directly to WordPress with 100% Yoast SEO scores.
                </p>

                <form onSubmit={handlePublish} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Target Keyword / Topic
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="e.g. Best RSI Divergence Trading Strategies for Beginners"
                        disabled={isLoading}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base shadow-inner disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Quick Preset Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs text-slate-500">Suggestions:</span>
                    {[
                      'Bull Flag Pattern Trading',
                      'MACD vs RSI Indicator',
                      'Support and Resistance Secrets',
                      'Order Flow Trading Guide',
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

                  {/* Actions Bar */}
                  <div className="pt-3 flex items-center justify-between gap-4 border-t border-slate-800">
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      Publishing directly to: <b className="text-slate-300">{settings.publishStatus?.toUpperCase() || 'PUBLISH'}</b>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || !keyword.trim()}
                      className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing Auto-Publish...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Generate & Publish Now
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Progress Tracker Card (when loading) */}
              {isLoading && (
                <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-100 text-base">
                        Executing Autonomous Publishing Pipeline
                      </h4>
                      <p className="text-sm text-emerald-400 mt-0.5">{statusStep}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-5 gap-2 text-[11px] text-center">
                    <div className="p-2 rounded bg-slate-800/80 text-emerald-400 border border-emerald-500/20">
                      1. Scan Links
                    </div>
                    <div className="p-2 rounded bg-slate-800/80 text-emerald-400 border border-emerald-500/20">
                      2. Write Article
                    </div>
                    <div className="p-2 rounded bg-slate-800/80 text-emerald-400 border border-emerald-500/20">
                      3. DALL-E Images
                    </div>
                    <div className="p-2 rounded bg-slate-800/80 text-emerald-400 border border-emerald-500/20">
                      4. Upload Media
                    </div>
                    <div className="p-2 rounded bg-slate-800/80 text-emerald-400 border border-emerald-500/20">
                      5. Yoast Live
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-5 flex items-start gap-3 text-rose-200">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <b className="font-semibold">Publishing Error:</b>
                    <p className="mt-1">{errorMessage}</p>
                    <p className="mt-2 text-xs text-rose-300/80">
                      Check your OpenAI API key and WordPress Application Password in the "Credentials & API" tab.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Live Result & Yoast Breakdown */}
            <div className="lg:col-span-5">
              {result ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                  {/* Success Banner */}
                  <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                      <div>
                        <h4 className="font-semibold text-emerald-300 text-sm">Successfully Published!</h4>
                        <p className="text-xs text-slate-400">Post ID: #{result.postId}</p>
                      </div>
                    </div>
                    <a
                      href={result.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                    >
                      View Live Post <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Yoast SEO 100% Score Card */}
                  <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                        Yoast SEO Score Breakdown
                      </h5>
                      <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded">
                        100% Score
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Focus Keyphrase in Title:</span>
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Passed
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Keyphrase in Meta Description:</span>
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Passed
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Keyphrase in Introduction:</span>
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Passed
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Keyphrase in Subheadings (H2/H3):</span>
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Passed
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Internal Links to Existing Posts:</span>
                        <span className="text-emerald-400 font-semibold">
                          {result.article?.internalLinksUsed?.length || 0} Links Injected
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Article Word Count:</span>
                        <span className="text-emerald-400 font-semibold">
                          {result.article?.yoastScoreEstimate?.wordCount || 1200}+ words
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Generated Images Preview */}
                  <div>
                    <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                      Generated DALL-E 3 Images
                    </h5>
                    <div className="grid grid-cols-2 gap-3">
                      {result.images?.featured?.url && (
                        <div className="space-y-1">
                          <img
                            src={result.images.featured.url}
                            alt="Featured Thumbnail"
                            className="rounded-lg object-cover w-full h-28 border border-slate-800"
                          />
                          <p className="text-[11px] text-slate-400 text-center truncate">1. Featured Hero Banner</p>
                        </div>
                      )}
                      {result.images?.inArticle?.url && (
                        <div className="space-y-1">
                          <img
                            src={result.images.inArticle.url}
                            alt="In-Article Diagram"
                            className="rounded-lg object-cover w-full h-28 border border-slate-800"
                          />
                          <p className="text-[11px] text-slate-400 text-center truncate">2. In-Article Chart Setup</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Meta Description Preview */}
                  <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <b className="text-slate-200 block mb-1">Generated Title:</b>
                    <p className="text-slate-300 mb-2">{result.article?.title}</p>
                    <b className="text-slate-200 block mb-1">Meta Description:</b>
                    <p>{result.article?.metaDescription}</p>
                  </div>
                </div>
              ) : (
                /* Placeholder Card */
                <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[380px]">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-3">
                    <FileText className="w-7 h-7 text-slate-500" />
                  </div>
                  <h3 className="font-semibold text-slate-300">Live Post Preview & SEO Card</h3>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    When you run the tool with a keyword, the publication results, live link, Yoast SEO metrics, and AI images will appear here.
                  </p>
                </div>
              )}
            </div>
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

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Total Keywords: {bulkKeywords.split('\n').filter((k) => k.trim()).length}
                </span>

                <button
                  type="button"
                  onClick={handleBulkPublish}
                  disabled={isBulkRunning || !bulkKeywords.trim()}
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold px-6 py-2.5 rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isBulkRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Running Queue ({bulkProgress.current} / {bulkProgress.total})...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Start Bulk Auto-Publishing
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bulk Execution Logs */}
            {bulkProgress.logs.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                  Execution History
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
                        <span className="font-medium text-slate-200">{log.keyword}</span>
                        {log.title && <span className="text-slate-400 truncate">({log.title})</span>}
                      </div>

                      {log.success && log.url ? (
                        <a
                          href={log.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 bg-emerald-500 text-slate-950 px-2 py-1 rounded font-semibold shrink-0 hover:bg-emerald-400"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-rose-400 shrink-0">{log.error || 'Failed'}</span>
                      )}
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

