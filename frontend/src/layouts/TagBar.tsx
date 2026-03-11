interface TagBarProps {
  tags: { tag: string; count: number }[];
  selectedTag: string | null;
  onSelect: (tag: string | null) => void;
}

export function TagBar({ tags, selectedTag, onSelect }: TagBarProps) {
  if (tags.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-6xl px-2 pt-2">
      <div className="flex flex-wrap gap-2">
        <button
          className={`tag-chip rounded-full border border-cyan-400/25 px-2.5 py-1 text-xs transition ${
            selectedTag === null ? 'bg-cyan-500/20 text-cyan-200' : 'text-soft hover:text-[var(--text-main)]'
          }`}
          onClick={() => onSelect(null)}
          type="button"
        >
          全部
        </button>
        {tags.map((entry) => {
          const isActive = selectedTag?.toLowerCase() === entry.tag.toLowerCase();
          return (
            <button
              className={`tag-chip rounded-full border border-cyan-400/25 px-2.5 py-1 text-xs transition ${
                isActive ? 'bg-cyan-500/20 text-cyan-200' : 'text-soft hover:text-[var(--text-main)]'
              }`}
              key={entry.tag}
              onClick={() => onSelect(isActive ? null : entry.tag)}
              type="button"
            >
              #{entry.tag} ({entry.count})
            </button>
          );
        })}
      </div>
    </div>
  );
}
