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

export interface HealthStats {
  visitorCount: number;
  activeViewers: number;
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
  roleLabel: string;
  user: AuthUser | null;
}