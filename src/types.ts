export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  articleCount?: number;
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  caption?: string;
}

export interface Article {
  id: string;
  title: string;
  subtitle: string;
  slug: string;
  categoryId: string;
  author: string;
  location: string;
  coverImage: string;
  videoUrl?: string;
  mediaGallery: MediaItem[];
  content: string;
  featured: boolean;
  status: 'published' | 'draft';
  publishedAt: string;
  updatedAt: string;
  readTimeMinutes: number;
  likes?: number;
  commentCount?: number;
}

export interface Comment {
  id: string;
  articleId: string;
  parentId?: string;
  authorName: string;
  content: string;
  likes?: number;
  createdAt: string;
}

export interface UploadedAsset {
  filename: string;
  url: string;
  mediaType: 'image' | 'video';
  size: number;
  createdAt: string;
  deletable?: boolean;
}

export interface AdminAuthStatus {
  authenticated: boolean;
  setupRequired: boolean;
  adminEmail?: string;
  token?: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name?: string;
  subscribedAt: string;
}

export type WsClientMessage =
  | { type: 'join_article'; articleId: string }
  | { type: 'leave_article'; articleId: string }
  | { type: 'join_admin' }
  | { type: 'typing'; articleId: string; authorName: string; isTyping: boolean }
  | { type: 'create_comment'; articleId: string; authorName: string; content: string; parentId?: string };

export type WsServerMessage =
  | { type: 'comments:init'; articleId: string; comments: Comment[]; activeReaders: number }
  | { type: 'presence:update'; articleId: string; activeReaders: number }
  | { type: 'typing:update'; articleId: string; authorName: string; isTyping: boolean }
  | { type: 'comment:created'; articleId: string; comment: Comment }
  | { type: 'comment:deleted'; articleId: string; commentId: string }
  | { type: 'comment:liked'; articleId: string; commentId: string; likes: number }
  | { type: 'article:liked'; articleId: string; likes: number }
  | { type: 'article:updated' }
  | { type: 'category:updated' }
  | { type: 'error'; message: string };
