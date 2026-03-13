import type { MediaType, UploadFile } from '@/types/image';

export interface MediaItem {
  url: string;
  type: MediaType;
}

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv'];

export const isVideoUrl = (url: string) => {
  const clean = url.split('?')[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => clean.endsWith(ext));
};

export const mediaTypeFromFile = (file: UploadFile): MediaType => {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('image/')) return 'image';
  const name = file.name.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext)) ? 'video' : 'image';
};

export const normalizeAssetTypes = (urls: string[], assetTypes?: Array<MediaType | string | null | undefined>) =>
  urls.map((url, index) => {
    const declared = assetTypes?.[index];
    if (declared === 'video' || declared === 'image') {
      return declared;
    }
    return isVideoUrl(url) ? 'video' : 'image';
  });

export const buildMediaItems = (urls: string[], assetTypes?: Array<MediaType | string | null | undefined>): MediaItem[] => {
  const types = normalizeAssetTypes(urls, assetTypes);
  return urls.map((url, index) => ({
    url,
    type: types[index],
  }));
};
