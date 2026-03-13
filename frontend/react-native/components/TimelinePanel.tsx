import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';
import type { TimelineMonth } from '@/types/image';

type TimelinePanelProps = {
  open: boolean;
  months: TimelineMonth[];
  activeMonth: TimelineMonth | null;
  order: 'asc' | 'desc';
  onToggleOrder: () => void;
  onSelect: (month: TimelineMonth) => void;
  onClose: () => void;
};

export function TimelinePanel({
  open,
  months,
  activeMonth,
  order,
  onToggleOrder,
  onSelect,
  onClose,
}: TimelinePanelProps) {
  const { theme } = useApp();
  const colors = Colors[theme];

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.panel,
            {
              backgroundColor: colors.pageBgSoft,
              borderLeftColor: colors.panelBorder,
              shadowColor: colors.timelineShadow,
            },
          ]}
          onPress={() => undefined}
        >
          <View style={styles.panelHeader}>
            <Pressable onPress={onToggleOrder} style={[styles.orderButton, { borderColor: colors.panelBorder }]}
            >
              <Feather
                name="arrow-up-down"
                size={16}
                color={colors.textMain}
                style={order === 'asc' ? { transform: [{ rotate: '180deg' }] } : undefined}
              />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.monthList} showsVerticalScrollIndicator={false}>
            {months.map((month, index) => {
              const prev = months[index - 1];
              const showYear = !prev || prev.year !== month.year;
              const isActive = activeMonth?.key === month.key;
              return (
                <View key={month.key} style={styles.monthBlock}>
                  {showYear ? (
                    <Text style={[styles.yearLabel, { color: isActive ? colors.textAccent : colors.textSoft }]}
                    >
                      {month.year}
                    </Text>
                  ) : null}
                  <Pressable onPress={() => onSelect(month)} style={styles.monthButton}>
                    <Text style={[styles.monthNumber, { color: isActive ? colors.textAccent : colors.textMain }]}>
                      {month.month}
                    </Text>
                    <Text style={[styles.monthSuffix, { color: colors.textSoft }]}>月</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'flex-end',
  },
  panel: {
    width: 90,
    height: '100%',
    borderLeftWidth: 1,
    paddingTop: 28,
    paddingHorizontal: 12,
    shadowOffset: { width: -10, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 26,
    elevation: 6,
  },
  panelHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  orderButton: {
    height: 34,
    width: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthList: {
    paddingBottom: 30,
  },
  monthBlock: {
    alignItems: 'center',
    marginBottom: 14,
  },
  yearLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '700',
    marginBottom: 4,
  },
  monthButton: {
    alignItems: 'center',
  },
  monthNumber: {
    fontSize: 32,
    fontWeight: '300',
  },
  monthSuffix: {
    fontSize: 12,
    marginTop: -2,
  },
});
