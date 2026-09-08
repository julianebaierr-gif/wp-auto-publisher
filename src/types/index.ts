export interface WPPostSummary {
  id: number;
  title: string;
  link: string;
  slug: string;
}

export interface WPCategory {
  id: number;
  name: string;
  slug: string;
  count?: number;
}

export interface GenerationSettings {
  openaiApiKey?: string;
  wpUrl?: string;
  wpUsername?: string;
  wpAppPassword?: string;
  publishStatus?: 'publish' | 'draft';
}

export interface GenerationRequest {
  keyword: string;
  category?: string;
  settings?: GenerationSettings;
}

export interface GeneratedArticle {
  title: string;
  slug: string;
  metaDescription: string;
  focusKeyword: string;
  contentHtml: string;
  featuredImagePrompt: string;
  inArticleImagePrompt: string;
  category?: {
    id: number;
    name: string;
  };
  internalLinksUsed: { title: string; url: string }[];
  externalLinksUsed: { title: string; url: string }[];
  yoastScoreEstimate: {
    keyphraseInTitle: boolean;
    keyphraseInMetaDesc: boolean;
    keyphraseInIntro: boolean;
    keyphraseInSubheadings: boolean;
    internalLinksCount: number;
    externalLinksCount: number;
    wordCount: number;
  };
  outline?: {
    heading: string;
    level: 'h2' | 'h3' | 'h4';
    estimatedCharacters: number;
    description: string;
  }[];
  semanticKeywordsUsed?: string[];
  faqItems?: {
    question: string;
    answer: string;
  }[];
}

export interface GenerationProgress {
  step: 'idle' | 'fetching_posts' | 'generating_article' | 'generating_images' | 'uploading_media' | 'publishing' | 'completed' | 'error';
  message: string;
  publishedUrl?: string;
  postId?: number;
  error?: string;
  articlePreview?: GeneratedArticle;
  featuredImageUrl?: string;
  inArticleImageUrl?: string;
}
