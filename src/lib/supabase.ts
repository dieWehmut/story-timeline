import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 数据库类型定义
export interface Music {
  id: number;
  title: string;
  artist: string;
  url: string;
  order: number;
  created_at: string;
}

export interface SiteConfig {
  id: number;
  site_name: string;
  favicon_url: string;
  background_url: string;
  visitor_count: number;
  created_at: string;
}

export interface AdminUser {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}
