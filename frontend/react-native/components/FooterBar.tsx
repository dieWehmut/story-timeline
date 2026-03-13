import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';

const UPTIME_START_AT = Date.parse('2025-10-10T09:00:00.000Z');

const formatUptime = (uptimeSeconds: number) => {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

export function FooterBar() {
  const { images, theme } = useApp();
  const colors = Colors[theme];
  const [uptimeSeconds, setUptimeSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - UPTIME_START_AT) / 1000))
  );
  const iconColor = theme === 'light' ? '#111827' : colors.textAccent;

  useEffect(() => {
    const sync = () => {
      setUptimeSeconds(Math.max(0, Math.floor((Date.now() - UPTIME_START_AT) / 1000)));
    };
    sync();
    const timer = setInterval(sync, 1000);
    return () => clearInterval(timer);
  }, []);

  const githubOwner = images.stats.githubOwner || 'GitHub';

  return (
    <View style={[styles.root, { backgroundColor: colors.panelBg, borderTopColor: colors.panelBorder }]}>
      <View style={styles.row}>
        <View style={styles.metric}>
          <Feather name="user" size={12} color={iconColor} />
          <Text style={[styles.metricText, { color: colors.textMain }]}>{images.stats.userCount}</Text>
        </View>
        <View style={styles.metric}>
          <Feather name="eye" size={12} color={iconColor} />
          <Text style={[styles.metricText, { color: colors.textMain }]}>{images.stats.onlineUsers}</Text>
        </View>
        <View style={styles.metric}>
          <Feather name="clock" size={12} color={iconColor} />
          <Text style={[styles.metricText, { color: colors.textMain }]}>{formatUptime(uptimeSeconds)}</Text>
        </View>
      </View>
      <View style={styles.copyRow}>
        <Feather name="copyright" size={12} color={iconColor} />
        <Text style={[styles.copyText, { color: colors.textMain }]}>2025-2026 </Text>
        <Text
          style={[styles.copyLink, { color: colors.textMain }]}
          onPress={() => Linking.openURL(`https://github.com/${githubOwner}`)}
        >
          {githubOwner}.
        </Text>
        <Text style={[styles.copyText, { color: colors.textMain }]}> All Rights Reserved.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricText: {
    fontSize: 11,
  },
  copyRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  copyText: {
    fontSize: 11,
  },
  copyLink: {
    fontSize: 11,
    textDecorationLine: 'underline',
  },
});
