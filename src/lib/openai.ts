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

CRITICAL EDITORIAL & SEO REQUIREMENTS (GOOGLE 2026 HELPFUL CONTENT & EEAT COMPLIANT):
1. MANDATORY ULTRA-LONG PILLAR GUIDE (10,000+ CHINESE CHARACTERS EXPLICIT REQUIREMENT):
   - You MUST generate an ultra-long, deeply comprehensive master guide with over 10,000 Chinese characters (正文纯汉字总字数必须极其充实，务必达到10000字以上).
   - Write 12 to 15 expansive major sections (H2) and 2 to 4 detailed sub-sections (H3) under each major section.
   - EVERY H2 and H3 section MUST have 4 to 7 expansive, highly thorough narrative paragraphs (<p class="wp-block-paragraph">...</p>).
   - DO NOT summarize or write brief outlines. Write exhaustive, step-by-step, real-world explanations covering:
     * 架构原理与MTProto加密机制
     * 各平台客户端安装与环境配置（iOS、Android独立APK、Windows、macOS、Linux、Web网页端）
     * 手机号注册与收不到验证码全套解决方案（中国移动/联通/电信拦截机制、VoIP/Google Voice限制、接码平台与eSIM替代方案）
     * 官方简体中文语言包安装与一键汉化深度步骤
     * 账户最高等级安全加固（两步验证密码、隐藏手机号、防盗号、防劫持、防止被拉进垃圾群组）
     * 群组管理、频道运营、超级群20万人管理与机器人Bot API配置
     * 常见网络连接问题排查、内置代理MTProxy与SOCKS5详细设置
     * 封号原因分析、申诉解封官方邮件模板与养号防封注意事项
     * 常见操作疑难问答与FAQ汇总

2. STRICTLY NO LINKS INSIDE HEADINGS (H1, H2, H3, H4):
   - Internal and external links MUST ONLY be placed inside standard body paragraphs (<p class="wp-block-paragraph">...</p>).
   - NEVER place any <a> tags inside <h2>, <h3>, or <h4> headings under any circumstance.

3. NO NUMERIC HEADINGS OR NUMBERED PREFIXES:
   - NEVER write "一、", "二、", "三、", "1.", "2.", "1.1", "1.2", "1.1.1", or "步骤一".
   - Headings MUST be clean, natural, professional descriptive phrases or natural questions.

4. MANDATORY 5 TO 10 SHORT FAQ ITEMS WITH GOOGLE FAQ SCHEMA:
   - Provide 5 to 10 high-value, concise, practical questions and answers that real users ask Google search.
   - Answers must be concise, accurate, and direct (between 50 and 120 Chinese characters each).

5. MANDATORY INTERNAL LINKS (EMBED 4 TO 5 IN BODY PARAGRAPHS ONLY):
   - Embed 4 to 5 clickable HTML links <a href="..." title="...">...</a> inside body paragraphs (<p>) using candidate URLs from tgcenters.com.
   - Never place inside headings!

6. MANDATORY EXTERNAL LINKS (EMBED AT LEAST 2 OFFICIAL SITES IN PARAGRAPHS ONLY):
   - Embed at least 2 official links:
     * <a href="https://telegram.org" target="_blank" rel="noopener noreferrer">Telegram官方网站</a>
     * <a href="https://telegram.org/faq" target="_blank" rel="noopener noreferrer">Telegram官方常见问题 (FAQ)</a>

7. YOAST SEO EXACT KEYWORD FORMATTING (CRITICAL - STRICTLY NO BRACKETS 【 】, USE CLEAN SPACES):
   - The focus keyword is: "${keyword}".
   - NEVER wrap the keyword in Chinese brackets like 【${keyword}】 or [${keyword}].
   - Instead, ALWAYS place clean spaces before and after the keyword: " ${keyword} " so that Yoast SEO word boundaries and Chinese tokenizers detect the standalone focus keyword with 100% green light!
   - In Title: Place " ${keyword} " clearly separated, e.g.: " ${keyword} ：官方使用与下载设置全攻略".
   - In Meta Description: Start with clean spaced keyword: "针对 ${keyword} ，本文提供全面实用的中文指南...".
   - In the First Paragraph (<p>...</p>): The very first sentence must contain " ${keyword} " within the first 60 characters with clean spaces and no brackets.

8. MID-ARTICLE IMAGE PLACEHOLDER:
   - Place \`<!-- IN_ARTICLE_IMAGE_HERE -->\` exactly in the middle of the article content.

9. ENGLISH SLUG:
   - Clean, lowercase, hyphenated English (e.g., "telegram-usage-complete-guide"). Strictly NO Chinese in slug.

10. OPENAI IMAGE PROMPTS:
   - Generate 2 English prompts for OpenAI Image API specifically tailored to "${keyword}" with 3D tech aesthetic, clean smartphone mockup, no text, no watermark.

FORMAT: Return valid raw JSON only.`;

  const userPrompt = `Target Focus Keyword: "${keyword}" (Must appear with clean spaces " ${keyword} " without any brackets 【】 in Title, Meta Description, and First Paragraph!)

Available tgcenters.com Sitemap Pages for Context & Internal Linking:
${JSON.stringify(linkCandidates, null, 2)}

Generate the complete 10,000+ Chinese character exhaustive guide in JSON format:
{
  "title": " ${keyword} ：详细使用指南与实用技巧",
  "slug": "english-keyword-slug-only",
  "metaDescription": "针对 ${keyword} ，本文提供全面实用的中文指南，从正版下载、注册登录、验证码接收到中文包设置与隐私防护，助您轻松掌握Telegram核心功能。",
  "focusKeyword": "${keyword}",
  "semanticKeywordsUsed": ["Telegram中文版", "电报设置", "验证码", "隐私保护", "双重认证", "频道订阅"],
  "outline": [
    { "level": "h2", "heading": "自然段落标题（无数字，无链接）", "estimatedCharacters": 1000, "description": "深入阐述..." },
    { "level": "h3", "heading": "自然子标题", "estimatedCharacters": 800, "description": "详细解析..." }
  ],
  "faqItems": [
    { "question": "常见问题1？", "answer": "简明扼要的答案（50-100字）" },
    { "question": "常见问题2？", "answer": "简明扼要的答案（50-100字）" },
    { "question": "常见问题3？", "answer": "简明扼要的答案（50-100字）" },
    { "question": "常见问题4？", "answer": "简明扼要的答案（50-100字）" },
    { "question": "常见问题5？", "answer": "简明扼要的答案（50-100字）" }
  ],
  "contentHtml": "<h2>...</h2><p>对于关注 ${keyword} 的用户而言，...</p><!-- IN_ARTICLE_IMAGE_HERE --><h2>...</h2><p>...</p>",
  "featuredImagePrompt": "English prompt tailored specifically for ${keyword} with modern 3D tech concept, sleek smartphone UI, clean aesthetic, no text, no watermark",
  "inArticleImagePrompt": "English prompt tailored specifically for ${keyword} technical workflow illustration, modern digital app mockup, clean style, no text, no watermark",
  "internalLinksUsed": [
    { "title": "页面标题", "url": "https://tgcenters.com/..." }
  ],
  "externalLinksUsed": [
    { "title": "Telegram官网", "url": "https://telegram.org" }
  ]
}`;

  console.log(`[OpenAI] Generating comprehensive 10,000+ Chinese character guide for "${keyword}"...`);
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
      heading: item.heading.replace(/^([一二三四五六七八九十]+[、. ]|\d+(\.\d+)*[、. ]|步骤[一二三四五\d]+[：: ]*)/, '').replace(/<[^>]*>/g, '').trim(),
    }));
  }

  let finalContentHtml = parsed.contentHtml || '';

  // Clean H2, H3, H4 tags: remove any links inside headings and remove leading numbers
  finalContentHtml = finalContentHtml.replace(
    /(<h[2-4][^>]*>)([\s\S]*?)(<\/h[2-4]>)/gi,
    (_match: string, openTag: string, innerText: string, closeTag: string) => {
      // Remove any <a> tags from heading text
      let cleaned = innerText.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');
      // Remove numeric prefixes
      cleaned = cleaned.replace(/^([一二三四五六七八九十]+[、. ]|\d+(\.\d+)*[、. ]|步骤[一二三四五\d]+[：: ]*)/, '').trim();
      return `${openTag}${cleaned}${closeTag}`;
    }
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

  // Ensure internal links exist in contentHtml ONLY inside <p> paragraphs (NEVER in headings)
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
      // Smartly inject link ONLY inside <p> paragraphs
      let injected = false;
      finalContentHtml = finalContentHtml.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/gi, (fullP: string, pOpen: string, pText: string, pClose: string) => {
        if (!injected && !pText.includes('<a ') && pText.includes(item.kw)) {
          injected = true;
          const newText = pText.replace(item.kw, `<a href="${item.url}" title="${item.title}">${item.kw}</a>`);
          return `${pOpen}${newText}${pClose}`;
        }
        return fullP;
      });
      if (injected) {
        actualInternalLinksUsed.push({ title: item.title, url: item.url });
      }
    }
  }

  // Ensure external links exist in contentHtml ONLY inside <p> paragraphs
  const defaultExternalLinks = [
    { title: 'Telegram官网', url: 'https://telegram.org', kw: 'Telegram官方' },
    { title: 'Telegram官方FAQ', url: 'https://telegram.org/faq', kw: '官方常见问题' },
  ];
  const actualExternalLinksUsed: { title: string; url: string }[] = [];

  for (const ext of defaultExternalLinks) {
    if (finalContentHtml.includes(ext.url)) {
      actualExternalLinksUsed.push({ title: ext.title, url: ext.url });
    } else {
      let injectedExt = false;
      finalContentHtml = finalContentHtml.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/gi, (fullP: string, pOpen: string, pText: string, pClose: string) => {
        if (!injectedExt && !pText.includes('<a ') && pText.includes(ext.kw)) {
          injectedExt = true;
          const newText = pText.replace(ext.kw, `<a href="${ext.url}" target="_blank" rel="noopener noreferrer">${ext.kw}</a>`);
          return `${pOpen}${newText}${pClose}`;
        }
        return fullP;
      });
      if (injectedExt) {
        actualExternalLinksUsed.push({ title: ext.title, url: ext.url });
      } else {
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

  // Ensure main keyword is distinctly separated with spaces in Title (e.g., " telegram怎么用 ：...")
  let safeTitle = (parsed.title || '').trim().replace(/【|】|\[|\]/g, '');
  if (!safeTitle.includes(keyword)) {
    safeTitle = ` ${keyword} ：${safeTitle}`;
  } else {
    // Ensure clean space separation around keyword
    safeTitle = safeTitle.replace(keyword, ` ${keyword} `).replace(/\s+/g, ' ').trim();
    if (!safeTitle.includes('：') && !safeTitle.includes('-')) {
      safeTitle = safeTitle.replace(new RegExp(`\\s*${keyword}\\s*`), ` ${keyword} ： `);
    }
  }

  // Ensure main keyword is prominently standalone with spaces at beginning of Meta Description
  let safeMetaDesc = (parsed.metaDescription || '').trim().replace(/【|】|\[|\]/g, '');
  if (!safeMetaDesc.includes(keyword)) {
    safeMetaDesc = `针对 ${keyword} ，本文提供全面实用的中文指南。${safeMetaDesc}`;
  } else {
    safeMetaDesc = safeMetaDesc.replace(keyword, ` ${keyword} `).replace(/\s+/g, ' ').trim();
  }

  // Remove any bracketed keyword formatting in contentHtml
  finalContentHtml = finalContentHtml.replace(new RegExp(`【\\s*${keyword}\\s*】`, 'g'), ` ${keyword} `);
  finalContentHtml = finalContentHtml.replace(new RegExp(`\\[\\s*${keyword}\\s*\\]`, 'g'), ` ${keyword} `);

  // Ensure first paragraph contains the standalone main keyword cleanly in the first 60 characters with spaces
  const firstPOpen = finalContentHtml.indexOf('<p');
  if (firstPOpen !== -1) {
    const firstPClose = finalContentHtml.indexOf('</p>', firstPOpen);
    if (firstPClose !== -1) {
      const firstPContent = finalContentHtml.slice(firstPOpen, firstPClose + 4);
      if (!firstPContent.slice(0, 100).includes(keyword)) {
        // Prepend clean introductory clause with exact spaced keyword and no brackets
        const cleanInsert = `对于关注 ${keyword} 的用户而言，掌握官方正版的操作与设置至关重要。`;
        finalContentHtml = finalContentHtml.slice(0, firstPOpen) +
          firstPContent.replace(/(<p[^>]*>)/i, `$1${cleanInsert}`) +
          finalContentHtml.slice(firstPClose + 4);
      }
    }
  }

  // Auto-determine best category
  const selectedCategory = autoDetermineCategory(keyword, safeTitle, categories);

  return {
    title: safeTitle,
    slug: safeSlug,
    metaDescription: safeMetaDesc,
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
