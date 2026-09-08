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

  const systemPrompt = `You are a world-class financial trading analyst, senior SEO copywriter, and Yoast SEO 100% score optimization expert for tradingblogco.com.
You write engaging, authoritative, highly accurate, and in-depth articles related to stock trading, forex, crypto, technical analysis, chart patterns, risk management, and trading strategies.

CRITICAL YOAST SEO REQUIREMENTS FOR A PERFECT GREEN SCORE:
1. FOCUS KEYPHRASE: Use the exact keyword as the focus keyphrase.
2. TITLE: Create an irresistible, click-worthy SEO Title (50 to 60 characters max). The focus keyphrase MUST appear at or very near the beginning.
3. META DESCRIPTION: Write an engaging 135-155 character meta description including the exact focus keyphrase and a compelling call-to-action.
4. SLUG: Clean, lowercase, hyphenated URL slug containing the focus keyphrase (e.g. "breakout-trading-strategies").
5. HEADINGS (H2, H3): Structure with clear <h2> and <h3> tags. Use the focus keyphrase in at least 30-50% of the H2/H3 subheadings naturally.
6. KEYPHRASE DISTRIBUTION:
   - Must appear in the FIRST 10% (introductory paragraph) of the text.
   - Maintain a natural 1.0% to 2.5% keyphrase density throughout the entire article.
   - Concluding section must reinforce the keyphrase.
7. ARTICLE LENGTH & VALUE: Comprehensive, detailed, informative content (1200+ words). Use bullet points, comparison tables, step-by-step guides, and FAQ section.
8. INTERNAL LINKING:
   - You MUST naturally embed 3 to 6 contextually relevant internal links to existing website posts from the provided list.
   - Anchor text MUST be descriptive and contextual (never "click here" or "read more").
   - Format: <a href="URL" title="Descriptive Title">descriptive anchor text</a>.
9. IMAGE PLACEHOLDER: Place an HTML comment <!-- IN_ARTICLE_IMAGE_HERE --> around the 40-50% mark of the content where the second educational chart/diagram image should be inserted.
10. FORMAT: Return pure JSON conforming strictly to the requested schema. No markdown codeblocks (\`\`\`json). Return valid raw JSON only.`;

  const userPrompt = `Target Focus Keyword: "${keyword}"

Available Existing Website Posts for Internal Linking:
${JSON.stringify(linkCandidates, null, 2)}

Generate a complete, comprehensive, publication-ready article in JSON format with this exact structure:
{
  "title": "SEO Optimized Catchy Title with Focus Keyword Near Start",
  "slug": "url-friendly-slug-with-keyword",
  "metaDescription": "Engaging 140-155 character meta description with keyword and CTA",
  "focusKeyword": "${keyword}",
  "contentHtml": "<h2>...</h2><p>...</p><!-- IN_ARTICLE_IMAGE_HERE --><p>...</p><h3>FAQ</h3>...",
  "featuredImagePrompt": "Detailed photorealistic DALL-E prompt for featured hero banner representing this trading topic, cinematic lighting, sleek 4k financial theme, no text on image",
  "inArticleImagePrompt": "Detailed photorealistic or 3D technical diagram prompt illustrating the specific trading setup, chart candlestick pattern, or infographic for the middle of article, no misspelled text",
  "internalLinksUsed": [
    { "title": "Existing Post Title", "url": "https://tradingblogco.com/post-url" }
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

  const wordCount = (parsed.contentHtml || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  const kwLower = keyword.toLowerCase();
  const titleLower = (parsed.title || '').toLowerCase();
  const metaDescLower = (parsed.metaDescription || '').toLowerCase();
  const contentLower = (parsed.contentHtml || '').toLowerCase();

  const yoastScoreEstimate = {
    keyphraseInTitle: titleLower.includes(kwLower),
    keyphraseInMetaDesc: metaDescLower.includes(kwLower),
    keyphraseInIntro: contentLower.slice(0, 500).includes(kwLower),
    keyphraseInSubheadings: contentLower.includes(`<h2`) && contentLower.includes(kwLower),
    internalLinksCount: (parsed.internalLinksUsed || []).length,
    wordCount,
  };

  return {
    title: parsed.title,
    slug: parsed.slug || keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
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
 * Generate image using OpenAI DALL-E 3
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

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: `${prompt}. Ultra-high resolution, clean aesthetic, financial trading theme, cinematic lighting, professional digital art, absolutely no words, no letters, no watermark.`,
    n: 1,
    size: aspect,
    quality: 'standard',
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error('DALL-E 3 did not return an image URL');
  }

  return imageUrl;
}
