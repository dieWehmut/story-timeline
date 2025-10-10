import { supabase } from './supabase';

export interface Link {
  id: number;
  title: string;
  url: string;
  order: number;
  created_at: string;
}

export const getLinks = async (): Promise<Link[]> => {
  const { data, error } = await supabase
    .from('links')
    .select('*')
    .order('order', { ascending: true });

  if (error) {
    console.error('获取链接列表失败:', error);
    return [];
  }

  return data || [];
};

export const addLink = async (
  title: string,
  url: string
): Promise<boolean> => {
  try {
    // 获取当前最大 order
    const { data: maxOrderData } = await supabase
      .from('links')
      .select('order')
      .order('order', { ascending: false })
      .limit(1);

    const newOrder = maxOrderData && maxOrderData.length > 0 
      ? maxOrderData[0].order + 1 
      : 1;

    const { error } = await supabase
      .from('links')
      .insert({
        title,
        url,
        order: newOrder
      });

    if (error) {
      console.error('添加链接失败:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('添加链接失败:', error);
    return false;
  }
};

export const updateLink = async (
  id: number,
  title: string,
  url: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('links')
      .update({ title, url })
      .eq('id', id);

    if (error) {
      console.error('更新链接失败:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('更新链接失败:', error);
    return false;
  }
};

export const deleteLink = async (id: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('links')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除链接失败:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('删除链接失败:', error);
    return false;
  }
};

export const updateLinkOrder = async (
  linkList: { id: number; order: number }[]
): Promise<boolean> => {
  try {
    for (const link of linkList) {
      const { error } = await supabase
        .from('links')
        .update({ order: link.order })
        .eq('id', link.id);

      if (error) {
        console.error('更新链接顺序失败:', error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('更新链接顺序失败:', error);
    return false;
  }
};
