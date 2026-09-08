import OpenAI from 'openai';
import { GeneratedArticle, WPPostSummary } from '@/types';

export function getOpenAIClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API Key is missing. Please provide it in settings or set OPENAI_API_KEY.');
  }
  return new OpenAI({ apiKey: key });
}

/**
 * Generate full SEO-optimized article with Yoast standards and internal links
 */
export async function generateSeoArticle({
  keyword,
  existingPosts,
  apiKey,
}: {
  keyword: string;
  existingPosts: WPPostSummary[];
  apiKey?: string;
}): Promise<GeneratedArticle> {
  const openai = getOpenAIClient(apiKey);

  // Prepare top internal link candidates (up to 30) for prompt
  const linkCandidates = existingPosts.slice(0, 35).map((p) => ({
    title: p.title.replace(/<[^>]*>?/gm, '').trim(),
    url: p.link,
  }));

  const systemPrompt = `You are an elite financial trading author, senior SEO strategist, and Yoast SEO 100% score optimization master for tgcenters.com.

CRITICAL CONTENT & LENGTH REQUIREMENTS:
1. LANGUAGE: Entire article (Title, Meta Description, Headings, Detailed Content, Bullet Points, Comparison Tables, Case Studies, FAQs) MUST be written in Simplified Chinese (简体中文).
2. ARTICLE LENGTH (STRICT 3000 - 4000 CHINESE CHARACTERS):
   - You MUST write a comprehensive, exhaustive, deep-dive article containing AT LEAST 3000 TO 4000 CHINESE CHARACTERS (中文正文字数必须严格在3000到4000字之间，内容必须极其充实，包含概念背景、技术指标构造、核心实战买卖法则、多周期图表分析、真实案例演示、止损止盈风控策略、高频交易陷阱以及详尽的FAQ常见问题解答).
3. ENGLISH SLUG: The "slug" field MUST be in clean, lowercase, hyphenated English matching the keyword (e.g. "macd-trading-strategy-complete-guide"). Strictly NO Chinese characters in the slug.

CRITICAL INTERNAL & EXTERNAL LINKING:
1. INTERNAL LINKS (4 to 5 MANDATORY):
   - You MUST select and embed EXACTLY 4 to 5 internal links from the provided list of website sitemap URLs into the content.
   - Embed them naturally in context with descriptive Chinese anchor text.
   - Format: <a href="URL" title="Descriptive Title">相关中文锚文本</a>.
2. EXTERNAL AUTHORITY LINKS (AT LEAST 2 MANDATORY):
   - You MUST include AT LEAST 2 authoritative external reference links to reputable financial/trading/official websites (such as TradingView, Investopedia, Wikipedia, or SEC/official docs) relevant to the topic.
   - Format: <a href="https://..." target="_blank" rel="noopener noreferrer">权威参考名称</a>.

CRITICAL IMAGE RELEVANCE (OPENAI DALL-E / GPT-IMAGE):
- The images MUST be 100% directly related to the specific keyword topic "${keyword}".
- If the keyword is about MACD, the image must strictly show MACD histogram and crossover lines.
- If the keyword is about candlestick patterns, show that exact candlestick formation.
- Do NOT generate generic or unrelated financial scenes.
- featuredImagePrompt: A photorealistic, high-end 3D financial trading chart visualization specifically showing "${keyword}", cinematic lighting, 4k resolution, absolutely NO text or letters on the image.
- inArticleImagePrompt: A clean technical analysis chart breakdown specifically demonstrating "${keyword}" entry and exit signals, clear visual candlestick diagram, no text.

FORMAT: Return pure JSON conforming strictly to the requested schema. No markdown codeblocks (\`\`\`json). Return valid raw JSON only.`;

  const userPrompt = `Target Focus Keyword: "${keyword}"

Available Existing Website Sitemap URLs for Internal Linking (Choose 4 to 5):
${JSON.stringify(linkCandidates, null, 2)}

Generate the complete 3000-4000 character in-depth Chinese article in valid JSON format:
{
  "title": "中文SEO标题（包含关键词，吸引点击）",
  "slug": "english-keyword-slug-only",
  "metaDescription": "中文元描述（包含关键词，130-150字）",
  "focusKeyword": "${keyword}",
  "contentHtml": "<h2>...</h2><p>...</p><!-- IN_ARTICLE_IMAGE_HERE --><p>...</p>...",
  "featuredImagePrompt": "Strictly keyword-specific English prompt for OpenAI image: high-end photorealistic 3D chart visualization specifically focusing on ${keyword}, modern financial theme, 4k, no text, no watermark",
  "inArticleImagePrompt": "Strictly keyword-specific English prompt for OpenAI image: technical chart diagram explicitly illustrating ${keyword} setup and candlestick patterns, clean analytical style, no text, no watermark",
  "internalLinksUsed": [
    { "title": "Sitemap Page Title", "url": "https://tgcenters.com/..." },
    { "title": "Sitemap Page Title 2", "url": "https://tgcenters.com/..." },
    { "title": "Sitemap Page Title 3", "url": "https://tgcenters.com/..." },
    { "title": "Sitemap Page Title 4", "url": "https://tgcenters.com/..." }
  ],
  "externalLinksUsed": [
    { "title": "Investopedia Reference", "url": "https://www.investopedia.com/..." },
    { "title": "TradingView Reference", "url": "https://www.tradingview.com/..." }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  const contentText = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(contentText);

  // Normalize spaces for Chinese keyword checking
  const pureChineseText = (parsed.contentHtml || '').replace(/<[^>]*>/g, '').replace(/\s+/g, '');
  const wordCount = pureChineseText.length;
  const kwClean = keyword.replace(/\s+/g, '').toLowerCase();
  const titleClean = (parsed.title || '').replace(/\s+/g, '').toLowerCase();
  const metaDescClean = (parsed.metaDescription || '').replace(/\s+/g, '').toLowerCase();
  const contentClean = (parsed.contentHtml || '').replace(/<[^>]*>/g, '').replace(/\s+/g, '').toLowerCase();

  const yoastScoreEstimate = {
    keyphraseInTitle: titleClean.includes(kwClean),
    keyphraseInMetaDesc: metaDescClean.includes(kwClean),
    keyphraseInIntro: contentClean.slice(0, 300).includes(kwClean),
    keyphraseInSubheadings: (parsed.contentHtml || '').toLowerCase().includes(kwClean),
    internalLinksCount: (parsed.internalLinksUsed || []).length,
    externalLinksCount: (parsed.externalLinksUsed || []).length,
    wordCount,
  };

  // Ensure slug is clean english
  let safeSlug = (parsed.slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  if (!safeSlug || safeSlug.length < 3) {
    safeSlug = 'crypto-trading-guide';
  }

  return {
    title: parsed.title,
    slug: safeSlug,
    metaDescription: parsed.metaDescription,
    focusKeyword: keyword,
    contentHtml: parsed.contentHtml,
    featuredImagePrompt: parsed.featuredImagePrompt,
    inArticleImagePrompt: parsed.inArticleImagePrompt,
    internalLinksUsed: parsed.internalLinksUsed || [],
    externalLinksUsed: parsed.externalLinksUsed || [],
    yoastScoreEstimate,
  };

}

/**
 * Generate image ONLY via OpenAI API (gpt-image-1 / dall-e-3 / dall-e-2)
 */
export async function generateDalleImage({
  prompt,
  aspect = '1792x1024',
  apiKey,
}: {
  prompt: string;
  aspect?: '1024x1024' | '1792x1024' | '1024x1792';
  apiKey?: string;
}): Promise<string> {
  const openai = getOpenAIClient(apiKey);

  // 1. Try gpt-image-1 first (verified supported on this project key)
  try {
    console.log('Generating image using OpenAI gpt-image-1...');
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: `${prompt}. High resolution digital art, clean financial charts, absolutely no text, no watermark.`,
      n: 1,
      size: '1024x1024',
    });

    const b64 = response.data?.[0]?.b64_json;
    if (b64) {
      return `data:image/png;base64,${b64}`;
    }
    const url = response.data?.[0]?.url;
    if (url) return url;
  } catch (err: any) {
    console.warn(`gpt-image-1 failed (${err.message}), trying dall-e-3...`);
  }

  // 2. Try dall-e-3
  try {
    console.log('Generating image using OpenAI dall-e-3...');
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `${prompt}. Ultra-high resolution, clean aesthetic, financial trading theme, cinematic lighting, professional digital art, strictly no words, no letters, no text, no watermark.`,
      n: 1,
      size: aspect,
      quality: 'standard',
    });

    const imageUrl = response.data?.[0]?.url;
    if (imageUrl) return imageUrl;
  } catch (err: any) {
    console.warn(`dall-e-3 failed (${err.message}), trying dall-e-2...`);
  }

  // 3. Fallback to dall-e-2
  try {
    console.log('Generating image using OpenAI dall-e-2...');
    const response = await openai.images.generate({
      model: 'dall-e-2',
      prompt: `${prompt.slice(0, 900)}. Ultra clean financial trading concept, professional digital art, strictly no words, no text.`,
      n: 1,
      size: '1024x1024',
    });

    const fallbackUrl = response.data?.[0]?.url;
    if (fallbackUrl) return fallbackUrl;
  } catch (err: any) {
    throw new Error(`OpenAI Image Generation Error: ${err.message}`);
  }

  throw new Error('OpenAI Image Generation did not return an image.');
}



