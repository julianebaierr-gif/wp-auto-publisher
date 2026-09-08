import { NextRequest, NextResponse } from 'next/server';
import { fetchExistingPosts } from '@/lib/wordpress';
import { generateSeoArticle, generateDalleImage } from '@/lib/openai';

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

    console.log(`[Preview Step 1/3] Fetching existing WordPress posts for keyword "${trimmedKeyword}"...`);
    const existingPosts = await fetchExistingPosts(wpUrl);

    console.log(`[Preview Step 2/3] Generating SEO article with Yoast standards...`);
    const article = await generateSeoArticle({
      keyword: trimmedKeyword,
      existingPosts,
      apiKey: openaiApiKey,
    });

    console.log(`[Preview Step 3/3] Generating 2 images with DALL-E 3 for preview...`);
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

    // Construct preview content with in-article image preview
    const inArticleImageHtml = `
<figure class="wp-block-image size-large my-6">
  <img src="${inArticleImageUrl}" alt="${trimmedKeyword} - Technical Chart Analysis Diagram" class="rounded-xl shadow-lg border border-slate-700 w-full" />
  <figcaption class="text-center text-xs text-slate-400 mt-2 italic">${trimmedKeyword} Analysis & Key Trading Concepts</figcaption>
</figure>
`;

    let finalContent = article.contentHtml;
    if (finalContent.includes('<!-- IN_ARTICLE_IMAGE_HERE -->')) {
      finalContent = finalContent.replace('<!-- IN_ARTICLE_IMAGE_HERE -->', inArticleImageHtml);
    } else {
      const firstH2Close = finalContent.indexOf('</h2>');
      if (firstH2Close !== -1) {
        const nextParagraphEnd = finalContent.indexOf('</p>', firstH2Close);
        if (nextParagraphEnd !== -1) {
          finalContent =
            finalContent.slice(0, nextParagraphEnd + 4) +
            inArticleImageHtml +
            finalContent.slice(nextParagraphEnd + 4);
        } else {
          finalContent = inArticleImageHtml + finalContent;
        }
      } else {
        finalContent = inArticleImageHtml + finalContent;
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
          url: featuredImageUrl,
          alt: `${trimmedKeyword} - Complete Trading Guide Overview`,
        },
        inArticle: {
          url: inArticleImageUrl,
          alt: `${trimmedKeyword} - Technical Analysis and Setup Diagram`,
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
