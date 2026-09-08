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
  keyword: rawKeyword,
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

  // Normalize keyword: auto capitalize 'telegram' to 'Telegram'
  const keyword = (rawKeyword || '').replace(/telegram/gi, 'Telegram').trim();

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
tgcenters.com publishes the most exhaustive, authoritative, 100% user-helpful Chinese Telegram manuals online.

CRITICAL EDITORIAL & SEO REQUIREMENTS (GOOGLE 2026 HELPFUL CONTENT & EEAT COMPLIANT):
1. 100% KEYWORD-SPECIFIC USER-HELPFUL CONTENT (NO IRRELEVANT REPEATED TOPICS):
   - Every article must be 100% tailored, focused, and directly relevant to the specific search intent of "${keyword}".
   - STRICTLY FORBIDDEN GENERIC REPETITION: Do NOT inject unrelated or repetitive boilerplate like "架构原理与MTProto加密机制" or "手机号注册与收不到验证码全套解决方案" UNLESS the target keyword explicitly asks for registration or verification codes!
   - If the keyword is about settings/usage (e.g., "telegram怎么用"), focus 100% on actual usage, UI navigation, core features, messaging, contacts, multimedia sharing, channel subscriptions, group interactions, privacy controls, voice/video calls, cloud storage, bots, desktop synchronization, shortcuts, and practical day-to-day user scenarios.
   - If the keyword is about Chinese language, focus 100% on language packs, localization steps across platforms, translation bots, and font display.
   - Content must solve real user problems from beginning to end with first-hand, actionable, step-by-step helpful walkthroughs.

2. EXHAUSTIVE PILLAR GUIDE (10,000+ CHINESE CHARACTERS - DEEP NARRATIVE PROSE):
   - You MUST generate an ultra-comprehensive, deeply detailed master guide with 10,000+ Chinese characters (正文纯汉字字数必须达到并超过10000字).
   - STRICT PROHIBITION ON SHORT BULLET POINTS / OUTLINE-STYLE TEXT:
     * NEVER write short bullet lists, brief summary outlines, or lazy 1-line bullet points under headings!
     * Content MUST be written in extensive, flowing, full-length narrative paragraphs (<p class="wp-block-paragraph">...</p>).
     * Under EVERY heading (H2, H3, H4), write 5 to 8 expansive, highly descriptive paragraphs (each paragraph 150-300 Chinese characters) explaining the "why", the exact step-by-step "how", realistic troubleshooting situations, interface screenshots descriptions, common traps, and professional best practices.
   - Write 12 to 16 expansive major sections (H2) and multiple descriptive sub-sections (H3, H4), ALL strictly relevant to "${keyword}".

3. HIERARCHICAL HEADINGS STRUCTURE (H2 TO H4):
   - Organize logically using clean H2, H3, and H4 tags.
   - Headings MUST directly address user questions and practical operations regarding "${keyword}".

4. STRICTLY NO LINKS INSIDE HEADINGS (H1, H2, H3, H4):
   - Internal and external links MUST ONLY be placed inside standard body paragraphs (<p class="wp-block-paragraph">...</p>).
   - NEVER place any <a> tags inside <h2>, <h3>, or <h4> headings.

5. NO NUMERIC HEADINGS OR NUMBERED PREFIXES:
   - NEVER write "一、", "二、", "三、", "1.", "2.", "1.1", "1.2", "1.1.1", or "步骤一".
   - Headings MUST be natural, professional, descriptive phrases or questions.

6. MANDATORY 5 TO 10 SHORT FAQ ITEMS WITH GOOGLE FAQ SCHEMA:
   - Provide 5 to 10 practical questions and concise answers (50 to 120 Chinese characters each) directly addressing common search queries for "${keyword}".

7. MANDATORY INTERNAL LINKS (EMBED 4 TO 5 IN BODY PARAGRAPHS ONLY):
   - Embed 4 to 5 clickable HTML links <a href="..." title="...">...</a> naturally inside body paragraphs (<p>) using candidate URLs from tgcenters.com.
   - Never place inside headings!

8. MANDATORY EXTERNAL LINKS (EMBED AT LEAST 2 OFFICIAL SITES IN PARAGRAPHS ONLY):
   - Embed at least 2 official links inside body paragraphs:
     * <a href="https://telegram.org" target="_blank" rel="noopener noreferrer">Telegram官方网站</a>
     * <a href="https://telegram.org/faq" target="_blank" rel="noopener noreferrer">Telegram官方常见问题 (FAQ)</a>

9. YOAST SEO EXACT KEYWORD FORMATTING (STRICTLY NO BRACKETS 【 】, USE CLEAN SPACES):
   - The focus keyword is: "${keyword}".
   - NEVER wrap the keyword in Chinese brackets like 【${keyword}】 or [${keyword}].
   - ALWAYS place clean spaces before and after the keyword: " ${keyword} ".
   - In Title: Place " ${keyword} " cleanly separated, e.g.: " ${keyword} ：官方使用与操作设置指南".
   - In Meta Description: Start with clean spaced keyword: "针对 ${keyword} ，本文提供全面详实的实用指南...".
   - In First Paragraph (<p>...</p>): The very first sentence must contain " ${keyword} " within the first 60 characters with clean spaces and no brackets.

10. MID-ARTICLE IMAGE PLACEHOLDER:
    - Place \`<!-- IN_ARTICLE_IMAGE_HERE -->\` exactly in the middle of the article content.

11. ENGLISH SLUG:
    - Clean, lowercase, hyphenated English (e.g., "telegram-usage-tutorial"). Strictly NO Chinese in slug.

12. OPENAI IMAGE PROMPTS:
    - Generate 2 English prompts for OpenAI Image API specifically tailored to "${keyword}" with 3D tech aesthetic, clean smartphone mockup, no text, no watermark.

FORMAT: Return valid raw JSON only.`;

  const userPrompt = `Target Focus Keyword: "${keyword}" (Must be 100% relevant to this keyword, zero generic repeated topics like MTProto or SMS verification unless requested, 10,000+ Chinese characters, spaces around keyword " ${keyword} " without brackets!)

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

  let finalContentHtml = parsed.contentHtml || '';

  // Check initial Chinese character count
  let currentChineseLen = finalContentHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, '').length;
  console.log(`[OpenAI First Pass Length] Pure Chinese characters: ${currentChineseLen}`);

  // Guaranteed Loop Expansion to ensure 10,000+ Chinese characters!
  let expansionPass = 0;
  while (currentChineseLen < 10000 && expansionPass < 3) {
    expansionPass++;
    try {
      console.log(`[OpenAI Expansion Pass ${expansionPass}] Expanding from ${currentChineseLen} to 10,000+ Chinese characters...`);
      const neededChars = 10000 - currentChineseLen;
      const expansionPrompt = `The Chinese article currently has ${currentChineseLen} Chinese characters, but MUST reach 10,000+ characters (needs at least ${neededChars} more characters).
Focus Topic: "${keyword}".

Please generate 6 to 10 additional extensive, highly in-depth, completely unique, professional practical sections (H2, H3, H4) with rich narrative paragraphs (<p class="wp-block-paragraph">...</p>) explaining advanced features, user scenarios, security configurations, practical tips, and detailed troubleshooting.

Requirements:
- Pure narrative flowing paragraphs (5-8 paragraphs per section, 200-300 characters each).
- NO bullet points, NO numeric prefixes.
- NO links inside headings.
- Strictly relevant to "${keyword}".

Return valid JSON:
{
  "additionalContentHtml": "<h2>...</h2><p>...</p><h3>...</h3><p>...</p>"
}`;

      const expRes = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are the chief technology editor for tgcenters.com. Write extensive, authoritative Chinese long-form content.' },
          { role: 'user', content: expansionPrompt },
        ],
        temperature: 0.7,
        max_tokens: 16000,
        response_format: { type: 'json_object' },
      });

      const expText = expRes.choices[0]?.message?.content || '{}';
      const expParsed = JSON.parse(expText);
      if (expParsed.additionalContentHtml) {
        finalContentHtml = finalContentHtml + '\n' + expParsed.additionalContentHtml;
        currentChineseLen = finalContentHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, '').length;
        console.log(`[OpenAI Expanded Length Pass ${expansionPass}] Total pure Chinese characters now: ${currentChineseLen}`);
      } else {
        break;
      }
    } catch (expErr: any) {
      console.warn('Content expansion warning:', expErr.message);
      break;
    }
  }

  // Strip any accidental numeric prefixes from outline and content headings
  if (Array.isArray(parsed.outline)) {
    parsed.outline = parsed.outline.map((item: any) => ({
      ...item,
      heading: item.heading.replace(/^([一二三四五六七八九十]+[、. ]|\d+(\.\d+)*[、. ]|步骤[一二三四五\d]+[：: ]*)/, '').replace(/<[^>]*>/g, '').trim(),
    }));
  }

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
  // Guarantee AT LEAST 5 internal links, up to as many as fit naturally.
  const defaultInternalLinkCandidates = [
    {
      title: 'Telegram下载',
      url: 'https://tgcenters.com/telegram-download/',
      keywords: ['Telegram下载', '下载Telegram', '电报下载', '客户端下载', '最新版本下载', '下载安装', '正版下载', '官方下载'],
      contextSentence: '如果您尚未安装或需要更新客户端，可以前往查阅 <a href="https://tgcenters.com/telegram-download/" title="Telegram下载">Telegram下载</a> 获取适用于各平台的最新官方安装包。',
    },
    {
      title: 'Telegram注册教程',
      url: 'https://tgcenters.com/telegram-registration-tutorial/',
      keywords: ['Telegram注册', '注册Telegram', '账号注册', '新建账号', '新用户注册', '手机号注册', '注册流程'],
      contextSentence: '对于刚接触电报的新用户，建议先查阅详细的 <a href="https://tgcenters.com/telegram-registration-tutorial/" title="Telegram注册教程">Telegram注册教程</a> 掌握正确的账号建立与登录操作。',
    },
    {
      title: 'Telegram中文设置',
      url: 'https://tgcenters.com/telegram-chinese-language/',
      keywords: ['Telegram中文', '中文设置', '中文语言包', '汉化', '设置中文', '简体中文', '界面汉化'],
      contextSentence: '若应用默认显示为英文，您可以参考专门的 <a href="https://tgcenters.com/telegram-chinese-language/" title="Telegram中文设置">Telegram中文设置</a> 一键安装官方汉化语言包。',
    },
    {
      title: 'Telegram收不到验证码',
      url: 'https://tgcenters.com/telegram-verification-code-not-received/',
      keywords: ['收不到验证码', '验证码接收', '验证码问题', '短信验证码', '验证码', '登录验证码'],
      contextSentence: '如果在登录或换设备时遇到短信接收延迟，请参考 <a href="https://tgcenters.com/telegram-verification-code-not-received/" title="Telegram收不到验证码">Telegram收不到验证码</a> 的排查方案与解决建议。',
    },
    {
      title: 'Telegram隐私设置',
      url: 'https://tgcenters.com/telegram-privacy-settings/',
      keywords: ['隐私设置', '隐私与安全', '隐藏手机号', '两步验证', '账号安全', '隐私防护'],
      contextSentence: '为了确保个人信息不被泄露，强烈建议仔细配置 <a href="https://tgcenters.com/telegram-privacy-settings/" title="Telegram隐私设置">Telegram隐私设置</a> 隐藏手机号码并开启两步密码验证。',
    },
    {
      title: 'Telegram官网',
      url: 'https://tgcenters.com/telegram-official-website/',
      keywords: ['Telegram官网', '电报官网', '官网入口', '官方网站', '电报官方'],
      contextSentence: '获取最新平台资讯与安全公告，请认准权威的 <a href="https://tgcenters.com/telegram-official-website/" title="Telegram官网">Telegram官网</a> 导航与安全防坑说明。',
    },
    {
      title: 'Telegram电脑版下载',
      url: 'https://tgcenters.com/telegram-desktop-download/',
      keywords: ['Telegram电脑版', '电脑版下载', 'PC版', 'Windows版', '桌面版', '电脑端'],
      contextSentence: '在电脑端办公时，建议搭配使用 <a href="https://tgcenters.com/telegram-desktop-download/" title="Telegram电脑版下载">Telegram电脑版下载</a> 安装桌面客户端以提升日常沟通效率。',
    },
    {
      title: 'Telegram安卓版下载',
      url: 'https://tgcenters.com/telegram-android-download/',
      keywords: ['Telegram安卓版', '安卓版下载', 'Android版', '安卓客户端', 'APK下载'],
      contextSentence: 'Android手机用户可参考 <a href="https://tgcenters.com/telegram-android-download/" title="Telegram安卓版下载">Telegram安卓版下载</a> 获取纯净无广告的官方安装包。',
    },
    {
      title: 'Telegram苹果版下载',
      url: 'https://tgcenters.com/telegram-iphone-download/',
      keywords: ['Telegram苹果版', '苹果版下载', 'iPhone版', 'iOS版', 'App Store下载'],
      contextSentence: 'iOS设备用户推荐阅读 <a href="https://tgcenters.com/telegram-iphone-download/" title="Telegram苹果版下载">Telegram苹果版下载</a> 获取海外App Store换区与下载技巧。',
    },
  ];

  const actualInternalLinksUsed: { title: string; url: string }[] = [];

  // Step 1: Scan and link matching natural keywords inside <p> paragraphs
  for (const item of defaultInternalLinkCandidates) {
    if (finalContentHtml.includes(`href="${item.url}"`) || finalContentHtml.includes(`href='${item.url}'`)) {
      if (!actualInternalLinksUsed.some(l => l.url === item.url)) {
        actualInternalLinksUsed.push({ title: item.title, url: item.url });
      }
      continue;
    }

    let injected = false;
    for (const kw of item.keywords) {
      if (injected) break;
      // Match inside <p> paragraphs ONLY
      finalContentHtml = finalContentHtml.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/gi, (fullP: string, pOpen: string, pText: string, pClose: string) => {
        if (!injected && !pText.includes(item.url) && pText.includes(kw)) {
          injected = true;
          const newText = pText.replace(kw, `<a href="${item.url}" title="${item.title}">${kw}</a>`);
          return `${pOpen}${newText}${pClose}`;
        }
        return fullP;
      });
    }

    if (injected) {
      if (!actualInternalLinksUsed.some(l => l.url === item.url)) {
        actualInternalLinksUsed.push({ title: item.title, url: item.url });
      }
    }
  }

  // Step 2: GUARANTEE AT LEAST 5 INTERNAL LINKS
  // If fewer than 5 internal links exist, naturally append helpful context sentences to suitable body paragraphs
  if (actualInternalLinksUsed.length < 5) {
    for (const item of defaultInternalLinkCandidates) {
      if (actualInternalLinksUsed.length >= 5) break;
      if (finalContentHtml.includes(item.url)) continue;

      let injectedSentence = false;
      let pIndex = 0;
      finalContentHtml = finalContentHtml.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/gi, (fullP: string, pOpen: string, pText: string, pClose: string) => {
        pIndex++;
        // Target mid or later paragraphs that do not already have links, after the 3rd paragraph
        if (!injectedSentence && pIndex >= 3 && !pText.includes('<a ') && pText.length > 50) {
          injectedSentence = true;
          return `${pOpen}${pText} ${item.contextSentence}${pClose}`;
        }
        return fullP;
      });

      if (injectedSentence) {
        actualInternalLinksUsed.push({ title: item.title, url: item.url });
      }
    }
  }

  // Ensure external links exist in contentHtml ONLY inside <p> paragraphs (minimum 2, up to 5)
  const defaultExternalLinkCandidates = [
    {
      title: 'Telegram官方网站',
      url: 'https://telegram.org',
      keywords: ['Telegram官网', 'Telegram官方', '电报官方', '官方网站', 'telegram.org'],
      contextSentence: '若需了解最新官方动态或直接获取跨平台软件，可随时访问 <a href="https://telegram.org" target="_blank" rel="noopener noreferrer">Telegram官方网站</a> 获取权威信息。',
    },
    {
      title: 'Telegram官方常见问题 (FAQ)',
      url: 'https://telegram.org/faq',
      keywords: ['官方FAQ', '常见问题', '官方文档', '官方解答', 'telegram.org/faq'],
      contextSentence: '此外，Telegram团队还在其 <a href="https://telegram.org/faq" target="_blank" rel="noopener noreferrer">Telegram官方常见问题 (FAQ)</a> 中对各类常见疑难做出了全面而专业的官方解答。',
    },
    {
      title: 'Telegram官方应用列表',
      url: 'https://telegram.org/apps',
      keywords: ['官方应用', '官方客户端', '各平台版本', '移动应用', 'telegram.org/apps'],
      contextSentence: '如需查看所有被官方认证的客户端分支，请浏览 <a href="https://telegram.org/apps" target="_blank" rel="noopener noreferrer">Telegram官方应用列表</a> 了解详情。',
    },
  ];

  const actualExternalLinksUsed: { title: string; url: string }[] = [];

  for (const ext of defaultExternalLinkCandidates) {
    if (finalContentHtml.includes(ext.url)) {
      if (!actualExternalLinksUsed.some(l => l.url === ext.url)) {
        actualExternalLinksUsed.push({ title: ext.title, url: ext.url });
      }
      continue;
    }

    let injectedExt = false;
    for (const kw of ext.keywords) {
      if (injectedExt) break;
      finalContentHtml = finalContentHtml.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/gi, (fullP: string, pOpen: string, pText: string, pClose: string) => {
        if (!injectedExt && !pText.includes(ext.url) && pText.includes(kw)) {
          injectedExt = true;
          const newText = pText.replace(kw, `<a href="${ext.url}" target="_blank" rel="noopener noreferrer">${kw}</a>`);
          return `${pOpen}${newText}${pClose}`;
        }
        return fullP;
      });
    }

    if (injectedExt) {
      if (!actualExternalLinksUsed.some(l => l.url === ext.url)) {
        actualExternalLinksUsed.push({ title: ext.title, url: ext.url });
      }
    }
  }

  // GUARANTEE AT LEAST 2 EXTERNAL LINKS
  if (actualExternalLinksUsed.length < 2) {
    for (const ext of defaultExternalLinkCandidates) {
      if (actualExternalLinksUsed.length >= 2) break;
      if (finalContentHtml.includes(ext.url)) continue;

      let injectedSentence = false;
      let pIndex = 0;
      finalContentHtml = finalContentHtml.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/gi, (fullP: string, pOpen: string, pText: string, pClose: string) => {
        pIndex++;
        if (!injectedSentence && pIndex >= 4 && !pText.includes('<a ') && pText.length > 50) {
          injectedSentence = true;
          return `${pOpen}${pText} ${ext.contextSentence}${pClose}`;
        }
        return fullP;
      });

      if (injectedSentence) {
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

  // GUARANTEE VISIBLE FAQ SECTION IN CONTENT HTML
  // First clean out any existing partial FAQ tags to avoid duplicates
  finalContentHtml = finalContentHtml.replace(/<h2[^>]*>(常见问题解答|FAQ|常见问题)[\s\S]*?(<\/div>|$)/gi, '');

  let faqSectionHtml = `\n<h2>常见问题解答（FAQ）</h2>\n<div class="faq-container space-y-4 my-6">\n`;
  for (const faq of faqItems) {
    faqSectionHtml += `  <div class="faq-item mb-4 p-4 rounded-xl bg-slate-900 border border-slate-800">\n    <h3 class="font-bold text-slate-100 mb-2">${faq.question}</h3>\n    <p class="text-slate-300 text-sm leading-relaxed">${faq.answer}</p>\n  </div>\n`;
  }
  faqSectionHtml += `</div>\n`;

  // Always append visible FAQ section
  finalContentHtml += faqSectionHtml;

  // Inject Google FAQ Schema script tag directly into HTML for Google Rich Snippets
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

  // Ensure main keyword is distinctly separated with spaces in Title (e.g., " Telegram怎么用 ：...")
  // Always guarantee 'Telegram' has capitalized 'T'
  let safeTitle = (parsed.title || '').trim().replace(/【|】|\[|\]/g, '');
  safeTitle = safeTitle.replace(/telegram/gi, 'Telegram');

  if (!safeTitle.includes(keyword)) {
    safeTitle = ` ${keyword} ：${safeTitle}`;
  } else {
    // Ensure clean space separation around keyword
    safeTitle = safeTitle.replace(keyword, ` ${keyword} `).replace(/\s+/g, ' ').trim();
    if (!safeTitle.includes('：') && !safeTitle.includes('-')) {
      safeTitle = safeTitle.replace(new RegExp(`\\s*${keyword}\\s*`), ` ${keyword} ： `);
    }
  }
  // Double ensure T is capitalized
  safeTitle = safeTitle.replace(/telegram/gi, 'Telegram');

  // Ensure main keyword is prominently standalone with spaces at beginning of Meta Description
  let safeMetaDesc = (parsed.metaDescription || '').trim().replace(/【|】|\[|\]/g, '');
  safeMetaDesc = safeMetaDesc.replace(/telegram/gi, 'Telegram');
  if (!safeMetaDesc.includes(keyword)) {
    safeMetaDesc = `针对 ${keyword} ，本文提供全面实用的中文指南。${safeMetaDesc}`;
  } else {
    safeMetaDesc = safeMetaDesc.replace(keyword, ` ${keyword} `).replace(/\s+/g, ' ').trim();
  }
  safeMetaDesc = safeMetaDesc.replace(/telegram/gi, 'Telegram');

  // Remove any bracketed keyword formatting in contentHtml
  finalContentHtml = finalContentHtml.replace(new RegExp(`【\\s*${keyword}\\s*】`, 'g'), ` ${keyword} `);
  finalContentHtml = finalContentHtml.replace(new RegExp(`\\[\\s*${keyword}\\s*\\]`, 'g'), ` ${keyword} `);

  // STRICT KEYPHRASE DENSITY & PLACEMENT ENFORCER:
  // User Requirement:
  // 1. Keyword must appear in the 1st paragraph EXACTLY 1 TIME.
  // 2. Keyword must appear in the ENTIRE article EXACTLY 2 TIMES (never 3 or more, never 0).

  const kwRegex = new RegExp(keyword, 'g');

  // Step 1: Ensure first paragraph has EXACTLY 1 occurrence
  const firstPOpen = finalContentHtml.indexOf('<p');
  if (firstPOpen !== -1) {
    const firstPClose = finalContentHtml.indexOf('</p>', firstPOpen);
    if (firstPClose !== -1) {
      let firstP = finalContentHtml.slice(firstPOpen, firstPClose + 4);
      let restContent = finalContentHtml.slice(firstPClose + 4);

      // Check how many times keyword is in first paragraph
      const firstPMatchCount = (firstP.match(kwRegex) || []).length;
      if (firstPMatchCount === 0) {
        // Add cleanly at beginning of first paragraph
        const cleanInsert = `对于关注 ${keyword} 的用户而言，掌握官方正版的操作与设置至关重要。`;
        firstP = firstP.replace(/(<p[^>]*>)/i, `$1${cleanInsert}`);
      } else if (firstPMatchCount > 1) {
        // Keep only the first occurrence in 1st paragraph, replace subsequent ones
        let countInFirst = 0;
        firstP = firstP.replace(kwRegex, (m: string) => {
          countInFirst++;
          return countInFirst === 1 ? m : '相关功能';
        });
      }

      // Step 2: Now in restContent, allow EXACTLY 1 occurrence (total in entire article = 2)
      let countInRest = 0;
      restContent = restContent.replace(kwRegex, (m: string) => {
        countInRest++;
        return countInRest === 1 ? m : '该功能';
      });

      // If restContent had 0 occurrences, inject 1 occurrence in a middle paragraph
      if (countInRest === 0) {
        let injectedMiddle = false;
        let pIdx = 0;
        restContent = restContent.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/gi, (fullP: string, pOpen: string, pText: string, pClose: string) => {
          pIdx++;
          if (!injectedMiddle && pIdx >= 4 && !pText.includes('<a ')) {
            injectedMiddle = true;
            return `${pOpen}${pText} 熟练运用 ${keyword} 可以显著提高日常沟通与协作体验。${pClose}`;
          }
          return fullP;
        });
      }

      finalContentHtml = finalContentHtml.slice(0, firstPOpen) + firstP + restContent;
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
