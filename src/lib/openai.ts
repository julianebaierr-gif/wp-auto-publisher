import OpenAI from 'openai';
import { GeneratedArticle, WPPostSummary, WPCategory } from '@/types';
import { autoDetermineCategory } from '@/lib/wordpress';

export function getOpenAIClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API Key is missing. Please set OPENAI_API_KEY or provide it in settings.');
  }
  return new OpenAI({
    apiKey: key,
  });
}

/**
 * Generate in-depth SEO Article using GPT-4o-mini
 * tgcenters.com standard: natural informative prose, NO numeric prefixes (no 1.1, 1.2, 一、二、),
 * in-depth explanatory paragraphs, auto-category matching, and smart internal linking.
 */
export async function generateSeoArticle({
  keyword,
  existingPosts,
  categories,
  apiKey,
}: {
  keyword: string;
  existingPosts: WPPostSummary[];
  categories?: WPCategory[];
  apiKey?: string;
}): Promise<GeneratedArticle> {
  const openai = getOpenAIClient(apiKey);

  // Prepare top internal link candidates with full Chinese context
  const linkCandidates = existingPosts.slice(0, 30).map((p) => ({
    title: p.title.replace(/<[^>]*>?/gm, '').trim(),
    url: p.link,
  }));

  const systemPrompt = `You are the chief tech editor, Telegram ecosystem specialist, and Yoast SEO 100% score optimization expert for tgcenters.com (TG Center - Telegram中文版官网与使用指南中心).
tgcenters.com is an authoritative informational portal dedicated solely to Telegram guides in Chinese: Telegram downloads, registration and SMS verification code troubleshooting, Chinese language pack installation, privacy and security settings, and group/channel management.

STRICT EDITORIAL & WRITING GUIDELINES (MODELED EXACTLY AFTER https://tgcenters.com/):
1. NO NUMERIC HEADINGS OR NUMBERED PREFIXES:
   - STRICTLY FORBIDDEN: Do NOT use numeric prefixes in headings, subheadings, or outlines!
   - NEVER write "一、", "二、", "三、", "1.", "2.", "1.1", "1.2", "1.1.1", or "步骤一".
   - Headings MUST be clean, natural, engaging descriptive phrases or natural questions just like on tgcenters.com (e.g., "Telegram收不到验证码怎么办? 先确认验证码发送位置", "验证码可能发送到已登录设备", "短信验证码和应用内验证码有什么区别？", "不要频繁点击重新发送验证码", "常见问题FAQ").

2. INFORMATIVE ESSAY STYLE (NO EXCESSIVE BULLET POINTS OR BOLD KEYWORD SPAM):
   - tgcenters.com is an authoritative informational resource. Content must be written in fluent, in-depth, explanatory narrative paragraphs (<p class="wp-block-paragraph">...</p>).
   - DO NOT write shallow bullet point lists or bold words every other sentence. Explain the underlying technical logic, user flow, practical solutions, and security implications in complete, informative paragraphs.

3. STRICT 3000 - 4000 CHINESE CHARACTERS LENGTH:
   - Total body content MUST be strictly between 3000 and 4000 Chinese characters (字数严格在3000至4000中文字之间，绝不能低于3000字).
   - Provide multi-paragraph in-depth explanations for every section covering step-by-step guidance, common misconceptions, network/carrier issues, device compatibility, and safety best practices.

4. RICH SEMANTIC & LSI KEYWORDS:
   - Naturally weave relevant semantic terms throughout the article (e.g., Telegram中文版, 电报下载, 纸飞机, 验证码接收, 双重认证, 隐藏手机号, 官方正版, 苹果ID切换, 安卓APK安装, 桌面端同步, 频道订阅, 群组管理).

5. SMART CHINESE KEYWORD INTERNAL LINKING (4 TO 5 MANDATORY):
   - Embed 4 to 5 internal links from the provided tgcenters.com sitemap pages.
   - Anchor text MUST be natural Chinese keywords (e.g., <a href="https://tgcenters.com/telegram-download/" title="Telegram下载">Telegram官方下载</a>, <a href="https://tgcenters.com/telegram-chinese-language/" title="Telegram中文包设置">Telegram中文语言包设置</a>, <a href="https://tgcenters.com/telegram-verification-code-not-received/" title="Telegram收不到验证码">Telegram收不到验证码解决方法</a>, <a href="https://tgcenters.com/telegram-privacy-settings/" title="Telegram隐私设置">Telegram隐私与安全设置</a>).

6. AUTHORITATIVE EXTERNAL LINKS (AT LEAST 2 MANDATORY):
   - Smartly link to 2 official external resources with natural Chinese anchor text (e.g., <a href="https://telegram.org" target="_blank" rel="noopener noreferrer">Telegram官方网站 (telegram.org)</a>, Apple App Store, or Google Play).

7. CLEAN ENGLISH SLUG:
   - The "slug" field MUST be clean, lowercase, hyphenated English (e.g., "telegram-usage-guide"). Strictly NO Chinese in slug.

8. OPENAI IMAGE PROMPTS (gpt-image-1-mini):
   - Generate 2 English prompts for OpenAI Image API specifically matching "${keyword}" with Telegram blue aesthetic, sleek app UI mockup, modern 3D tech, no words, no letters, no watermark.

FORMAT: Return valid raw JSON only conforming strictly to schema. No markdown codeblocks (\`\`\`json).`;

  const userPrompt = `Target Focus Keyword: "${keyword}"

Available Existing tgcenters.com Sitemap Pages for Context & Internal Linking:
${JSON.stringify(linkCandidates, null, 2)}

Generate the complete outline, semantic keywords, and 3000-4000 character in-depth Chinese Telegram guide in JSON format:
{
  "title": "Telegram SEO中文标题（包含关键词，自然通顺）",
  "slug": "english-keyword-slug-only",
  "metaDescription": "中文元描述（包含关键词，130-155字）",
  "focusKeyword": "${keyword}",
  "semanticKeywordsUsed": ["Telegram中文版", "电报注册", "验证码", "..."],
  "outline": [
    { "level": "h2", "heading": "自然段落标题（严禁任何数字前缀）", "estimatedCharacters": 400, "description": "详细阐述..." },
    { "level": "h3", "heading": "自然子标题（严禁 1.1 或数字）", "estimatedCharacters": 350, "description": "深入讲解..." },
    { "level": "h3", "heading": "另一子标题（严禁 1.2 或数字）", "estimatedCharacters": 350, "description": "具体分析..." }
  ],
  "contentHtml": "<h2>自然标题</h2><p>详细叙述段落...</p><!-- IN_ARTICLE_IMAGE_HERE --><p>深入分析段落...</p>...",
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
    max_tokens: 6500,
    response_format: { type: 'json_object' },
  });

  const contentText = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(contentText);

  // Strip any accidental numeric prefixes from outline and content headings
  if (Array.isArray(parsed.outline)) {
    parsed.outline = parsed.outline.map((item: any) => ({
      ...item,
      heading: item.heading.replace(/^([一二三四五六七八九十]+[、. ]|\d+(\.\d+)*[、. ]|步骤[一二三四五\d]+[：: ]*)/, '').trim(),
    }));
  }

  if (parsed.contentHtml) {
    // Clean H2, H3, H4 tags from leading numbers
    parsed.contentHtml = parsed.contentHtml.replace(
      /(<h[2-4][^>]*>)\s*([一二三四五六七八九十]+[、. ]|\d+(\.\d+)*[、. ]|步骤[一二三四五\d]+[：: ]*)/gi,
      '$1'
    );
  }

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

  // Auto-determine best category
  const selectedCategory = autoDetermineCategory(keyword, parsed.title, categories);

  return {
    title: parsed.title,
    slug: safeSlug,
    metaDescription: parsed.metaDescription,
    focusKeyword: keyword,
    contentHtml: parsed.contentHtml,
    category: {
      id: selectedCategory.id,
      name: selectedCategory.name,
    },
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
 * Generate DALL-E / OpenAI Image with gpt-image-1-mini ($0.015 tier)
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
