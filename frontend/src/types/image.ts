export interface ImageItem {
  id: string;
  authorLogin: string;
  authorAvatar: string;
  description: string;
  capturedAt: string;
  imageUrls: string[];
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
  capturedAt: string;
  files: File[];
}

export interface UpdateImagePayload {
  id: string;
  description: string;
  capturedAt: string;
  files?: File[];
}

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
  id: number;
  login: string;
  avatarUrl: string;
}

export interface AuthSession {
  authenticated: boolean;
  loginUrl: string;
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
  createdAt: string;
}

export interface LikeToggleResult {
  likeCount: number;
  liked: boolean;
}