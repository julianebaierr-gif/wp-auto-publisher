import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToWordPress, publishPostToWordPress } from '@/lib/wordpress';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { article, images, settings = {} } = body;

    if (!article || !article.title || !article.contentHtml) {
      return NextResponse.json({ error: 'Article data is required to publish' }, { status: 400 });
    }

    const wpUrl = settings.wpUrl || process.env.WORDPRESS_URL || 'https://tgcenters.com';
    const wpUsername = settings.wpUsername || process.env.WORDPRESS_USERNAME || 'n8n-bot';
    const wpAppPassword = settings.wpAppPassword || process.env.WORDPRESS_APP_PASSWORD || 'RPbI TjbC Hb08 wC5E Ok0U Dtpo';
    const publishStatus = settings.publishStatus || (process.env.WORDPRESS_DEFAULT_STATUS as 'publish' | 'draft') || 'draft';


    if (!wpUsername || !wpAppPassword) {
      return NextResponse.json(
        { error: 'WordPress username and Application Password are required to publish.' },
        { status: 400 }
      );
    }

    const slug = article.slug || 'trading-article';

    // 1. Featured Image: use already uploaded media or upload if needed
    let featuredMediaId: number | undefined = images?.featured?.id ? Number(images.featured.id) : undefined;
    let featuredMediaSourceUrl: string | undefined = images?.featured?.url;

    if (!featuredMediaId && images?.featured?.url) {
      if (images.featured.url.includes('/wp-content/uploads/')) {
        featuredMediaSourceUrl = images.featured.url;
      } else {
        try {
          console.log('Uploading featured image to WordPress media library...');
          const featuredMedia = await uploadImageToWordPress({
            imageUrl: images.featured.url,
            filename: `${slug}-featured.jpg`,
            title: `${article.title} - Featured Image`,
            altText: images.featured.alt || `${article.focusKeyword} - Telegram官方指南`,
            wpUrl,
            username: wpUsername,
            appPassword: wpAppPassword,
          });
          if (featuredMedia.id) featuredMediaId = featuredMedia.id;
          featuredMediaSourceUrl = featuredMedia.sourceUrl;
        } catch (featErr: any) {
          console.warn('Featured image upload skipped:', featErr.message);
        }
      }
    }

    // 2. In-Article Image: check if already in WordPress media library
    let finalContentHtml = article.contentHtml;
    if (!images?.inArticle?.id && images?.inArticle?.url && !images.inArticle.url.includes('/wp-content/uploads/')) {
      try {
        console.log('Uploading in-article image to WordPress media library...');
        const inArticleMedia = await uploadImageToWordPress({
          imageUrl: images.inArticle.url,
          filename: `${slug}-diagram.jpg`,
          title: `${article.title} - 操作设置图解`,
          altText: images.inArticle.alt || `${article.focusKeyword} - Telegram核心设置图解`,
          wpUrl,
          username: wpUsername,
          appPassword: wpAppPassword,
        });

        if (inArticleMedia.sourceUrl && inArticleMedia.id) {
          finalContentHtml = finalContentHtml.split(images.inArticle.url).join(inArticleMedia.sourceUrl);
        }
      } catch (inArtErr: any) {
        console.warn('In-article image upload skipped:', inArtErr.message);
      }
    }

    // 3. Publish to WordPress with Yoast SEO Meta & Auto Category & Optional Schedule Date
    console.log('Publishing post to WordPress with Auto-Category...');
    const categoryId = article.category?.id || (await import('@/lib/wordpress')).autoDetermineCategory(article.focusKeyword, article.title).id;
    const scheduleDate = body.scheduleDate || undefined;

    const publishedPost = await publishPostToWordPress({
      title: article.title,
      slug: article.slug,
      contentHtml: finalContentHtml,
      metaDescription: article.metaDescription,
      focusKeyword: article.focusKeyword,
      featuredMediaId,
      categoryId,
      status: scheduleDate ? 'future' : publishStatus,
      date: scheduleDate,
      wpUrl,
      username: wpUsername,
      appPassword: wpAppPassword,
    });

    return NextResponse.json({
      success: true,
      postId: publishedPost.id,
      postUrl: publishedPost.link,
      status: publishStatus,
      featuredImageUrl: featuredMediaSourceUrl,
    });
  } catch (error: any) {
    console.error('Error during publish to WordPress:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to publish post to WordPress' },
      { status: 500 }
    );
  }
}
