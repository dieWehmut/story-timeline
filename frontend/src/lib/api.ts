import type {
  AuthSession,
  CommentItem,
  CreateImagePayload,
  FeedUser,
  HealthStats,
  ImageItem,
  LikeToggleResult,
  UpdateImagePayload,
} from '../types/image';
import { mediaTypeFromFile, normalizeAssetTypes } from './media';

const normalizeApiBase = (value: string) => value.trim().replace(/\/$/, '');

// When VITE_API_BASE is unset we use same-origin (empty string) so requests go
// to the current host (e.g. Vercel), where serverless proxy forwards to HF with HF_TOKEN.
// Set VITE_API_BASE to the HF Space URL only when you need the client to call HF directly
// (e.g. local dev against public space without proxy).
const HF_SPACE_FALLBACK = 'https://REDACTED.hf.space';

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE ?? '');

// log the computed base so we can spot misconfiguration in client consoles
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
}

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
    return '后端返回了 HTML 页面，请检查 VITE_API_BASE 或 Vercel API 代理是否正常运行';
  }

  return text || 'Request failed';
};

const request = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const doFetch = async (url: string | URL) => {
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
    return await doFetch(input as any);
  } catch (err: any) {
    // if we hit a HTML page from the HF space base, fall back to proxying via
    // the same origin. this guards against accidentally building the app with
    // VITE_API_BASE set to the space URL while running on Vercel.
    if (
      API_BASE &&
      API_BASE.includes('.hf.space') &&
      typeof input === 'string' &&
      input.startsWith(API_BASE) &&
      err instanceof Error &&
      typeof err.message === 'string' &&
      err.message.includes('HTML 页面')
    ) {
      const alt = input.replace(API_BASE, '');
      console.warn('API request failed against HF URL, retrying via proxy', input, '->', alt);
      return await doFetch(alt);
    }

    // When we use same-origin proxy (API_BASE empty), do not fall back to calling
    // HF directly: the browser would send no HF_TOKEN and get 502. Only retry
    // direct to HF when we had an explicit API_BASE that looks like proxy and failed.
    if (
      API_BASE &&
      typeof input === 'string' &&
      (input.startsWith('/') || input.startsWith(API_BASE)) &&
      (err instanceof Error && (err.message.includes('redirect') || err.message.includes('Too many redirects') || err instanceof TypeError))
    ) {
      const alt = input.startsWith('/') ? HF_SPACE_FALLBACK + input : input.replace(API_BASE, HF_SPACE_FALLBACK);
      try {
        console.warn('API request failed via proxy, retrying direct to HF space', input, '->', alt);
        return await doFetch(alt);
      } catch (innerErr) {
        // continue to throw original error below if direct retry also fails
      }
    }
    throw err;
  }
};

const fileToWebp = async (file: File): Promise<Blob> => {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();

      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Failed to read image file'));
      nextImage.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context unavailable');
    }

    context.drawImage(image, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', 0.92);
    });

    if (!blob) {
      throw new Error('WebP conversion failed');
    }

    return blob;
  } finally {
    URL.revokeObjectURL(imageUrl);
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
  file: File;
  mediaType: 'image' | 'video';
};

const toWebpFile = async (file: File): Promise<File> => {
  const webpBlob = await fileToWebp(file);
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([webpBlob], `${baseName}.webp`, { type: 'image/webp' });
};

const prepareUploadItems = async (files: File[]): Promise<UploadItem[]> => {
  const items: UploadItem[] = [];
  for (const file of files) {
    const mediaType = mediaTypeFromFile(file);
    if (mediaType === 'video') {
      items.push({ file, mediaType: 'video' });
      continue;
    }
    const webpFile = await toWebpFile(file);
    items.push({ file: webpFile, mediaType: 'image' });
  }
  return items;
};

const uploadToCloudinary = async (signed: SignedUpload, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
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
    // Use trailing slash when using proxy (API_BASE empty) or direct HF to avoid redirect loops.
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
  addComment: async (ownerLogin: string, postID: string, text: string, files?: File[], options?: CommentPayloadOptions) => {
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
