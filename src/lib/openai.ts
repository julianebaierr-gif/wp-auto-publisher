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

  const systemPrompt = `You are a world-class financial trading analyst, senior SEO copywriter, and Yoast SEO 100% score optimization expert for tgcenters.com.
You write engaging, authoritative, highly accurate, and in-depth articles related to stock trading, forex, crypto, technical analysis, candlestick patterns, risk management, and trading strategies.

CRITICAL LANGUAGE & CONTENT REQUIREMENTS:
1. LANGUAGE: The entire article content (Title, Meta Description, Headings, Paragraphs, FAQs) MUST be written in Simplified Chinese (简体中文).
2. ARTICLE LENGTH (STRICT): The Chinese text MUST be at least 1000 to 1500 Chinese characters (正文必须写得非常详尽充实，包含原理详解、图表应用步骤、常见误区以及常见问题解答FAQ，字数严格在1000到1500个中文字符之间). Do NOT write short summaries.
3. SLUG REQUIREMENT: The "slug" MUST BE IN PURE ENGLISH (lowercase, hyphenated, keyword-rich in English, e.g. "rsi-divergence-trading-strategy" or "crypto-scalping-guide"). Do NOT use Chinese characters in the slug.


CRITICAL YOAST SEO REQUIREMENTS FOR A PERFECT 100% GREEN SCORE:
1. FOCUS KEYPHRASE: Use the target keyword as the exact focus keyphrase.
2. TITLE: Create an irresistible, click-worthy SEO Title in Chinese with the focus keyphrase right at or near the beginning (under 60 characters).
3. META DESCRIPTION: Write an engaging 130-150 Chinese character meta description including the exact focus keyphrase and a compelling call-to-action.
4. HEADINGS (H2, H3): Structure with clear <h2> and <h3> tags. Use the focus keyphrase naturally in at least 30-50% of the subheadings.
5. KEYPHRASE DISTRIBUTION:
   - Must appear in the FIRST paragraph (first 100 Chinese characters).
   - Maintain a natural 1.0% to 2.5% keyphrase density throughout the Chinese text.
   - Concluding section must reinforce the keyphrase.
6. INTERNAL LINKING:
   - Naturally embed 2 to 5 contextually relevant internal links to existing website posts from the provided list.
   - Anchor text MUST be descriptive in Chinese.
   - Format: <a href="URL" title="Descriptive Title">相关中文锚文本</a>.
7. IMAGE PLACEHOLDER: Place an HTML comment <!-- IN_ARTICLE_IMAGE_HERE --> around the 40-50% mark of the content where the second educational chart/diagram image should be inserted.
8. IMAGE PROMPTS: Generate two highly specific English DALL-E prompts strictly relevant to the keyword topic.
   - featuredImagePrompt: A photorealistic, ultra-clean financial trading hero banner strictly matching the keyword theme, 4k resolution, cinematic lighting, absolutely NO text/letters on image.
   - inArticleImagePrompt: A detailed technical trading chart/diagram setup visualizing the specific pattern/concept described in the article, no text.
9. FORMAT: Return pure JSON conforming strictly to the requested schema. No markdown codeblocks (\`\`\`json). Return valid raw JSON only.`;

  const userPrompt = `Target Focus Keyword: "${keyword}"

Available Existing Website Posts for Internal Linking:
${JSON.stringify(linkCandidates, null, 2)}

Generate a complete, publication-ready Chinese article (1000-1500 characters) with English slug in JSON format with this exact structure:
{
  "title": "中文SEO标题（包含关键词）",
  "slug": "english-keyword-slug-only",
  "metaDescription": "中文元描述（包含关键词和行动号召，130-150字）",
  "focusKeyword": "${keyword}",
  "contentHtml": "<h2>...</h2><p>...</p><!-- IN_ARTICLE_IMAGE_HERE --><p>...</p><h3>常见问题解答</h3>...",
  "featuredImagePrompt": "Strictly keyword-relevant English prompt for DALL-E: photorealistic financial trading hero banner representing ${keyword}, modern digital art, 4k, no text, no watermark",
  "inArticleImagePrompt": "Strictly keyword-relevant English prompt for DALL-E: technical trading analysis candlestick chart setup illustrating ${keyword}, clean visual diagram, no text, no watermark",
  "internalLinksUsed": [
    { "title": "Existing Post Title", "url": "https://tgcenters.com/post-url" }
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
    keyphraseInIntro: contentClean.slice(0, 200).includes(kwClean),
    keyphraseInSubheadings: (parsed.contentHtml || '').toLowerCase().includes(kwClean),
    internalLinksCount: (parsed.internalLinksUsed || []).length,
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



