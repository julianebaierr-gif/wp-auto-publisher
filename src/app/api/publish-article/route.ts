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

    // 1. Upload Featured Image to WordPress Media Library
    let featuredMediaId: number | undefined;
    let featuredMediaSourceUrl: string | undefined;

    if (images?.featured?.url) {
      console.log('Uploading featured image to WordPress media library...');
      const featuredMedia = await uploadImageToWordPress({
        imageUrl: images.featured.url,
        filename: `${slug}-featured.png`,
        title: `${article.title} - Featured Image`,
        altText: images.featured.alt || `${article.focusKeyword} - Telegram官方指南`,
        wpUrl,
        username: wpUsername,
        appPassword: wpAppPassword,
      });
      featuredMediaId = featuredMedia.id;
      featuredMediaSourceUrl = featuredMedia.sourceUrl;
    }

    // 2. Upload In-Article Image and replace URL in HTML if needed
    let finalContentHtml = article.contentHtml;
    if (images?.inArticle?.url) {
      console.log('Uploading in-article image to WordPress media library...');
      const inArticleMedia = await uploadImageToWordPress({
        imageUrl: images.inArticle.url,
        filename: `${slug}-diagram.png`,
        title: `${article.title} - 操作设置图解`,
        altText: images.inArticle.alt || `${article.focusKeyword} - Telegram核心设置图解`,
        wpUrl,
        username: wpUsername,
        appPassword: wpAppPassword,
      });

      // Replace temporary DALL-E URL in content with permanent WordPress media URL
      finalContentHtml = finalContentHtml.split(images.inArticle.url).join(inArticleMedia.sourceUrl);
    }

    // 3. Publish to WordPress with Yoast SEO Meta
    console.log('Publishing post to WordPress...');
    const publishedPost = await publishPostToWordPress({
      title: article.title,
      slug: article.slug,
      contentHtml: finalContentHtml,
      metaDescription: article.metaDescription,
      focusKeyword: article.focusKeyword,
      featuredMediaId,
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
