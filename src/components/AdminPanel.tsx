import React, { useState, useEffect } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';
import { useMusic } from '../context/MusicContext';
import { uploadImage } from '../lib/siteConfig';
import { uploadMusic, deleteMusic, updateMusicOrder } from '../lib/music';
import { getLinks, addLink, updateLink, deleteLink, updateLinkOrder, type Link } from '../lib/links';
import { logout } from '../lib/auth';
import '../styles/AdminPanel.css';

interface AdminPanelProps {
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { config, updateSiteConfig } = useSiteConfig();
  const { musicList, refreshMusicList } = useMusic();

  const [siteName, setSiteName] = useState(config?.site_name || '');
  const [uploading, setUploading] = useState(false);

  const [musicFile, setMusicFile] = useState<File | null>(null);

  // 链接管理状态
  const [links, setLinks] = useState<Link[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [editingLink, setEditingLink] = useState<Link | null>(null);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    const data = await getLinks();
    setLinks(data);
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const url = await uploadImage(file, 'images');
    if (url) {
      await updateSiteConfig(undefined, url, undefined);
      // 更新 favicon
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (link) {
        link.href = url;
      }
    }
    setUploading(false);
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const url = await uploadImage(file, 'images');
    if (url) {
      await updateSiteConfig(undefined, undefined, url);
    }
    setUploading(false);
  };

  const handleSiteNameUpdate = async () => {
    await updateSiteConfig(siteName, undefined, undefined);
    document.title = siteName;
  };

  const handleMusicUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!musicFile) return;

    setUploading(true);
    const success = await uploadMusic(musicFile);
    if (success) {
      await refreshMusicList();
      setMusicFile(null);
      const fileInput = document.getElementById('music-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
    setUploading(false);
  };

  const handleDeleteMusic = async (id: number, url: string) => {
    if (!confirm('确定要删除这首音乐吗?')) return;

    const success = await deleteMusic(id, url);
    if (success) {
      await refreshMusicList();
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;

    const newList = [...musicList];
    [newList[index], newList[index - 1]] = [newList[index - 1], newList[index]];

    const updates = newList.map((music, idx) => ({
      id: music.id,
      order: idx + 1
    }));

    await updateMusicOrder(updates);
    await refreshMusicList();
  };

  const handleMoveDown = async (index: number) => {
    if (index === musicList.length - 1) return;

    const newList = [...musicList];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];

    const updates = newList.map((music, idx) => ({
      id: music.id,
      order: idx + 1
    }));

    await updateMusicOrder(updates);
    await refreshMusicList();
  };

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  // 链接管理函数
  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle || !newLinkUrl) return;

    const success = await addLink(newLinkTitle, newLinkUrl);
    if (success) {
      await loadLinks();
      setNewLinkTitle('');
      setNewLinkUrl('');
    }
  };

  const handleUpdateLink = async () => {
    if (!editingLink) return;

    const success = await updateLink(editingLink.id, editingLink.title, editingLink.url);
    if (success) {
      await loadLinks();
      setEditingLink(null);
    }
  };

  const handleDeleteLink = async (id: number) => {
    if (!confirm('确定要删除这个链接吗?')) return;

    const success = await deleteLink(id);
    if (success) {
      await loadLinks();
    }
  };

  const handleLinkMoveUp = async (index: number) => {
    if (index === 0) return;

    const newList = [...links];
    [newList[index], newList[index - 1]] = [newList[index - 1], newList[index]];

    const updates = newList.map((link, idx) => ({
      id: link.id,
      order: idx + 1
    }));

    await updateLinkOrder(updates);
    await loadLinks();
  };

  const handleLinkMoveDown = async (index: number) => {
    if (index === links.length - 1) return;

    const newList = [...links];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];

    const updates = newList.map((link, idx) => ({
      id: link.id,
      order: idx + 1
    }));

    await updateLinkOrder(updates);
    await loadLinks();
  };

  return (
    <div className="admin-panel-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2>管理员面板</h2>

        <div className="admin-section">
          <h3>网站设置</h3>
          
          <div className="form-group">
            <label>网站名称</label>
            <div className="input-with-button">
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="网站名称"
              />
              <button onClick={handleSiteNameUpdate}>更新</button>
            </div>
          </div>

          <div className="form-group">
            <label>网站图标</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFaviconUpload}
              disabled={uploading}
            />
          </div>

          <div className="form-group">
            <label>背景图片</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleBackgroundUpload}
              disabled={uploading}
            />
          </div>
        </div>

        <div className="admin-section">
          <h3>音乐管理</h3>
          
          <form onSubmit={handleMusicUpload} className="music-upload-form">
            <div className="form-group">
              <label>选择音乐文件（将使用文件名作为歌曲名）</label>
              <input
                id="music-file"
                type="file"
                accept="audio/*"
                onChange={(e) => setMusicFile(e.target.files?.[0] || null)}
                required
              />
            </div>

            {musicFile && (
              <div className="file-preview">
                已选择: {musicFile.name}
              </div>
            )}

            <button type="submit" disabled={uploading || !musicFile}>
              {uploading ? '上传中...' : '上传音乐'}
            </button>
          </form>

          <div className="music-list">
            {musicList.map((music, index) => (
              <div key={music.id} className="music-item">
                <div className="music-info">
                  <div className="music-title">{music.title}</div>
                  <div className="music-artist">{music.artist}</div>
                </div>
                <div className="music-actions">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    title="上移"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === musicList.length - 1}
                    title="下移"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleDeleteMusic(music.id, music.url)}
                    className="delete-button"
                    title="删除"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-section">
          <h3>链接管理</h3>
          
          <form onSubmit={handleAddLink} className="link-add-form">
            <div className="form-group">
              <label>链接标题</label>
              <input
                type="text"
                value={newLinkTitle}
                onChange={(e) => setNewLinkTitle(e.target.value)}
                placeholder="例如: GitHub"
                required
              />
            </div>

            <div className="form-group">
              <label>链接地址</label>
              <input
                type="url"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder="https://..."
                required
              />
            </div>

            <button type="submit">添加链接</button>
          </form>

          <div className="link-list">
            {links.map((link, index) => (
              <div key={link.id} className="link-item">
                {editingLink?.id === link.id ? (
                  <div className="link-edit-form">
                    <input
                      type="text"
                      value={editingLink.title}
                      onChange={(e) => setEditingLink({ ...editingLink, title: e.target.value })}
                      placeholder="标题"
                    />
                    <input
                      type="url"
                      value={editingLink.url}
                      onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })}
                      placeholder="链接"
                    />
                    <div className="link-actions">
                      <button onClick={handleUpdateLink}>保存</button>
                      <button onClick={() => setEditingLink(null)}>取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="link-info">
                      <div className="link-title">{link.title}</div>
                      <div className="link-url">{link.url}</div>
                    </div>
                    <div className="link-actions">
                      <button
                        onClick={() => handleLinkMoveUp(index)}
                        disabled={index === 0}
                        title="上移"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleLinkMoveDown(index)}
                        disabled={index === links.length - 1}
                        title="下移"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => setEditingLink(link)}
                        className="edit-button"
                        title="编辑"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        className="delete-button"
                        title="删除"
                      >
                        🗑
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {links.length === 0 && (
              <div className="empty-list">暂无链接</div>
            )}
          </div>
        </div>

        <button className="logout-button" onClick={handleLogout}>
          退出登录
        </button>
      </div>
    </div>
  );
};

export default AdminPanel;
