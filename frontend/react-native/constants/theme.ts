export type ThemeName = 'light' | 'dark';

export const Fonts = {
  primary: 'LXGW WenKai',
};

export const Colors = {
  dark: {
    pageBg: '#0d1117',
    pageBgSoft: '#151b24',
    panelBg: 'rgba(12, 18, 26, 0.78)',
    panelBorder: 'rgba(148, 163, 184, 0.16)',
    panelShadow: 'rgba(1, 4, 9, 0.35)',
    timelineShadow: 'rgba(0, 0, 0, 0.45)',
    textMain: '#edf2f7',
    textSoft: '#9fb0c3',
    textAccent: '#7dd3fc',
    buttonBg: 'rgba(20, 28, 39, 0.94)',
    buttonHover: 'rgba(30, 41, 59, 0.98)',
    chipBorder: 'rgba(34, 211, 238, 0.25)',
    chipBg: 'transparent',
    chipText: '#9fb0c3',
    chipActiveBg: 'rgba(6, 182, 212, 0.2)',
    chipActiveText: '#67e8f9',
    danger: '#f87171',
  },
  light: {
    pageBg: '#f4efe7',
    pageBgSoft: '#f9f6f0',
    panelBg: 'rgba(255, 252, 246, 0.84)',
    panelBorder: 'rgba(148, 163, 184, 0.28)',
    panelShadow: 'rgba(128, 102, 78, 0.14)',
    timelineShadow: 'rgba(15, 23, 42, 0.12)',
    textMain: '#1f2937',
    textSoft: '#6b7280',
    textAccent: '#0f766e',
    buttonBg: 'rgba(255, 251, 244, 0.95)',
    buttonHover: 'rgba(255, 247, 237, 1)',
    chipBorder: '#111827',
    chipBg: 'rgba(17, 24, 39, 0.06)',
    chipText: '#111827',
    chipActiveBg: '#111827',
    chipActiveText: '#f9fafb',
    danger: '#ef4444',
  },
};

export const Typography = {
  title: {
    fontSize: 28,
    fontWeight: '600' as const,
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
};
