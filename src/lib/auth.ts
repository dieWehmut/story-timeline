import { supabase } from './supabase';

// 简单的密码哈希（生产环境应使用更安全的方法）
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const login = async (email: string, password: string): Promise<boolean> => {
  try {
    const passwordHash = await hashPassword(password);
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .eq('password_hash', passwordHash)
      .single();

    if (error || !data) {
      return false;
    }
    
    // 存储登录状态
    localStorage.setItem('isAdmin', 'true');
    return true;
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
};

export const logout = () => {
  localStorage.removeItem('isAdmin');
};

export const isAdmin = (): boolean => {
  return localStorage.getItem('isAdmin') === 'true';
};
