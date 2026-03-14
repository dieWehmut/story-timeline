import { useState } from 'react';
import { X } from 'lucide-react';

interface NotificationModalProps {
  open: boolean;
  title: string;
  content: string;
  enabled: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onDismissToday: () => void;
  onSave?: (data: { enabled: boolean; title: string; content: string }) => Promise<void>;
}

const btnCls =
  'rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-xs transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]';

export function NotificationModal({
  open,
  title,
  content,
  enabled,
  isAdmin,
  onClose,
  onDismissToday,
  onSave,
}: NotificationModalProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editContent, setEditContent] = useState(content);
  const [editEnabled, setEditEnabled] = useState(enabled);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleEdit = () => {
    setEditTitle(title);
    setEditContent(content);
    setEditEnabled(enabled);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ enabled: editEnabled, title: editTitle, content: editContent });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop-enter fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="modal-panel-enter w-full max-w-md rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-5 py-4 text-[var(--text-main)] shadow-xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{editing ? '编辑通知' : title}</p>
          <button
            aria-label="关闭"
            className="inline-flex h-7 w-7 items-center justify-center text-soft transition hover:text-[var(--text-main)]"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        {editing ? (
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-[10px] text-soft">标题</label>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--panel-border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none transition focus:border-[var(--text-accent)]"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                type="text"
              />
            </div>
            <div>
              <label className="text-[10px] text-soft">内容</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-[var(--panel-border)] bg-transparent px-2.5 py-2 text-xs leading-relaxed text-[var(--text-main)] outline-none transition focus:border-[var(--text-accent)]"
                rows={5}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={editEnabled}
                onChange={(e) => setEditEnabled(e.target.checked)}
                className="accent-[var(--text-accent)]"
              />
              打开应用时自动弹出
            </label>
            <div className="flex justify-end gap-2">
              <button className={btnCls} onClick={() => setEditing(false)} type="button">
                取消
              </button>
              <button className={btnCls} disabled={saving} onClick={handleSave} type="button">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-soft">
              {content || '暂无通知'}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              {isAdmin ? (
                <button className={btnCls} onClick={handleEdit} type="button">
                  编辑
                </button>
              ) : null}
              <button className={btnCls} onClick={onDismissToday} type="button">
                今日不再显示
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
