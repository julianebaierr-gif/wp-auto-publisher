import fs from 'fs';
import path from 'path';
import { WPPostSummary } from '@/types';
import { getPreviewImage } from '@/lib/imageStore';

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


const KNOWN_TGCENTERS_PAGES: Record<string, string> = {
  'telegram-download': 'Telegram下载：官方下载、安装与注册完整指南',
  'telegram-registration-tutorial': 'Telegram注册教程：账号注册、验证码验证与登录完整指南',
  'telegram-chinese-language': 'Telegram中文设置：中文语言包安装与汉化完整指南',
  'telegram-official-website': 'Telegram官网：官方网站入口、下载方式与平台功能完整指南',
  'telegram-channels-groups': 'Telegram频道与群组：订阅频道、加入群组与社群管理实用手册',
  'telegram-privacy-settings': 'Telegram隐私设置：账号安全、号码隐藏与消息保护完整指南',
  'telegram-faq': 'Telegram常见问题：下载、注册、登录、隐私与使用指南',
  'telegram-verification-code-not-received': 'Telegram收不到验证码怎么办：原因分析与解决方法',
  'telegram-macos-download': 'Telegram macOS版下载：Mac版官方客户端下载',
  'telegram-iphone-download': 'Telegram苹果版下载：iPhone与iPad版官方下载',
  'telegram-desktop-download': 'Telegram电脑版下载：Windows PC版官方下载',
  'telegram-android-download': 'Telegram安卓版下载：Telegram安卓版官方下载、安装与注册指南',
  'telegram-web-login': 'Telegram网页版登录：Telegram Web在线登录入口与使用教程',
  'blog': 'Telegram博客：Telegram下载、注册、隐私与使用教程',
};

/**
 * Fetch all existing URLs from post-sitemap.xml and page-sitemap.xml with accurate Chinese titles
 */
export async function fetchExistingPosts(wpUrl?: string): Promise<WPPostSummary[]> {
  const baseUrl = getWpBaseUrl(wpUrl);
  const results: WPPostSummary[] = [];
  const seenUrls = new Set<string>();

  const sitemaps = [
    `${baseUrl}/post-sitemap.xml`,
    `${baseUrl}/page-sitemap.xml`,
  ];

  for (const sitemapUrl of sitemaps) {
    try {
      console.log(`Scanning sitemap: ${sitemapUrl}`);
      const res = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        cache: 'no-store',
      });

      if (res.ok) {
        const xml = await res.text();
        const locMatches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];

        for (const m of locMatches) {
          const link = m[1].trim();
          if (!seenUrls.has(link) && !link.endsWith('.xml') && link !== `${baseUrl}/`) {
            seenUrls.add(link);
            const slug = link.replace(baseUrl, '').replace(/^\/|\/$/g, '');
            
            // Check known Chinese dictionary first
            let title = KNOWN_TGCENTERS_PAGES[slug];
            if (!title) {
              title = slug
                .split(/[-_]/)
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
            }

            results.push({
              id: results.length + 1,
              title,
              link,
              slug,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`Could not read sitemap ${sitemapUrl}:`, err);
    }
  }

  // Also query REST API to get exact post titles if available
  try {
    const res = await fetch(`${baseUrl}/wp-json/wp/v2/posts?per_page=50&status=publish`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const posts = await res.json();
      if (Array.isArray(posts)) {
        for (const p of posts) {
          const item = results.find((r) => r.slug === p.slug || r.link === p.link);
          if (item) {
            item.title = (p.title?.rendered || item.title).replace(/<[^>]*>/g, '');
          }
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  console.log(`Loaded ${results.length} URLs from XML sitemaps for internal linking.`);
  return results;
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

  let buffer: Buffer | null = null;
  let contentType = 'image/png';
  let extension = 'png';

  // If imageUrl is our local image path or proxy (e.g. /temp_images/img_... or /api/image-proxy?id=img_...)
  if (imageUrl.includes('temp_images') || imageUrl.includes('image-proxy') || imageUrl.includes('img_')) {
    const idMatch = imageUrl.match(/(img_[0-9]+_[a-zA-Z0-9]+)/);
    if (idMatch) {
      const cleanId = idMatch[1];
      const localFilePath = path.join(process.cwd(), 'public', 'temp_images', `${cleanId}.png`);
      if (fs.existsSync(localFilePath)) {
        buffer = fs.readFileSync(localFilePath);
        contentType = 'image/png';
        extension = 'png';
      } else {
        const storedData = getPreviewImage(cleanId);
        if (storedData) {
          imageUrl = storedData;
        }
      }
    }
  }

  // If buffer was loaded directly from local file
  if (!buffer!) {
    if (imageUrl.startsWith('data:')) {
      const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        contentType = matches[1];
        extension = contentType.includes('png') ? 'png' : 'jpg';
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        throw new Error('Invalid base64 data URI');
      }
    } else if (imageUrl.startsWith('/')) {
      const localUrl = `http://localhost:3000${imageUrl}`;
      try {
        const res = await fetch(localUrl);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
          contentType = res.headers.get('content-type') || 'image/png';
          extension = contentType.includes('png') ? 'png' : 'jpg';
        }
      } catch (e) {
        console.warn('Could not fetch relative image via localhost:', e);
      }
    } else {
      // Download image from remote URL
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        throw new Error(`Failed to download generated image: ${imageRes.statusText}`);
      }
      contentType = imageRes.headers.get('content-type') || 'image/jpeg';
      extension = contentType.includes('png') ? 'png' : 'jpg';
      const arrayBuffer = await imageRes.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }
  }


  if (!buffer) {
    throw new Error(`Failed to load image buffer for upload: ${imageUrl}`);
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
      _yoast_wpseo_title: `${title} - TG Center`,
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
