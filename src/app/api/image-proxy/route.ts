import { NextRequest, NextResponse } from 'next/server';
import { getPreviewImage } from '@/lib/imageStore';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return new NextResponse('Image ID missing', { status: 400 });
  }

  const dataUrl = getPreviewImage(id);
  if (!dataUrl) {
    return new NextResponse('Image not found or expired', { status: 404 });
  }

  // Parse data URL: data:image/png;base64,....
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches) {
    return new NextResponse('Invalid image data', { status: 500 });
  }

  const contentType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
