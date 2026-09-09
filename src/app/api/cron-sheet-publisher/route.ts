import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows, DEFAULT_SHEET_ID } from '@/lib/googleSheets';
import { fetchExistingPosts, uploadImageToWordPress, publishPostToWordPress, fetchWordPressCategories, autoDetermineCategory } from '@/lib/wordpress';
import { generateSeoArticle, generateDalleImage } from '@/lib/openai';

export const maxDuration = 300; // Allow 5 minutes for generation & publishing
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log('[Vercel Cron Triggered] Running 8-hour automatic sheet publisher...');
    
    // Read Google Sheet
    const sheetId = process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID;
    const rows = await fetchSheetRows(sheetId);

    // Find first 'Pending' keyword
    const pendingItem = rows.find((r) => r.status.toLowerCase() === 'pending');

    if (!pendingItem) {
      return NextResponse.json({
        success: true,
        message: 'No pending keywords found in Google Sheet. All keywords have been published!',
      });
    }

    const keyword = pendingItem.keyword.trim();
    console.log(`[Cron Publishing] Processing keyword from row ${pendingItem.rowIndex}: "${keyword}"...`);

    const wpUrl = process.env.WORDPRESS_URL || 'https://tgcenters.com';
    const wpUsername = process.env.WORDPRESS_USERNAME || 'n8n-bot';
    const wpAppPassword = process.env.WORDPRESS_APP_PASSWORD || 'RPbI TjbC Hb08 wC5E Ok0U Dtpo';
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not configured');
    }

    // 1. Fetch posts and categories
    const [existingPosts, categories] = await Promise.all([
      fetchExistingPosts(wpUrl),
      fetchWordPressCategories(wpUrl, wpUsername, wpAppPassword),
    ]);

    // 2. Generate 10,000+ words SEO article
    const article = await generateSeoArticle({
      keyword,
      existingPosts,
      categories,
      apiKey: openaiApiKey,
    });

    // 3. Generate 2 AI Images
    const [featuredImageUrl, inArticleImageUrl] = await Promise.all([
      generateDalleImage({
        prompt: article.featuredImagePrompt,
        aspect: '1792x1024',
        apiKey: openaiApiKey,
      }),
      generateDalleImage({
        prompt: article.inArticleImagePrompt,
        aspect: '1024x1024',
        apiKey: openaiApiKey,
      }),
    ]);

    const slug = article.slug || keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let featuredMedia = { id: 0, sourceUrl: featuredImageUrl };
    let inArticleMedia = { id: 0, sourceUrl: inArticleImageUrl };

    // 4. Upload Images to WordPress
    try {
      const [featRes, inArtRes] = await Promise.all([
        uploadImageToWordPress({
          imageUrl: featuredImageUrl,
          filename: `${slug}-featured.jpg`,
          title: `${article.title} - Featured Image`,
          altText: `${keyword} - Telegram官方使用与下载指南`,
          wpUrl,
          username: wpUsername,
          appPassword: wpAppPassword,
        }).catch(() => ({ id: 0, sourceUrl: featuredImageUrl })),
        uploadImageToWordPress({
          imageUrl: inArticleImageUrl,
          filename: `${slug}-guide-diagram.jpg`,
          title: `${article.title} - 操作流程与安全设置图解`,
          altText: `${keyword} - Telegram核心设置与操作流程`,
          wpUrl,
          username: wpUsername,
          appPassword: wpAppPassword,
        }).catch(() => ({ id: 0, sourceUrl: inArticleImageUrl })),
      ]);

      if (featRes && featRes.sourceUrl) featuredMedia = featRes;
      if (inArtRes && inArtRes.sourceUrl) inArticleMedia = inArtRes;
    } catch (err: any) {
      console.warn('Image upload notice:', err.message);
    }

    // 5. Inject in-article image into content
    const inArticleImageHtml = `
<figure class="wp-block-image size-large my-6">
  <img src="${inArticleMedia.sourceUrl}" alt="${keyword} - Telegram操作图解" class="${inArticleMedia.id ? `wp-image-${inArticleMedia.id}` : ''} rounded-xl shadow-lg border border-slate-700 w-full" />
  <figcaption class="text-center text-xs text-slate-400 mt-2 italic">${keyword} 核心操作与流程图解</figcaption>
</figure>
`;

    let finalContent = article.contentHtml;
    if (finalContent.includes('<!-- IN_ARTICLE_IMAGE_HERE -->')) {
      finalContent = finalContent.replace('<!-- IN_ARTICLE_IMAGE_HERE -->', inArticleImageHtml);
    } else {
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

    // 6. Publish immediately to WordPress
    const categoryId = article.category?.id || autoDetermineCategory(keyword, article.title).id;

    const publishedPost = await publishPostToWordPress({
      title: article.title,
      slug: article.slug,
      contentHtml: finalContent,
      metaDescription: article.metaDescription,
      focusKeyword: article.focusKeyword,
      featuredMediaId: featuredMedia.id,
      categoryId,
      status: 'publish',
      wpUrl,
      username: wpUsername,
      appPassword: wpAppPassword,
    });

    console.log(`[Cron Published Successfully] Post URL: ${publishedPost.link}`);

    return NextResponse.json({
      success: true,
      keyword,
      rowIndex: pendingItem.rowIndex,
      status: 'Live',
      postUrl: publishedPost.link,
      title: article.title,
      message: `Article for "${keyword}" has been successfully generated and published live to WordPress.`,
    });
  } catch (error: any) {
    console.error('[Cron Publisher Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Cron job failed during execution' },
      { status: 500 }
    );
  }
}
