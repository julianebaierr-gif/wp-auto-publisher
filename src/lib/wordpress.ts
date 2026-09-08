import { WPPostSummary } from '@/types';

export function getWpAuthHeaders(username?: string, appPassword?: string) {
  const user = username || process.env.WORDPRESS_USERNAME || '';
  // Clean spaces from application password if any
  const pass = (appPassword || process.env.WORDPRESS_APP_PASSWORD || '').replace(/\s+/g, '');
  const token = Buffer.from(`${user}:${pass}`).toString('base64');
  return {
    Authorization: `Basic ${token}`,
  };
}

export function getWpBaseUrl(wpUrl?: string): string {
  const url = wpUrl || process.env.WORDPRESS_URL || 'https://tgcenters.com';
  return url.replace(/\/+$/, '');
}


/**
 * Fetch existing posts from WordPress for internal linking context
 */
export async function fetchExistingPosts(wpUrl?: string): Promise<WPPostSummary[]> {
  try {
    const baseUrl = getWpBaseUrl(wpUrl);
    // Fetch up to 100 recent posts
    const endpoint = `${baseUrl}/wp-json/wp/v2/posts?per_page=100&_fields=id,title,link,slug&status=publish`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.warn(`Failed to fetch existing posts: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      id: item.id,
      title: item.title?.rendered || item.slug,
      link: item.link || `${baseUrl}/${item.slug}`,
      slug: item.slug,
    }));
  } catch (error) {
    console.error('Error fetching existing WP posts:', error);
    return [];
  }
}

/**
 * Upload an image (buffer or external URL) to WordPress Media Library
 */
export async function uploadImageToWordPress({
  imageUrl,
  filename,
  title,
  altText,
  wpUrl,
  username,
  appPassword,
}: {
  imageUrl: string;
  filename: string;
  title: string;
  altText: string;
  wpUrl?: string;
  username?: string;
  appPassword?: string;
}): Promise<{ id: number; sourceUrl: string }> {
  const baseUrl = getWpBaseUrl(wpUrl);
  const authHeaders = getWpAuthHeaders(username, appPassword);

  let buffer: Buffer;
  let contentType = 'image/png';
  let extension = 'png';

  if (imageUrl.startsWith('data:')) {
    const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      contentType = matches[1];
      extension = contentType.includes('png') ? 'png' : 'jpg';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      throw new Error('Invalid base64 data URI');
    }
  } else {
    // Download image from URL
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to download generated image: ${imageRes.statusText}`);
    }
    contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    extension = contentType.includes('png') ? 'png' : 'jpg';
    const arrayBuffer = await imageRes.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  }

  const cleanFilename = filename.endsWith(`.${extension}`) ? filename : `${filename}.${extension}`;

  const uploadEndpoint = `${baseUrl}/wp-json/wp/v2/media`;
  const uploadRes = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Disposition': `attachment; filename="${cleanFilename}"`,
      'Content-Type': contentType,
    },
    body: new Uint8Array(buffer),
  });




  if (!uploadRes.ok) {
    const errBody = await uploadRes.text();
    throw new Error(`Failed to upload media to WordPress (${uploadRes.status}): ${errBody}`);
  }

  const mediaData = await uploadRes.json();

  // Update alt text and title for SEO
  try {
    await fetch(`${baseUrl}/wp-json/wp/v2/media/${mediaData.id}`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title,
        alt_text: altText,
        description: altText,
        caption: altText,
      }),
    });
  } catch (e) {
    console.warn('Could not update image alt_text metadata:', e);
  }

  return {
    id: mediaData.id,
    sourceUrl: mediaData.source_url || mediaData.guid?.rendered || imageUrl,
  };
}

/**
 * Publish post to WordPress with Yoast SEO Meta tags
 */
export async function publishPostToWordPress({
  title,
  slug,
  contentHtml,
  metaDescription,
  focusKeyword,
  featuredMediaId,
  status = 'publish',
  wpUrl,
  username,
  appPassword,
}: {
  title: string;
  slug: string;
  contentHtml: string;
  metaDescription: string;
  focusKeyword: string;
  featuredMediaId?: number;
  status?: 'publish' | 'draft';
  wpUrl?: string;
  username?: string;
  appPassword?: string;
}): Promise<{ id: number; link: string }> {
  const baseUrl = getWpBaseUrl(wpUrl);
  const authHeaders = getWpAuthHeaders(username, appPassword);

  const payload: Record<string, any> = {
    title,
    slug,
    content: contentHtml,
    status,
    // Yoast SEO specific meta values
    meta: {
      _yoast_wpseo_focuskw: focusKeyword,
      _yoast_wpseo_metadesc: metaDescription,
      _yoast_wpseo_title: `${title} - Trading Blog Co`,
    },
  };

  if (featuredMediaId) {
    payload.featured_media = featuredMediaId;
  }

  const res = await fetch(`${baseUrl}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`WordPress Post Publication failed (${res.status}): ${errorText}`);
  }

  const post = await res.json();
  return {
    id: post.id,
    link: post.link,
  };
}

/**
 * Test WordPress Connection & Credentials
 */
export async function testWordPressConnection(wpUrl?: string, username?: string, appPassword?: string): Promise<{ success: boolean; message: string; user?: any }> {
  try {
    const baseUrl = getWpBaseUrl(wpUrl);
    const authHeaders = getWpAuthHeaders(username, appPassword);

    const res = await fetch(`${baseUrl}/wp-json/wp/v2/users/me`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        message: 'Authentication failed. Please verify WordPress username and Application Password.',
      };
    }

    if (!res.ok) {
      return {
        success: false,
        message: `WordPress API responded with status ${res.status}: ${res.statusText}`,
      };
    }

    const user = await res.json();
    return {
      success: true,
      message: `Connected successfully as ${user.name} (${user.slug})`,
      user: { id: user.id, name: user.name, slug: user.slug },
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Connection error: ${err.message}`,
    };
  }
}
