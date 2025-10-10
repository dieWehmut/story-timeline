import { supabase } from './supabase';
import type { SiteConfig } from './supabase';

export const getSiteConfig = async (): Promise<SiteConfig | null> => {
  const { data, error } = await supabase
    .from('site_config')
    .select('*')
    .single();

  if (error) {
    console.error('获取网站配置失败:', error);
    return null;
  }

  return data;
};

export const updateSiteConfig = async (
  siteName?: string,
  faviconUrl?: string,
  backgroundUrl?: string
): Promise<boolean> => {
  try {
    const updates: Partial<SiteConfig> = {};
    
    if (siteName !== undefined) updates.site_name = siteName;
    if (faviconUrl !== undefined) updates.favicon_url = faviconUrl;
    if (backgroundUrl !== undefined) updates.background_url = backgroundUrl;

    const { error } = await supabase
      .from('site_config')
      .update(updates)
      .eq('id', 1);

    if (error) {
      console.error('更新网站配置失败:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('更新网站配置失败:', error);
    return false;
  }
};

export const incrementVisitorCount = async (): Promise<boolean> => {
  try {
    const { data: currentData } = await supabase
      .from('site_config')
      .select('visitor_count')
      .eq('id', 1)
      .single();

    if (!currentData) return false;

    const { error } = await supabase
      .from('site_config')
      .update({ visitor_count: currentData.visitor_count + 1 })
      .eq('id', 1);

    if (error) {
      console.error('增加访客数失败:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('增加访客数失败:', error);
    return false;
  }
};

export const uploadImage = async (file: File, bucket: string = 'images'): Promise<string | null> => {
  try {
    const fileName = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (uploadError) {
      console.error('上传图片失败:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error('上传图片失败:', error);
    return null;
  }
};
