import type {
  AuthSession,
  CommentItem,
  CreateImagePayload,
  FeedUser,
  HealthStats,
  ImageItem,
  LikeToggleResult,
  UpdateImagePayload,
  UploadFile,
} from '@/types/image';
import { mediaTypeFromFile, normalizeAssetTypes } from './media';

const normalizeApiBase = (value: string) => value.trim().replace(/\/$/, '');

const HF_SPACE_FALLBACK = 'https://REDACTED.example.com';
const rawApiBase = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_API_BASE ?? '' : '';
const hasExplicitBase = !!rawApiBase;
export const API_BASE = normalizeApiBase(rawApiBase || HF_SPACE_FALLBACK);

const withApiBase = (value: string) => {
  if (!value || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return `${API_BASE}${value}`;
};

const normalizeSession = (session: AuthSession): AuthSession => ({
  ...session,
  loginUrl: withApiBase(session.loginUrl),
  googleLoginUrl: session.googleLoginUrl ? withApiBase(session.googleLoginUrl) : undefined,
  emailLoginUrl: session.emailLoginUrl ? withApiBase(session.emailLoginUrl) : undefined,
});

const normalizeImageItem = (item: ImageItem): ImageItem => {
  const imageUrls = (item.imageUrls ?? []).map(withApiBase);
  return {
    ...item,
    tags: item.tags ?? [],
    timeMode: item.timeMode ?? 'point',
    startAt: item.startAt ?? item.capturedAt ?? item.createdAt,
    endAt: item.timeMode === 'range' ? item.endAt : undefined,
    capturedAt: item.capturedAt ?? item.startAt ?? item.createdAt,
    imageUrls,
    assetTypes: normalizeAssetTypes(imageUrls, item.assetTypes),
  };
};

const normalizeCommentItem = (item: CommentItem): CommentItem => {
  const imageUrls = (item.imageUrls ?? (item.imageUrl ? [item.imageUrl] : [])).map(withApiBase);
  return {
    ...item,
    imageUrl: imageUrls[0],
    imageUrls,
    assetTypes: normalizeAssetTypes(imageUrls, item.assetTypes),
    likeCount: item.likeCount ?? 0,
    liked: !!item.liked,
  };
};

const extractErrorMessage = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.error || payload.message || 'Request failed';
  }

  const text = await response.text();
  if (text.includes('<!DOCTYPE html') || text.includes('<html')) {
    return 'Backend returned HTML. Check API base/proxy configuration.';
  }

  return text || 'Request failed';
};

const request = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const doFetch = async (url: string) => {
    const response = await fetch(url, {
      credentials: 'include',
      ...init,
    });

    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(await extractErrorMessage(response));
    }

    return (await response.json()) as T;
  };

  try {
    return await doFetch(input);
  } catch (err: any) {
    if (
      hasExplicitBase &&
      API_BASE.includes('.hf.space') &&
      input.startsWith(API_BASE) &&
      err instanceof Error &&
      typeof err.message === 'string' &&
      err.message.includes('HTML')
    ) {
      const alt = input.replace(API_BASE, '');
      return await doFetch(alt);
    }

    if (
      hasExplicitBase &&
      (input.startsWith('/') || input.startsWith(API_BASE)) &&
      err instanceof Error &&
      (err.message.includes('redirect') || err.message.includes('Too many redirects'))
    ) {
      const alt = input.startsWith('/') ? HF_SPACE_FALLBACK + input : input.replace(API_BASE, HF_SPACE_FALLBACK);
      try {
        return await doFetch(alt);
      } catch {
        // fall through
      }
    }

    throw err;
  }
};

type SignedUpload = {
  publicId: string;
  uploadUrl: string;
  apiKey: string;
  timestamp: string;
  signature: string;
  resourceType: 'image' | 'video';
  invalidate: string;
  overwrite: string;
};

type UploadPlan = {
  imageId?: string;
  commentId?: string;
  uploads: SignedUpload[];
};

type UploadItem = {
  file: UploadFile;
  mediaType: 'image' | 'video';
};

const prepareUploadItems = async (files: UploadFile[]): Promise<UploadItem[]> =>
  files.map((file) => ({
    file,
    mediaType: mediaTypeFromFile(file),
  }));

const toFormFile = (file: UploadFile) => ({
  uri: file.uri,
  name: file.name || 'upload',
  type: file.type || 'application/octet-stream',
});

const uploadToCloudinary = async (signed: SignedUpload, file: UploadFile) => {
  const formData = new FormData();
  formData.append('file', toFormFile(file) as any);
  formData.append('api_key', signed.apiKey);
  formData.append('timestamp', signed.timestamp);
  formData.append('signature', signed.signature);
  formData.append('public_id', signed.publicId);
  formData.append('invalidate', signed.invalidate || 'true');
  formData.append('overwrite', signed.overwrite || 'true');

  const response = await fetch(signed.uploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let message = 'Cloudinary upload failed';
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      if (payload?.error?.message) {
        message = payload.error.message;
      }
    } catch {
      try {
        const text = await response.text();
        if (text) {
          message = text;
        }
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }
};

type CommentPayloadOptions = {
  parentId?: string | null;
  replyToUserLogin?: string | null;
};

export const api = {
  getSession: async () => normalizeSession(await request<AuthSession>(`${API_BASE}/api/auth/session`)),
  requestEmailLogin: (email: string, endpoint?: string) =>
    request<{ ok: boolean }>(endpoint ?? `${API_BASE}/api/auth/email/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
  logout: () => request<{ ok: boolean }>(`${API_BASE}/api/auth/logout`, { method: 'POST' }),
  getFeed: async () => (await request<ImageItem[]>(`${API_BASE}/api/feed`)).map(normalizeImageItem),
  getFeedUsers: () => request<FeedUser[]>(`${API_BASE}/api/feed/users`),
  getFollowing: () => request<FeedUser[]>(`${API_BASE}/api/following`),
  getFollowers: () => request<FeedUser[]>(`${API_BASE}/api/followers`),
  followUser: (login: string) =>
    request<{ ok: boolean }>(`${API_BASE}/api/follow/${encodeURIComponent(login)}`, { method: 'POST' }),
  unfollowUser: (login: string) =>
    request<{ ok: boolean }>(`${API_BASE}/api/follow/${encodeURIComponent(login)}`, { method: 'DELETE' }),
  createImage: async (payload: CreateImagePayload) => {
    const imagesEndpoint =
      API_BASE === '' || API_BASE.includes('.hf.space')
        ? `${API_BASE}/api/images/`
        : `${API_BASE}/api/images`;

    const basePayload = {
      description: payload.description,
      tags: payload.tags,
      timeMode: payload.timeMode,
      startAt: payload.startAt,
      endAt: payload.endAt,
    };

    if (!payload.files || payload.files.length === 0) {
      return normalizeImageItem(
        await request<ImageItem>(imagesEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(basePayload),
        })
      );
    }

    const items = await prepareUploadItems(payload.files);
    const plan = await request<UploadPlan>(`${API_BASE}/api/uploads/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((item) => ({ mediaType: item.mediaType })),
      }),
    });

    if (!plan.uploads || plan.uploads.length !== items.length) {
      throw new Error('Upload plan mismatch');
    }

    await Promise.all(plan.uploads.map((upload, index) => uploadToCloudinary(upload, items[index].file)));

    const assetPaths = plan.uploads.map((upload) => upload.publicId);
    return normalizeImageItem(
      await request<ImageItem>(imagesEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...basePayload,
          id: plan.imageId,
          assetPaths,
        }),
      })
    );
  },
  updateImage: async (payload: UpdateImagePayload) => {
    const basePayload = {
      description: payload.description,
      tags: payload.tags,
      timeMode: payload.timeMode,
      startAt: payload.startAt,
      endAt: payload.endAt,
    };

    if (!payload.files || payload.files.length === 0) {
      return normalizeImageItem(
        await request<ImageItem>(`${API_BASE}/api/my/images/${payload.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(basePayload),
        })
      );
    }

    const items = await prepareUploadItems(payload.files);
    const plan = await request<UploadPlan>(`${API_BASE}/api/uploads/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageId: payload.id,
        items: items.map((item) => ({ mediaType: item.mediaType })),
      }),
    });

    if (!plan.uploads || plan.uploads.length !== items.length) {
      throw new Error('Upload plan mismatch');
    }

    await Promise.all(plan.uploads.map((upload, index) => uploadToCloudinary(upload, items[index].file)));

    const assetPaths = plan.uploads.map((upload) => upload.publicId);
    return normalizeImageItem(
      await request<ImageItem>(`${API_BASE}/api/my/images/${payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...basePayload,
          assetPaths,
        }),
      })
    );
  },
  deleteImage: (id: string) => request<{ ok: boolean }>(`${API_BASE}/api/my/images/${id}`, { method: 'DELETE' }),
  toggleLike: (ownerLogin: string, postID: string) =>
    request<LikeToggleResult>(`${API_BASE}/api/images/${ownerLogin}/${postID}/like`, { method: 'POST' }),
  toggleCommentLike: (ownerLogin: string, postID: string, commentID: string) =>
    request<LikeToggleResult>(`${API_BASE}/api/images/${ownerLogin}/${postID}/comments/${commentID}/like`, { method: 'POST' }),
  getComments: async (ownerLogin: string, postID: string) => {
    const items = await request<CommentItem[]>(`${API_BASE}/api/images/${ownerLogin}/${postID}/comments`);
    return items.map(normalizeCommentItem);
  },
  addComment: async (ownerLogin: string, postID: string, text: string, files?: UploadFile[], options?: CommentPayloadOptions) => {
    if (files && files.length > 0) {
      const items = await prepareUploadItems(files);
      const plan = await request<UploadPlan>(`${API_BASE}/api/uploads/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postOwner: ownerLogin,
          postId: postID,
          items: items.map((item) => ({ mediaType: item.mediaType })),
        }),
      });

      if (!plan.uploads || plan.uploads.length !== items.length) {
        throw new Error('Upload plan mismatch');
      }

      await Promise.all(plan.uploads.map((upload, index) => uploadToCloudinary(upload, items[index].file)));

      const payload: Record<string, any> = {
        text,
        commentId: plan.commentId,
        assetPaths: plan.uploads.map((upload) => upload.publicId),
      };
      if (options?.parentId) payload.parentId = options.parentId;
      if (options?.replyToUserLogin) payload.replyToUserLogin = options.replyToUserLogin;

      const item = await request<CommentItem>(`${API_BASE}/api/images/${ownerLogin}/${postID}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return normalizeCommentItem(item);
    }
    const item = await request<CommentItem>(`${API_BASE}/api/images/${ownerLogin}/${postID}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        parentId: options?.parentId ?? '',
        replyToUserLogin: options?.replyToUserLogin ?? '',
      }),
    });
    return normalizeCommentItem(item);
  },
  deleteComment: (ownerLogin: string, postID: string, commentID: string, commenterLogin?: string) => {
    const params = commenterLogin ? `?commenter=${encodeURIComponent(commenterLogin)}` : '';
    return request<{ ok: boolean }>(`${API_BASE}/api/images/${ownerLogin}/${postID}/comments/${commentID}${params}`, { method: 'DELETE' });
  },
  getStats: () => request<HealthStats>(`${API_BASE}/api/health/stats`),
  pingStats: () => request<{ ok: boolean }>(`${API_BASE}/api/health/ping`, { method: 'POST' }),
};
