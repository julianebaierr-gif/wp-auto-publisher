import { NextRequest, NextResponse } from 'next/server';
import { fetchExistingPosts } from '@/lib/wordpress';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wpUrl = searchParams.get('wpUrl') || undefined;

    const posts = await fetchExistingPosts(wpUrl);
    return NextResponse.json({
      success: true,
      count: posts.length,
      posts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
