import { NextRequest, NextResponse } from 'next/server';
import { fetchExistingPosts, uploadImageToWordPress } from '@/lib/wordpress';
import { generateSeoArticle, generateDalleImage } from '@/lib/openai';
import { compressImageToDataUri } from '@/lib/imageCompressor';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { keyword, settings = {} } = body;

    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    const trimmedKeyword = keyword.trim();
    const wpUrl = settings.wpUrl || process.env.WORDPRESS_URL || 'https://tgcenters.com';
    const openaiApiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;


    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is missing. Please provide it in settings or environment variables.' },
        { status: 400 }
      );
    }

    console.log(`[Preview Step 1/3] Fetching existing WordPress posts & categories for keyword "${trimmedKeyword}"...`);
    const [existingPosts, categories] = await Promise.all([
      fetchExistingPosts(wpUrl),
      (await import('@/lib/wordpress')).fetchWordPressCategories(wpUrl, settings.wpUsername, settings.wpAppPassword),
    ]);

    console.log(`[Preview Step 2/3] Generating SEO article with Yoast standards...`);
    const article = await generateSeoArticle({
      keyword: trimmedKeyword,
      existingPosts,
      categories,
      apiKey: openaiApiKey,
    });

    console.log(`[Preview Step 3/4] Generating 2 images with OpenAI (gpt-image-1-mini)...`);
    const [rawFeaturedImage, rawInArticleImage] = await Promise.all([
      generateDalleImage({
        prompt: article.featuredImagePrompt,
        aspect: '1024x1024',
        apiKey: openaiApiKey,
      }),
      generateDalleImage({
        prompt: article.inArticleImagePrompt,
        aspect: '1024x1024',
        apiKey: openaiApiKey,
      }),
    ]);

    const slug = article.slug || trimmedKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const wpUsername = settings.wpUsername || process.env.WORDPRESS_USERNAME || 'n8n-bot';
    const wpAppPassword = settings.wpAppPassword || process.env.WORDPRESS_APP_PASSWORD || 'RPbI TjbC Hb08 wC5E Ok0U Dtpo';

    console.log(`[Preview Step 4/4] Optimizing and processing images...`);
    // Compress both images to lightweight JPEGs (~70-100 KB each)
    const [compressedFeatured, compressedInArticle] = await Promise.all([
      compressImageToDataUri(rawFeaturedImage),
      compressImageToDataUri(rawInArticleImage),
    ]);

    let featuredMedia = { id: 0, sourceUrl: compressedFeatured };
    let inArticleMedia = { id: 0, sourceUrl: compressedInArticle };

    try {
      console.log(`Attempting upload to WordPress Media Library...`);
      const [featRes, inArtRes] = await Promise.all([
        uploadImageToWordPress({
          imageUrl: compressedFeatured,
          filename: `${slug}-featured.jpg`,
          title: `${article.title} - Featured Image`,
          altText: `${trimmedKeyword} - Telegram官方使用与下载指南`,
          wpUrl,
          username: wpUsername,
          appPassword: wpAppPassword,
        }).catch((err) => {
          console.warn('Featured image upload warning:', err.message);
          return { id: 0, sourceUrl: compressedFeatured };
        }),
        uploadImageToWordPress({
          imageUrl: compressedInArticle,
          filename: `${slug}-diagram.jpg`,
          title: `${article.title} - 操作流程与安全设置图解`,
          altText: `${trimmedKeyword} - Telegram核心设置与操作流程`,
          wpUrl,
          username: wpUsername,
          appPassword: wpAppPassword,
        }).catch((err) => {
          console.warn('In-article image upload warning:', err.message);
          return { id: 0, sourceUrl: compressedInArticle };
        }),
      ]);

      if (featRes && featRes.sourceUrl) featuredMedia = featRes;
      if (inArtRes && inArtRes.sourceUrl) inArticleMedia = inArtRes;
    } catch (wpUploadErr: any) {
      console.warn('WordPress media upload skipped due to Cloudflare/WAF:', wpUploadErr.message);
    }

    const featuredImageUrl = featuredMedia.sourceUrl || compressedFeatured;
    const inArticleImageUrl = inArticleMedia.sourceUrl || compressedInArticle;

    // Construct preview content with in-article image preview
    const inArticleImageHtml = `
<figure class="wp-block-image size-large my-6">
  <img src="${inArticleImageUrl}" alt="${trimmedKeyword} - Telegram使用教程图解" class="rounded-xl shadow-lg border border-slate-700 w-full" />
  <figcaption class="text-center text-xs text-slate-400 mt-2 italic">${trimmedKeyword} 核心操作与流程图解</figcaption>
</figure>
`;

    let finalContent = article.contentHtml;
    if (finalContent.includes('<!-- IN_ARTICLE_IMAGE_HERE -->')) {
      finalContent = finalContent.replace('<!-- IN_ARTICLE_IMAGE_HERE -->', inArticleImageHtml);
    } else {
      // Find middle H2 or midpoint paragraph to insert 2nd image strictly in middle
      const h2Matches = [...finalContent.matchAll(/<\/h2>/g)];
      if (h2Matches.length >= 2) {
        const midH2 = h2Matches[Math.floor(h2Matches.length / 2)];
        const insertIdx = midH2.index! + 5;
        finalContent = finalContent.slice(0, insertIdx) + inArticleImageHtml + finalContent.slice(insertIdx);
      } else {
        const midPoint = Math.floor(finalContent.length / 2);
        const nextParagraphEnd = finalContent.indexOf('</p>', midPoint);
        if (nextParagraphEnd !== -1) {
          finalContent =
            finalContent.slice(0, nextParagraphEnd + 4) +
            inArticleImageHtml +
            finalContent.slice(nextParagraphEnd + 4);
        } else {
          finalContent = finalContent + inArticleImageHtml;
        }
      }
    }

    return NextResponse.json({
      success: true,
      article: {
        ...article,
        contentHtml: finalContent,
      },
      images: {
        featured: {
          id: featuredMedia.id,
          url: featuredImageUrl,
          alt: `${trimmedKeyword} - Telegram官方使用与下载指南`,
        },
        inArticle: {
          id: inArticleMedia.id,
          url: inArticleImageUrl,
          alt: `${trimmedKeyword} - 操作流程与安全设置图解`,
        },
      },
    });
  } catch (error: any) {
    console.error('Error during generate preview:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while generating article preview' },
      { status: 500 }
    );
  }
}
