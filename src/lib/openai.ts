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

  const systemPrompt = `You are the chief tech editor, Telegram specialist, and Yoast SEO 100% score optimization expert for tgcenters.com (TG Center - Telegram中文版官网与使用指南中心).
tgcenters.com specializes in comprehensive Telegram guides, including Telegram app downloads (iOS, Android, Windows, Mac), registration tutorials, SMS verification code troubleshooting, Chinese language pack installation (中文语言包), privacy & security settings, groups, channels, and bot usage.

CRITICAL CONTENT & LENGTH REQUIREMENTS:
1. LANGUAGE: Entire article (Title, Meta Description, Headings, Detailed Content, Steps, FAQs) MUST be written in Simplified Chinese (简体中文).
2. ARTICLE LENGTH (STRICT 3000 - 4000 CHINESE CHARACTERS):
   - You MUST write a comprehensive, exhaustive, practical tutorial containing AT LEAST 3000 TO 4000 CHINESE CHARACTERS (中文正文字数严格在3000到4000中文字之间).
   - Detail every single step: Prerequisites, step-by-step operating instructions (iOS/Android/Desktop), official download sources, common error troubleshooting (e.g. Too Many Requests, SMS delayed), security tips, and a detailed 5-question FAQ section.
3. ENGLISH SLUG: The "slug" field MUST be in clean, lowercase, hyphenated English specifically matching the keyword (e.g. "telegram-download-guide", "telegram-chinese-setup-tutorial", "telegram-verification-code-solutions"). Strictly NO Chinese characters in the slug.

CRITICAL INTERNAL & EXTERNAL LINKING:
1. INTERNAL LINKS (4 to 5 MANDATORY):
   - You MUST select and embed EXACTLY 4 to 5 internal links from the provided list of tgcenters.com sitemap URLs.
   - Embed them naturally in the Chinese sentences with descriptive anchor text (e.g., <a href="https://tgcenters.com/telegram-download/" title="Telegram下载">Telegram官方客户端下载</a> or <a href="https://tgcenters.com/telegram-chinese-language/" title="Telegram中文语言包">Telegram中文汉化包</a>).
2. EXTERNAL OFFICIAL LINKS (AT LEAST 2 MANDATORY):
   - Include AT LEAST 2 authoritative official links (such as Telegram official site: https://telegram.org, Google Play Store, Apple App Store, or Wikipedia).
   - Format: <a href="https://telegram.org" target="_blank" rel="noopener noreferrer">Telegram官方网站</a>.

CRITICAL IMAGE GENERATION INSTRUCTIONS (FOR OPENAI IMAGE API):
- The images MUST be 100% strictly relevant to the exact keyword "${keyword}".
- Focus visually on modern tech/mobile messaging: Telegram blue theme, sleek smartphone interface, paper plane icon, chat bubbles, security shield, or verification screen.
- featuredImagePrompt: A sleek, high-end 3D modern tech graphic representing "${keyword}", featuring Telegram blue gradients, smartphone UI screen, clean minimal digital art, 4k, absolutely NO text or letters.
- inArticleImagePrompt: A clean, step-by-step tech infographic/diagram illustration specifically depicting the process of "${keyword}", modern UI mockup, no text.

FORMAT: Return pure JSON conforming strictly to the requested schema. No markdown codeblocks (\`\`\`json). Return valid raw JSON only.`;

  const userPrompt = `Target Focus Keyword: "${keyword}"

Available Existing tgcenters.com Sitemap URLs for Internal Linking (Choose 4 to 5):
${JSON.stringify(linkCandidates, null, 2)}

Generate the complete 3000-4000 character in-depth Chinese Telegram guide in valid JSON format:
{
  "title": "Telegram相关SEO标题（包含关键词，如：Telegram下载安装与注册教程）",
  "slug": "english-keyword-slug-only",
  "metaDescription": "中文元描述（包含关键词，130-150字）",
  "focusKeyword": "${keyword}",
  "contentHtml": "<h2>...</h2><p>...</p><!-- IN_ARTICLE_IMAGE_HERE --><p>...</p>...",
  "featuredImagePrompt": "High quality English prompt for OpenAI image: modern 3D tech concept representing ${keyword} with Telegram blue theme, sleek smartphone UI, clean aesthetic, no text, no watermark",
  "inArticleImagePrompt": "High quality English prompt for OpenAI image: technical workflow illustration of ${keyword}, modern digital app mockup, clean style, no text, no watermark",
  "internalLinksUsed": [
    { "title": "Sitemap Page Title 1", "url": "https://tgcenters.com/..." },
    { "title": "Sitemap Page Title 2", "url": "https://tgcenters.com/..." },
    { "title": "Sitemap Page Title 3", "url": "https://tgcenters.com/..." },
    { "title": "Sitemap Page Title 4", "url": "https://tgcenters.com/..." }
  ],
  "externalLinksUsed": [
    { "title": "Telegram官网", "url": "https://telegram.org" },
    { "title": "Wikipedia Telegram", "url": "https://en.wikipedia.org/wiki/Telegram_(software)" }
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
    safeSlug = 'telegram-guide';
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
 * Generate image ONLY via OpenAI API with lowest cost (gpt-image-1-mini / gpt-image-1 / dall-e-3)
 * Cost is minimal (~$0.01 - $0.03 per image)
 */
export async function generateDalleImage({
  prompt,
  aspect = '1024x1024',
  apiKey,
}: {
  prompt: string;
  aspect?: '1024x1024' | '1792x1024' | '1024x1792';
  apiKey?: string;
}): Promise<string> {
  const openai = getOpenAIClient(apiKey);

  // 1. Try gpt-image-1-mini (Lowest cost, super fast, strictly OpenAI)
  try {
    console.log('Generating image using OpenAI gpt-image-1-mini (lowest cost tier)...');
    const response = await openai.images.generate({
      model: 'gpt-image-1-mini',
      prompt: `${prompt}. High resolution 3D digital art, Telegram blue aesthetic, clean modern tech UI, strictly no words, no letters, no watermark.`,
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
    console.warn(`gpt-image-1-mini notice (${err.message}), trying gpt-image-1...`);
  }

  // 2. Try gpt-image-1
  try {
    console.log('Generating image using OpenAI gpt-image-1...');
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: `${prompt}. High resolution digital art, clean Telegram mobile UI, absolutely no text, no watermark.`,
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
    console.warn(`gpt-image-1 notice (${err.message}), trying dall-e-3...`);
  }

  // 3. Try dall-e-3 as fallback
  try {
    console.log('Generating image using OpenAI dall-e-3...');
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `${prompt}. Ultra-high resolution, Telegram tech theme, strictly no text, no watermark.`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const imageUrl = response.data?.[0]?.url;
    if (imageUrl) return imageUrl;
  } catch (err: any) {
    throw new Error(`OpenAI Image Generation Error: ${err.message}`);
  }

  throw new Error('OpenAI Image Generation did not return an image.');
}




