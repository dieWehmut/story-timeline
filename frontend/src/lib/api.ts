import type {
  AuthSession,
  CreateImagePayload,
  HealthStats,
  ImageItem,
  UpdateImagePayload,
} from '../types/image';

const request = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
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
  formData.set('capturedAt', payload.capturedAt);

  if ('id' in payload) {
    formData.set('id', payload.id);
  }

  if (payload.file) {
    const webpBlob = await fileToWebp(payload.file);
    const fileName = payload.file.name.replace(/\.[^.]+$/, '') || 'image';
    formData.set('file', webpBlob, `${fileName}.webp`);
  }

  return formData;
};

export const api = {
  getSession: () => request<AuthSession>('/api/auth/session'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  getImages: () => request<ImageItem[]>('/api/images'),
  createImage: async (payload: CreateImagePayload) => {
    const body = await buildImageFormData(payload);
    return request<ImageItem>('/api/images', { method: 'POST', body });
  },
  updateImage: async (payload: UpdateImagePayload) => {
    const body = await buildImageFormData(payload);
    return request<ImageItem>(`/api/images/${payload.id}`, { method: 'PATCH', body });
  },
  deleteImage: (id: string) => request<{ ok: boolean }>(`/api/images/${id}`, { method: 'DELETE' }),
  getStats: () => request<HealthStats>('/api/health/stats'),
  pingStats: () => request<{ ok: boolean }>('/api/health/ping', { method: 'POST' }),
};