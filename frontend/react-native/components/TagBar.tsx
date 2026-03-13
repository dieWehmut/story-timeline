import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TagChip } from './TagChip';

type TagBarProps = {
  tags: { tag: string; count: number }[];
  selectedTag: string | null;
  onSelect: (tag: string | null) => void;
};

export function TagBar({ tags, selectedTag, onSelect }: TagBarProps) {
  if (!tags.length) return null;

  return (
    <View style={styles.wrap}>
      <TagChip label="All" active={selectedTag === null} onPress={() => onSelect(null)} />
      {tags.map((entry) => {
        const isActive = selectedTag?.toLowerCase() === entry.tag.toLowerCase();
        return (
          <TagChip
            key={entry.tag}
            label={`#${entry.tag} (${entry.count})`}
            active={isActive}
            onPress={() => onSelect(isActive ? null : entry.tag)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
});
