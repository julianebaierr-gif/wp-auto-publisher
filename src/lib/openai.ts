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

  // Prepare top internal link candidates with full Chinese context
  const linkCandidates = existingPosts.slice(0, 30).map((p) => ({
    title: p.title.replace(/<[^>]*>?/gm, '').trim(),
    url: p.link,
  }));

  const systemPrompt = `You are the chief tech editor, Telegram ecosystem specialist, and Yoast SEO 100% score optimization expert for tgcenters.com (TG Center - Telegram中文版官网与使用指南中心).
tgcenters.com is an authoritative portal dedicated solely to Telegram guides in Chinese: Telegram app downloads (iOS/Android/Windows/macOS), registration and SMS verification code troubleshooting (收不到验证码), Chinese language pack installation (中文语言包设置/汉化), privacy and security protection (隐私设置/两步验证), supergroups, broadcast channels, and bots.

CRITICAL WRITING REQUIREMENTS:
1. LANGUAGE: Entire article (Title, Meta Description, Headings, Detailed Content, FAQ) MUST be written in Simplified Chinese (简体中文).
2. OUTLINE FIRST (H2 TO H4 WITH CHINESE CHARACTER BUDGET):
   - You MUST first design a comprehensive, structured hierarchical outline (H2 to H4).
   - For every section in the outline, specify its heading, level ('h2'|'h3'|'h4'), estimated character count (预算中文字数 e.g. 350-500字), and a brief description.
3. IN-DEPTH, PARAGRAPH-RICH CONTENT (STRICT 3000 - 4000 CHINESE CHARACTERS):
   - Total body content MUST be between 3000 and 4000 Chinese characters (字数严格在3000至4000中文字之间，不能低于3000字).
   - DO NOT just write brief bullet points or quick 1-sentence summaries! Each section and subsection must consist of multiple rich, comprehensive paragraphs (每小节至少写2-3个详细段落) covering step-by-step guidance, common pitfalls, troubleshooting steps, pro tips, and security recommendations.
   - Expand extensively on real-world details so the total Chinese text exceeds 3000 characters.
4. RICH SEMANTIC & LSI KEYWORDS:
   - Heavily incorporate relevant semantic keywords and LSI terms throughout the outline and content (e.g., Telegram中文版, 电报下载, 纸飞机, 验证码接收, 双重认证, 隐藏手机号, 官方正版, 苹果ID切换, 安卓APK安装, 桌面端同步, 频道订阅, 群组管理).
   - Also actively incorporate the keywords of already published articles on the site so that internal linking happens completely naturally and contextually.
5. SMART CHINESE KEYWORD INTERNAL LINKING (4 TO 5 MANDATORY):
   - You MUST embed 4 to 5 internal links from the provided tgcenters.com sitemap list.
   - Anchor text MUST be natural Chinese keywords (e.g., <a href="https://tgcenters.com/telegram-download/" title="Telegram下载">Telegram官方下载</a>, <a href="https://tgcenters.com/telegram-chinese-language/" title="Telegram中文包设置">Telegram中文语言包设置</a>, <a href="https://tgcenters.com/telegram-verification-code-not-received/" title="Telegram收不到验证码">Telegram收不到验证码解决方法</a>, <a href="https://tgcenters.com/telegram-privacy-settings/" title="Telegram隐私设置">Telegram隐私与安全设置</a>).
   - If a sentence does not naturally contain the exact keyword, smartly weave the keyword and surrounding context into the paragraph, then place the anchor link.
6. AUTHORITATIVE EXTERNAL LINKS (AT LEAST 2 MANDATORY):
   - Smartly link to 2 official/authoritative external sources using natural Chinese anchor text (e.g., <a href="https://telegram.org" target="_blank" rel="noopener noreferrer">Telegram官方网站 (telegram.org)</a>, Apple App Store, Google Play, or Wikipedia).
7. ENGLISH SLUG: The "slug" field MUST be clean, lowercase, hyphenated English specifically representing the focus keyword (e.g., "telegram-download-and-registration-guide"). Strictly NO Chinese in slug.
8. OPENAI IMAGE PROMPTS (gpt-image-1-mini):
   - Generate 2 English prompts for OpenAI Image API specifically matching "${keyword}" with Telegram blue aesthetic, sleek app UI mockup, modern 3D tech, no words, no letters, no watermark.

FORMAT: Return valid raw JSON only conforming strictly to schema. No markdown codeblocks (\`\`\`json).`;

  const userPrompt = `Target Focus Keyword: "${keyword}"

Available Existing tgcenters.com Sitemap Pages for Context & Internal Linking:
${JSON.stringify(linkCandidates, null, 2)}

Generate the complete outline, semantic keywords, and 3000-4000 character in-depth Chinese Telegram guide in JSON format:
{
  "title": "Telegram SEO中文标题（包含关键词）",
  "slug": "english-keyword-slug-only",
  "metaDescription": "中文元描述（包含关键词，130-155字）",
  "focusKeyword": "${keyword}",
  "semanticKeywordsUsed": ["Telegram中文版", "电报注册", "验证码", "..."],
  "outline": [
    { "level": "h2", "heading": "一、...", "estimatedCharacters": 400, "description": "详细阐述..." },
    { "level": "h3", "heading": "1.1 ...", "estimatedCharacters": 350, "description": "深入讲解..." },
    { "level": "h4", "heading": "1.1.1 ...", "estimatedCharacters": 250, "description": "具体步骤与注意事项..." }
  ],
  "contentHtml": "<h2>...</h2><p>...</p><!-- IN_ARTICLE_IMAGE_HERE --><p>...</p>...",
  "featuredImagePrompt": "High quality English prompt for OpenAI image: modern 3D tech concept representing ${keyword} with Telegram blue theme, sleek smartphone UI, clean aesthetic, no text, no watermark",
  "inArticleImagePrompt": "High quality English prompt for OpenAI image: technical workflow illustration of ${keyword}, modern digital app mockup, clean style, no text, no watermark",
  "internalLinksUsed": [
    { "title": "页面标题", "url": "https://tgcenters.com/..." }
  ],
  "externalLinksUsed": [
    { "title": "Telegram官网", "url": "https://telegram.org" }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 6000,
    response_format: { type: 'json_object' },
  });

  const contentText = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(contentText);

  // Calculate actual Chinese word count
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
    outline: parsed.outline || [],
    semanticKeywordsUsed: parsed.semanticKeywordsUsed || [],
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




