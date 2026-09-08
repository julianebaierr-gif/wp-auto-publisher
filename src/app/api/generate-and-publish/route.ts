import { NextRequest, NextResponse } from 'next/server';
import { fetchExistingPosts, uploadImageToWordPress, publishPostToWordPress } from '@/lib/wordpress';
import { generateSeoArticle, generateDalleImage } from '@/lib/openai';

export const maxDuration = 300; // Allow long running generation (up to 5 mins on supported plans)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { keyword, settings = {} } = body;

    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    const trimmedKeyword = keyword.trim();
    const wpUrl = settings.wpUrl || process.env.WORDPRESS_URL || 'https://tgcenters.com';
    const wpUsername = settings.wpUsername || process.env.WORDPRESS_USERNAME || 'n8n-bot';
    const wpAppPassword = settings.wpAppPassword || process.env.WORDPRESS_APP_PASSWORD || 'RPbI TjbC Hb08 wC5E Ok0U Dtpo';
    const openaiApiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
    const publishStatus = settings.publishStatus || (process.env.WORDPRESS_DEFAULT_STATUS as 'publish' | 'draft') || 'draft';


    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is missing. Please provide it in settings or environment variables.' },
        { status: 400 }
      );
    }

    if (!wpUsername || !wpAppPassword) {
      return NextResponse.json(
        { error: 'WordPress username and Application Password are required to publish.' },
        { status: 400 }
      );
    }

    console.log(`[Step 1/5] Fetching existing WordPress posts and categories for keyword "${trimmedKeyword}"...`);
    const [existingPosts, categories] = await Promise.all([
      fetchExistingPosts(wpUrl),
      (await import('@/lib/wordpress')).fetchWordPressCategories(wpUrl, wpUsername, wpAppPassword),
    ]);
    console.log(`Fetched ${existingPosts.length} existing posts and ${categories.length} categories.`);

    console.log(`[Step 2/5] Generating SEO-optimized article with Yoast standards...`);
    const article = await generateSeoArticle({
      keyword: trimmedKeyword,
      existingPosts,
      categories,
      apiKey: openaiApiKey,
    });

    console.log(`[Step 3/5] Generating 2 images with DALL-E 3...`);
    // 1. Featured hero image
    const featuredImageUrl = await generateDalleImage({
      prompt: article.featuredImagePrompt,
      aspect: '1792x1024',
      apiKey: openaiApiKey,
    });

    // 2. In-article image
    const inArticleImageUrl = await generateDalleImage({
      prompt: article.inArticleImagePrompt,
      aspect: '1024x1024',
      apiKey: openaiApiKey,
    });

    console.log(`[Step 4/5] Processing and uploading images...`);
    const slug = article.slug || trimmedKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    let featuredMedia = { id: 0, sourceUrl: featuredImageUrl };
    let inArticleMedia = { id: 0, sourceUrl: inArticleImageUrl };

    try {
      const [featRes, inArtRes] = await Promise.all([
        uploadImageToWordPress({
          imageUrl: featuredImageUrl,
          filename: `${slug}-featured.jpg`,
          title: `${article.title} - Featured Image`,
          altText: `${trimmedKeyword} - Telegram官方使用与下载指南`,
          wpUrl,
          username: wpUsername,
          appPassword: wpAppPassword,
        }).catch((err) => {
          console.warn('Featured upload warning:', err.message);
          return { id: 0, sourceUrl: featuredImageUrl };
        }),
        uploadImageToWordPress({
          imageUrl: inArticleImageUrl,
          filename: `${slug}-guide-diagram.jpg`,
          title: `${article.title} - 操作流程与安全设置图解`,
          altText: `${trimmedKeyword} - Telegram核心设置与操作流程`,
          wpUrl,
          username: wpUsername,
          appPassword: wpAppPassword,
        }).catch((err) => {
          console.warn('In-article upload warning:', err.message);
          return { id: 0, sourceUrl: inArticleImageUrl };
        }),
      ]);

      if (featRes && featRes.sourceUrl) featuredMedia = featRes;
      if (inArtRes && inArtRes.sourceUrl) inArticleMedia = inArtRes;
    } catch (err: any) {
      console.warn('Image upload fallback notice:', err.message);
    }

    // Inject in-article image HTML into content replacing placeholder or at midpoint
    const inArticleImageHtml = `
<figure class="wp-block-image size-large my-6">
  <img src="${inArticleMedia.sourceUrl}" alt="${trimmedKeyword} - Telegram操作图解" class="${inArticleMedia.id ? `wp-image-${inArticleMedia.id}` : ''} rounded-xl shadow-lg border border-slate-700 w-full" />
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

    console.log(`[Step 5/5] Publishing post to WordPress with Yoast SEO metadata & Auto Category...`);
    const categoryId = article.category?.id || (await import('@/lib/wordpress')).autoDetermineCategory(trimmedKeyword, article.title).id;

    const publishedPost = await publishPostToWordPress({
      title: article.title,
      slug: article.slug,
      contentHtml: finalContent,
      metaDescription: article.metaDescription,
      focusKeyword: article.focusKeyword,
      featuredMediaId: featuredMedia.id,
      categoryId,
      status: publishStatus,
      wpUrl,
      username: wpUsername,
      appPassword: wpAppPassword,
    });

    return NextResponse.json({
      success: true,
      postId: publishedPost.id,
      postUrl: publishedPost.link,
      status: publishStatus,
      article: {
        title: article.title,
        slug: article.slug,
        metaDescription: article.metaDescription,
        focusKeyword: article.focusKeyword,
        internalLinksUsed: article.internalLinksUsed,
        yoastScoreEstimate: article.yoastScoreEstimate,
      },
      images: {
        featured: {
          id: featuredMedia.id,
          url: featuredMedia.sourceUrl,
        },
        inArticle: {
          id: inArticleMedia.id,
          url: inArticleMedia.sourceUrl,
        },
      },
    });
  } catch (error: any) {
    console.error('Error during auto-publishing workflow:', error);
    return NextResponse.json(
      {
        error: error.message || 'An unexpected error occurred during generation and publishing',
      },
      { status: 500 }
    );
  }
}
