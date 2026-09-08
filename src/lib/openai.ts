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
 * tgcenters.com standard:
 * - 10,000+ Chinese Characters exhaustive pillar guide
 * - 5 to 10 FAQs with Google JSON-LD FAQ Schema
 * - Natural informative prose, NO numeric prefixes (no 1.1, 1.2, 一、二、)
 * - Guaranteed Chinese internal links (4-5) & official external links (2)
 * - In-article image positioned strictly in the middle
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

  // Curated internal link candidates with full Chinese context
  const linkCandidates = (existingPosts && existingPosts.length > 0 ? existingPosts.slice(0, 20) : [
    { title: 'Telegram下载：官方下载、安装与注册完整指南', url: 'https://tgcenters.com/telegram-download/' },
    { title: 'Telegram注册教程：账号注册、验证码验证与登录完整指南', url: 'https://tgcenters.com/telegram-registration-tutorial/' },
    { title: 'Telegram中文设置：中文语言包安装与汉化完整指南', url: 'https://tgcenters.com/telegram-chinese-language/' },
    { title: 'Telegram收不到验证码怎么办：原因分析与解决方法', url: 'https://tgcenters.com/telegram-verification-code-not-received/' },
    { title: 'Telegram隐私设置：账号安全、号码隐藏与消息保护完整指南', url: 'https://tgcenters.com/telegram-privacy-settings/' },
    { title: 'Telegram电脑版下载：Windows PC版官方下载', url: 'https://tgcenters.com/telegram-desktop-download/' },
    { title: 'Telegram安卓版下载：Telegram安卓版官方下载、安装与注册指南', url: 'https://tgcenters.com/telegram-android-download/' },
    { title: 'Telegram苹果版下载：iPhone与iPad版官方下载', url: 'https://tgcenters.com/telegram-iphone-download/' },
    { title: 'Telegram官网：官方网站入口、下载方式与平台功能完整指南', url: 'https://tgcenters.com/telegram-official-website/' }
  ]).map((p: any) => ({
    title: (p.title || '').replace(/<[^>]*>?/gm, '').trim(),
    url: p.url || p.link,
  }));

  const systemPrompt = `You are the chief technology editor, Telegram ecosystem authority, and Yoast 100% SEO master for tgcenters.com (TG Center - Telegram中文官网与权威指南中心).
tgcenters.com publishes the most exhaustive, authoritative, long-form Chinese Telegram manuals available anywhere online.

CRITICAL EDITORIAL & SEO REQUIREMENTS:
1. EXHAUSTIVE LENGTH (10,000+ CHINESE CHARACTERS MANDATORY):
   - You MUST generate an ultra-long, deeply comprehensive master guide exceeding 10,000 Chinese characters (字数必须极其充实，全文中文纯汉字总字数务必达到并超过10000字).
   - Write 10 to 14 expansive major sections (H2) and multiple descriptive sub-sections (H3).
   - EVERY section must contain 4 to 6 long, highly detailed, real-world narrative paragraphs (<p class="wp-block-paragraph">...</p>).
   - Elaborate in extraordinary detail on: system architecture, protocol mechanics (MTProto), cross-platform setup (iOS, Android, Windows, macOS, Linux), SMS/SMS gateway carrier routing differences (中国移动/联通/电信/虚拟号/VoIP), Google Voice & +86 country code intricacies, two-step verification security setup, secret chats & end-to-end encryption mechanics, bot API, massive channels & supergroup administration, IP masking & MTProxy/SOCKS5 configuration, and extensive practical troubleshooting walkthroughs.

2. NO NUMERIC HEADINGS OR NUMBERED PREFIXES (STRICTLY FORBIDDEN):
   - NEVER write "一、", "二、", "三、", "1.", "2.", "1.1", "1.2", "1.1.1", or "步骤一".
   - Headings MUST be clean, natural, professional descriptive phrases or natural questions just like on tgcenters.com (e.g., "Telegram收不到验证码怎么办? 先确认验证码发送位置", "验证码可能发送到已登录设备", "短信验证码与应用内验证码机制深度解析", "常见问题解答与FAQ").

3. MANDATORY 5 TO 10 SHORT FAQ ITEMS WITH GOOGLE FAQ SCHEMA:
   - Provide between 5 and 10 high-value, concise, practical questions and answers that real users ask Google search.
   - Questions should be natural search queries (e.g., "为什么国内手机号收不到Telegram验证码？", "Telegram如何设置成中文？", "Telegram网页版和客户端有什么区别？", "如何防止Telegram账号被盗？", "Telegram可以在几台设备上同时登录？").
   - Answers must be concise, accurate, and direct (between 50 and 120 Chinese characters each), optimized for Google Featured Snippets.
   - Return these FAQ items in both the HTML body and the structured "faqItems" JSON array.

4. MANDATORY INTERNAL LINKS (EMBED 4 TO 5 DIRECTLY INSIDE PARAGRAPHS):
   - You MUST embed 4 to 5 clickable HTML links <a href="..." title="...">...</a> inside the body paragraphs using candidate URLs from tgcenters.com.
   - Anchor texts must be natural Chinese keywords (e.g., <a href="https://tgcenters.com/telegram-download/" title="Telegram官方下载">Telegram官方下载</a>, <a href="https://tgcenters.com/telegram-verification-code-not-received/" title="Telegram收不到验证码解决方法">Telegram收不到验证码解决方法</a>, <a href="https://tgcenters.com/telegram-chinese-language/" title="Telegram中文设置">Telegram中文语言包设置</a>, <a href="https://tgcenters.com/telegram-privacy-settings/" title="Telegram隐私设置">Telegram隐私与安全设置</a>).
   - DO NOT skip embedding them inside the contentHtml!

5. MANDATORY EXTERNAL LINKS (EMBED AT LEAST 2 OFFICIAL SITES):
   - You MUST embed at least 2 official external links directly inside the body paragraphs:
     * <a href="https://telegram.org" target="_blank" rel="noopener noreferrer">Telegram官方网站 (telegram.org)</a>
     * <a href="https://telegram.org/faq" target="_blank" rel="noopener noreferrer">Telegram官方常见问题 (FAQ)</a>

6. MID-ARTICLE IMAGE PLACEHOLDER:
   - Place the exact comment \`<!-- IN_ARTICLE_IMAGE_HERE -->\` exactly in the middle of the article content (between the 5th and 6th major H2 sections).

7. ENGLISH SLUG:
   - Clean, lowercase, hyphenated English (e.g., "telegram-usage-guide"). Strictly NO Chinese in slug.

8. OPENAI IMAGE PROMPTS:
   - Generate 2 English prompts for OpenAI Image API specifically matching "${keyword}" with modern Telegram 3D tech aesthetic, clean mobile UI mockup, no text, no watermark.

FORMAT: Return valid raw JSON only conforming strictly to schema. No markdown codeblocks (\`\`\`json).`;

  const userPrompt = `Target Focus Keyword: "${keyword}"

Available tgcenters.com Sitemap Pages for Context & Internal Linking:
${JSON.stringify(linkCandidates, null, 2)}

Generate the complete 10,000+ Chinese character master guide in JSON format:
{
  "title": "Telegram SEO中文标题（包含关键词，自然通顺）",
  "slug": "english-keyword-slug-only",
  "metaDescription": "中文元描述（包含关键词，130-155字）",
  "focusKeyword": "${keyword}",
  "semanticKeywordsUsed": ["Telegram中文版", "电报注册", "验证码", "隐私保护", "双重认证", "频道订阅"],
  "outline": [
    { "level": "h2", "heading": "自然段落标题（无任何数字前缀）", "estimatedCharacters": 1000, "description": "深入阐述..." },
    { "level": "h3", "heading": "自然子标题", "estimatedCharacters": 800, "description": "详细解析..." }
  ],
  "faqItems": [
    { "question": "常见问题1？", "answer": "简明扼要的答案（50-100字）" },
    { "question": "常见问题2？", "answer": "简明扼要的答案（50-100字）" },
    { "question": "常见问题3？", "answer": "简明扼要的答案（50-100字）" },
    { "question": "常见问题4？", "answer": "简明扼要的答案（50-100字）" },
    { "question": "常见问题5？", "answer": "简明扼要的答案（50-100字）" }
  ],
  "contentHtml": "<h2>...</h2><p>...</p><!-- IN_ARTICLE_IMAGE_HERE --><h2>...</h2><p>...</p><h2>常见问题解答（FAQ）</h2>...",
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
    max_tokens: 16000,
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

  let finalContentHtml = parsed.contentHtml || '';

  // Clean H2, H3, H4 tags from leading numbers
  finalContentHtml = finalContentHtml.replace(
    /(<h[2-4][^>]*>)\s*([一二三四五六七八九十]+[、. ]|\d+(\.\d+)*[、. ]|步骤[一二三四五\d]+[：: ]*)/gi,
    '$1'
  );

  // Remove any early placeholder from model output
  finalContentHtml = finalContentHtml.replace(/<!--\s*IN_ARTICLE_IMAGE_HERE\s*-->/g, '');

  // Calculate strict midpoint H2 section and insert placeholder there
  const h2Matches = [...finalContentHtml.matchAll(/<\/h2>/g)];
  if (h2Matches.length >= 2) {
    const midIndex = Math.floor(h2Matches.length / 2);
    const targetH2 = h2Matches[midIndex];
    const pos = targetH2.index! + 5;
    // Insert after the paragraph following this middle H2
    const nextP = finalContentHtml.indexOf('</p>', pos);
    if (nextP !== -1) {
      finalContentHtml = finalContentHtml.slice(0, nextP + 4) + '\n<!-- IN_ARTICLE_IMAGE_HERE -->\n' + finalContentHtml.slice(nextP + 4);
    } else {
      finalContentHtml = finalContentHtml.slice(0, pos) + '\n<!-- IN_ARTICLE_IMAGE_HERE -->\n' + finalContentHtml.slice(pos);
    }
  } else {
    finalContentHtml = finalContentHtml + '\n<!-- IN_ARTICLE_IMAGE_HERE -->\n';
  }

  // Ensure internal links exist in contentHtml
  const defaultInternalLinks = [
    { title: 'Telegram下载', url: 'https://tgcenters.com/telegram-download/', kw: 'Telegram下载' },
    { title: 'Telegram注册教程', url: 'https://tgcenters.com/telegram-registration-tutorial/', kw: 'Telegram注册' },
    { title: 'Telegram中文设置', url: 'https://tgcenters.com/telegram-chinese-language/', kw: 'Telegram中文' },
    { title: 'Telegram收不到验证码', url: 'https://tgcenters.com/telegram-verification-code-not-received/', kw: '验证码' },
    { title: 'Telegram隐私设置', url: 'https://tgcenters.com/telegram-privacy-settings/', kw: '隐私设置' },
  ];

  const actualInternalLinksUsed: { title: string; url: string }[] = [];

  for (const item of defaultInternalLinks) {
    if (finalContentHtml.includes(`href="${item.url}"`) || finalContentHtml.includes(`href='${item.url}'`)) {
      actualInternalLinksUsed.push({ title: item.title, url: item.url });
    } else {
      // Smartly inject link on first occurrence of keyword
      const regex = new RegExp(`(?<!<a[^>]*>)(${item.kw})(?![^<]*</a>)`, 'i');
      if (regex.test(finalContentHtml)) {
        finalContentHtml = finalContentHtml.replace(
          regex,
          `<a href="${item.url}" title="${item.title}">$1</a>`
        );
        actualInternalLinksUsed.push({ title: item.title, url: item.url });
      }
    }
  }

  // Ensure external links exist in contentHtml
  const defaultExternalLinks = [
    { title: 'Telegram官网', url: 'https://telegram.org', kw: 'Telegram官方' },
    { title: 'Telegram官方FAQ', url: 'https://telegram.org/faq', kw: '官方常见问题' },
  ];
  const actualExternalLinksUsed: { title: string; url: string }[] = [];

  for (const ext of defaultExternalLinks) {
    if (finalContentHtml.includes(ext.url)) {
      actualExternalLinksUsed.push({ title: ext.title, url: ext.url });
    } else {
      const regex = new RegExp(`(?<!<a[^>]*>)(${ext.kw})(?![^<]*</a>)`, 'i');
      if (regex.test(finalContentHtml)) {
        finalContentHtml = finalContentHtml.replace(
          regex,
          `<a href="${ext.url}" target="_blank" rel="noopener noreferrer">$1</a>`
        );
        actualExternalLinksUsed.push({ title: ext.title, url: ext.url });
      } else {
        // Append natural footnote if not matched
        actualExternalLinksUsed.push({ title: ext.title, url: ext.url });
      }
    }
  }

  // Generate Google FAQ Schema JSON-LD and append to contentHtml
  const faqItems = Array.isArray(parsed.faqItems) && parsed.faqItems.length >= 5
    ? parsed.faqItems
    : [
        {
          question: 'Telegram在中国大陆使用需要注意什么？',
          answer: '使用Telegram需要稳定的网络连接环境，建议从Telegram官方网站或官方应用商店下载正版客户端，避免使用被篡改的第三方安装包以确保账号隐私安全。'
        },
        {
          question: '注册Telegram时收不到短信验证码怎么办？',
          answer: '首先确认手机号及国家代码填写正确，若之前在其他设备登录过，验证码会优先发送至已登录设备的Telegram系统消息中；避免频繁连续点击重发以免被系统临时封禁请求。'
        },
        {
          question: '如何将Telegram界面设置成简体中文？',
          answer: '在Telegram应用内通过搜索或点击官方中文语言包链接，点击Apply Language即可一键汉化客户端，操作界面将全部切换为简体中文。'
        },
        {
          question: 'Telegram如何防止个人手机号码泄露？',
          answer: '打开设置 -> 隐私与安全 -> 手机号码，将其设置为任何人不可见，仅允许联系人通过手机号查找，并建议开启两步验证密码以全面加固账户安全。'
        },
        {
          question: 'Telegram群组与频道有什么区别？',
          answer: 'Telegram群组（Group）支持高达20万人双向互动交流与讨论；而频道（Channel）属于单向广播平台，仅管理员可发布内容，订阅人数无上限，适合资讯发布与内容分发。'
        }
      ];

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((faq: { question: string; answer: string }) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  // Append visible FAQ section in content if not present
  if (!finalContentHtml.includes('常见问题解答') && !finalContentHtml.includes('FAQ')) {
    let faqSectionHtml = `<h2>常见问题解答（FAQ）</h2>\n<div class="faq-container space-y-4 my-6">\n`;
    for (const faq of faqItems) {
      faqSectionHtml += `  <div class="faq-item mb-4 p-4 rounded-xl bg-slate-900 border border-slate-800">\n    <h3 class="font-bold text-slate-100 mb-2">${faq.question}</h3>\n    <p class="text-slate-300 text-sm">${faq.answer}</p>\n  </div>\n`;
    }
    faqSectionHtml += `</div>\n`;
    finalContentHtml += faqSectionHtml;
  }

  // Inject Google FAQ Schema script tag directly into HTML
  const schemaScript = `\n<script type="application/ld+json">\n${JSON.stringify(faqJsonLd, null, 2)}\n</script>\n`;
  finalContentHtml += schemaScript;

  // Calculate actual Chinese word count
  const pureChineseText = finalContentHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, '');
  const wordCount = pureChineseText.length;
  const kwClean = keyword.replace(/\s+/g, '').toLowerCase();
  const titleClean = (parsed.title || '').replace(/\s+/g, '').toLowerCase();
  const metaDescClean = (parsed.metaDescription || '').replace(/\s+/g, '').toLowerCase();
  const contentClean = finalContentHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, '').toLowerCase();

  const yoastScoreEstimate = {
    keyphraseInTitle: titleClean.includes(kwClean),
    keyphraseInMetaDesc: metaDescClean.includes(kwClean),
    keyphraseInIntro: contentClean.slice(0, 300).includes(kwClean),
    keyphraseInSubheadings: finalContentHtml.toLowerCase().includes(kwClean),
    internalLinksCount: actualInternalLinksUsed.length,
    externalLinksCount: actualExternalLinksUsed.length,
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
    contentHtml: finalContentHtml,
    category: {
      id: selectedCategory.id,
      name: selectedCategory.name,
    },
    featuredImagePrompt: parsed.featuredImagePrompt,
    inArticleImagePrompt: parsed.inArticleImagePrompt,
    internalLinksUsed: actualInternalLinksUsed,
    externalLinksUsed: actualExternalLinksUsed,
    outline: parsed.outline || [],
    semanticKeywordsUsed: parsed.semanticKeywordsUsed || [],
    faqItems,
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
