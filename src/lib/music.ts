import { supabase } from './supabase';
import type { Music } from './supabase';

export const getMusicList = async (): Promise<Music[]> => {
  const { data, error } = await supabase
    .from('music')
    .select('*')
    .order('order', { ascending: true });

  if (error) {
    console.error('获取音乐列表失败:', error);
    return [];
  }

  return data || [];
};

export const uploadMusic = async (
  file: File
): Promise<boolean> => {
  try {
    // 从文件名中提取歌曲名称（去掉扩展名）
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    
    // 生成安全的 storage key：使用 timestamp + base64url 编码的原始文件名（不含扩展名）
    const ext = (file.name.match(/\.([^.]+)$/) || [])[1] || '';
    const nameOnly = file.name.replace(/\.[^/.]+$/, '');
    const toBase64Url = (str: string) => {
      try {
        // browser-friendly
        return btoa(unescape(encodeURIComponent(str)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      } catch {
        // fallback using encodeURIComponent and manual base64 (safe for SSR)
        const encoded = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p) => String.fromCharCode(parseInt(p, 16)));
        return btoa(encoded)
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      }
    };

    const base64 = toBase64Url(nameOnly);

    const fileName = `${Date.now()}_${base64}${ext ? `.${ext}` : ''}`;

    // 上传音乐文件到 Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('music')
      .upload(fileName, file);

    if (uploadError) {
      console.error('上传音乐文件失败:', uploadError);
      return false;
    }

    // 获取文件 URL
    const { data: urlData } = supabase.storage
      .from('music')
      .getPublicUrl(fileName);

    // 获取当前最大 order
    const { data: maxOrderData } = await supabase
      .from('music')
      .select('order')
      .order('order', { ascending: false })
      .limit(1);

    const newOrder = maxOrderData && maxOrderData.length > 0 
      ? maxOrderData[0].order + 1 
      : 1;

    // 插入音乐记录，使用文件名作为标题和艺术家
    const { error: insertError } = await supabase
      .from('music')
      .insert({
        title: nameWithoutExt,
        artist: '未知艺术家',
        url: urlData.publicUrl,
        order: newOrder
      });

    if (insertError) {
      console.error('插入音乐记录失败:', insertError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('上传音乐失败:', error);
    return false;
  }
};

export const deleteMusic = async (id: number, url: string): Promise<boolean> => {
  try {
    // 从 URL 提取文件名并解码（如果是 encodeURIComponent 编码）
    let fileName = url.split('/').pop() || '';
    try {
      fileName = decodeURIComponent(fileName);
    } catch {
      // ignore
    }

    if (fileName) {
      // 删除存储中的文件
      await supabase.storage.from('music').remove([fileName]);
    }

    // 删除数据库记录
    const { error } = await supabase
      .from('music')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除音乐记录失败:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('删除音乐失败:', error);
    return false;
  }
};

export const updateMusicOrder = async (
  musicList: { id: number; order: number }[]
): Promise<boolean> => {
  try {
    for (const music of musicList) {
      const { error } = await supabase
        .from('music')
        .update({ order: music.order })
        .eq('id', music.id);

      if (error) {
        console.error('更新音乐顺序失败:', error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('更新音乐顺序失败:', error);
    return false;
  }
};
