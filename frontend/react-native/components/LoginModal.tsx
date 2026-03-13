import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (provider: 'github' | 'google') => void;
  onEmailLogin?: (email: string) => Promise<void> | void;
  showGoogle?: boolean;
  showEmail?: boolean;
};

function GitHubIcon({ size = 34, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg height={size} width={size} viewBox="0 0 24 24">
      <Path
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.09-.744.084-.729.084-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12z"
        fill={color}
      />
    </Svg>
  );
}

function GoogleIcon({ size = 34 }: { size?: number }) {
  return (
    <Svg height={size} width={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.12 0 5.76 1.08 7.9 3.08l5.84-5.84C33.62 3.24 29.2 1 24 1 14.62 1 6.46 6.1 2.58 13.4l6.88 5.34C11.2 13.04 17.06 9.5 24 9.5z"
      />
      <Path
        fill="#34A853"
        d="M46.5 24c0-1.66-.14-2.86-.46-4.1H24v7.76h12.94c-.26 2.06-1.66 5.16-4.78 7.24l7.34 5.68C43.62 36.78 46.5 31.02 46.5 24z"
      />
      <Path
        fill="#4A90E2"
        d="M9.46 28.74A14.5 14.5 0 0 1 9 24c0-1.66.28-3.28.76-4.74l-6.88-5.34A23.93 23.93 0 0 0 1 24c0 3.86.92 7.5 2.58 10.68l6.88-5.34z"
      />
      <Path
        fill="#FBBC05"
        d="M24 47c5.2 0 9.62-1.72 12.84-4.66l-7.34-5.68c-1.96 1.38-4.58 2.32-7.5 2.32-6.94 0-12.8-3.54-14.54-9.24l-6.88 5.34C6.46 41.9 14.62 47 24 47z"
      />
    </Svg>
  );
}

function EmailIcon({ size = 40, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg height={size} width={size} viewBox="0 0 24 24">
      <Path
        d="M3.5 5.75h17a.75.75 0 0 1 .75.75v11a.75.75 0 0 1-.75.75h-17a.75.75 0 0 1-.75-.75v-11a.75.75 0 0 1 .75-.75zm16.25 2.2-7.46 4.62a.75.75 0 0 1-.78 0L4.25 7.95V17h15.5V7.95z"
        fill={color}
      />
    </Svg>
  );
}

export function LoginModal({
  open,
  onClose,
  onSelect,
  onEmailLogin,
  showGoogle = true,
  showEmail = true,
}: LoginModalProps) {
  const { theme } = useApp();
  const colors = Colors[theme];
  const [email, setEmail] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail('');
      setShowEmailForm(false);
      setSending(false);
    }
  }, [open]);

  const handleEmailSubmit = async () => {
    if (!onEmailLogin) return;
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('提示', '请输入邮箱');
      return;
    }
    try {
      setSending(true);
      await onEmailLogin(trimmed);
      Alert.alert('成功', '登录链接已发送，请检查邮箱');
      onClose();
    } catch (err: any) {
      Alert.alert('失败', err?.message ?? '发送失败');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: colors.panelBg,
              borderColor: colors.panelBorder,
              shadowColor: colors.panelShadow,
            },
          ]}
          onPress={() => undefined}
        >
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.textSoft }]}>×</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.textMain }]}>选择登录方式</Text>
          <View style={styles.iconRow}>
            <Pressable
              onPress={() => {
                onSelect('github');
                onClose();
              }}
              style={styles.iconButton}
            >
              <GitHubIcon color={colors.textMain} />
            </Pressable>
            {showGoogle ? (
              <Pressable
                onPress={() => {
                  onSelect('google');
                  onClose();
                }}
                style={styles.iconButton}
              >
                <GoogleIcon />
              </Pressable>
            ) : null}
            {showEmail ? (
              <Pressable onPress={() => setShowEmailForm(true)} style={styles.iconButton}>
                <EmailIcon color={colors.textMain} />
              </Pressable>
            ) : null}
          </View>

          {showEmail && showEmailForm ? (
            <View style={styles.emailBlock}>
              <TextInput
                placeholder="输入邮箱地址"
                placeholderTextColor={colors.textSoft}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.emailInput, { borderColor: colors.panelBorder, color: colors.textMain }]}
              />
              <Pressable
                onPress={handleEmailSubmit}
                disabled={sending}
                style={[
                  styles.emailButton,
                  { borderColor: colors.panelBorder, opacity: sending ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.emailButtonText, { color: colors.textMain }]}>
                  {sending ? '发送中...' : '发送登录链接'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 18,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    height: 30,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 20,
  },
  title: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 18,
  },
  iconButton: {
    height: 48,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailBlock: {
    marginTop: 16,
    gap: 10,
  },
  emailInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  emailButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  emailButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
