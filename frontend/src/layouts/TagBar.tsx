interface TagBarProps {
  tags: { tag: string; count: number }[];
  selectedTag: string | null;
  onSelect: (tag: string | null) => void;
  className?: string;
}

export function TagBar({ tags, selectedTag, onSelect, className }: TagBarProps) {
  if (tags.length === 0) return null;
  const wrapperClass = `w-full max-w-6xl ${className ?? ''}`.trim();

  return (
    <div className={wrapperClass}>
      <div className="flex flex-wrap gap-2">
        <button
          className={`tag-chip rounded-full border border-cyan-400/25 px-2.5 py-1 text-xs transition ${
            selectedTag === null ? 'tag-chip-active' : 'text-soft hover:text-[var(--text-main)]'
          }`}
          onClick={() => onSelect(null)}
          type="button"
        >
          All
        </button>
        {tags.map((entry) => {
          const isActive = selectedTag?.toLowerCase() === entry.tag.toLowerCase();
          return (
            <button
              className={`tag-chip rounded-full border border-cyan-400/25 px-2.5 py-1 text-xs transition ${
                isActive ? 'tag-chip-active' : 'text-soft hover:text-[var(--text-main)]'
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
