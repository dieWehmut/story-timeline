export type ImageTimeMode = 'point' | 'range';
export type MediaType = 'image' | 'video';

export interface ImageItem {
  id: string;
  authorLogin: string;
  authorAvatar: string;
  description: string;
  tags: string[];
  timeMode: ImageTimeMode;
  startAt: string;
  endAt?: string;
  capturedAt?: string;
  imageUrls: string[];
  assetTypes?: MediaType[];
  imagePaths: string[];
  metadataPath: string;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
}

export interface TimelineMonth {
  key: string;
  year: number;
  month: number;
  label: string;
  count: number;
}

export interface CreateImagePayload {
  description: string;
  tags: string[];
  timeMode: ImageTimeMode;
  startAt: string;
  endAt?: string;
  files: File[];
}

export interface UpdateImagePayload {
  id: string;
  description: string;
  tags: string[];
  timeMode: ImageTimeMode;
  startAt: string;
  endAt?: string;
  files?: File[];
  assetOrder?: AssetOrderItem[];
  assetPathMap?: Record<string, string>;
}

export type AssetOrderItem =
  | { kind: 'url'; url: string }
  | { kind: 'file'; index: number };

export interface FeedUser {
  login: string;
  avatarUrl: string;
}

export interface HealthStats {
  userCount: number;
  onlineUsers: number;
  uptimeSeconds: number;
  githubOwner: string;
}

export interface AuthUser {
  id: string;
  login: string;
  avatarUrl: string;
  provider?: string;
}

export interface AuthSession {
  authenticated: boolean;
  loginUrl: string;
  googleLoginUrl?: string;
  emailLoginUrl?: string;
  isAdmin: boolean;
  canPost: boolean;
  roleLabel: string;
  user: AuthUser | null;
}

export interface CommentItem {
  id: string;
  authorLogin: string;
  postOwner: string;
  postId: string;
  text: string;
  imageUrl?: string;
  imageUrls?: string[];
  assetTypes?: MediaType[];
  createdAt: string;
  likeCount: number;
  liked: boolean;
  parentId?: string | null;
  replyToUserLogin?: string | null;
}

export interface LikeToggleResult {
  likeCount: number;
  liked: boolean;
}
