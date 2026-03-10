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

const normalizeApiBase = (value: string) => value.trim().replace(/\/$/, '');

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE || '');

const withApiBase = (value: string) => {
  if (!value || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return `${API_BASE}${value}`;
};

const normalizeSession = (session: AuthSession): AuthSession => ({
  ...session,
  loginUrl: withApiBase(session.loginUrl),
});

const normalizeImageItem = (item: ImageItem): ImageItem => ({
  ...item,
  tags: item.tags ?? [],
  timeMode: item.timeMode ?? 'point',
  startAt: item.startAt ?? item.capturedAt ?? item.createdAt,
  endAt: item.timeMode === 'range' ? item.endAt : undefined,
  capturedAt: item.capturedAt ?? item.startAt ?? item.createdAt,
  imageUrls: (item.imageUrls ?? []).map(withApiBase),
});

const normalizeCommentItem = (item: CommentItem): CommentItem => {
  const imageUrls = (item.imageUrls ?? (item.imageUrl ? [item.imageUrl] : [])).map(withApiBase);
  return {
    ...item,
    imageUrl: imageUrls[0],
    imageUrls,
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
  const response = await fetch(input, {
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

const buildImageFormData = async (payload: CreateImagePayload | UpdateImagePayload): Promise<FormData> => {
  const formData = new FormData();
  formData.set('description', payload.description);
  payload.tags.forEach((tag) => formData.append('tags', tag));
  formData.set('timeMode', payload.timeMode);
  formData.set('startAt', payload.startAt);
  formData.set('capturedAt', payload.startAt);
  if (payload.endAt) {
    formData.set('endAt', payload.endAt);
  }

  if ('id' in payload) {
    formData.set('id', payload.id);
  }

  const files = 'files' in payload ? (payload.files ?? []) : [];
  for (const file of files) {
    const webpBlob = await fileToWebp(file);
    const fileName = file.name.replace(/\.[^.]+$/, '') || 'image';
    formData.append('files', webpBlob, `${fileName}.webp`);
  }

  return formData;
};

export const api = {
  getSession: async () => normalizeSession(await request<AuthSession>(`${API_BASE}/api/auth/session`)),
  logout: () => request<{ ok: boolean }>(`${API_BASE}/api/auth/logout`, { method: 'POST' }),
  getFeed: async () => (await request<ImageItem[]>(`${API_BASE}/api/feed`)).map(normalizeImageItem),
  getFeedUsers: () => request<FeedUser[]>(`${API_BASE}/api/feed/users`),
  createImage: async (payload: CreateImagePayload) => {
    const body = await buildImageFormData(payload);
    return normalizeImageItem(await request<ImageItem>(`${API_BASE}/api/images`, { method: 'POST', body }));
  },
  updateImage: async (payload: UpdateImagePayload) => {
    const body = await buildImageFormData(payload);
    return normalizeImageItem(await request<ImageItem>(`${API_BASE}/api/my/images/${payload.id}`, { method: 'PATCH', body }));
  },
  deleteImage: (id: string) => request<{ ok: boolean }>(`${API_BASE}/api/my/images/${id}`, { method: 'DELETE' }),
  toggleLike: (ownerLogin: string, postID: string) =>
    request<LikeToggleResult>(`${API_BASE}/api/images/${ownerLogin}/${postID}/like`, { method: 'POST' }),
  getComments: async (ownerLogin: string, postID: string) => {
    const items = await request<CommentItem[]>(`${API_BASE}/api/images/${ownerLogin}/${postID}/comments`);
    return items.map(normalizeCommentItem);
  },
  addComment: async (ownerLogin: string, postID: string, text: string, files?: File[]) => {
    if (files && files.length > 0) {
      const formData = new FormData();
      formData.set('text', text);
      for (const [index, file] of files.entries()) {
        const webpBlob = await fileToWebp(file);
        formData.append('files', webpBlob, `comment-${index + 1}.webp`);
      }
      const item = await request<CommentItem>(`${API_BASE}/api/images/${ownerLogin}/${postID}/comments`, {
        method: 'POST',
        body: formData,
      });
      return normalizeCommentItem(item);
    }
    const item = await request<CommentItem>(`${API_BASE}/api/images/${ownerLogin}/${postID}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
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