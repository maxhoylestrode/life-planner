export interface ThemeColors {
  colorBackground: string;
  colorPrimary: string;
  colorPrimaryDark: string;
  colorSecondary: string;
  colorSurface: string;
  colorSurfaceElev: string;
  colorTextPrimary: string;
  colorTextSecondary: string;
  colorTextMuted: string;
  colorBorder: string;
  colorSuccess: string;
  colorAccent: string;
}

export interface ThemePreset {
  name: string;
  label: string;
  emoji: string;
  description: string;
  colors: ThemeColors;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'terracotta',
    label: 'Terracotta',
    emoji: '🏺',
    description: 'Warm coral and cream — the original',
    colors: {
      colorBackground: '#FFF8F0',
      colorPrimary: '#E8825A',
      colorPrimaryDark: '#C4614A',
      colorSecondary: '#F5A623',
      colorSurface: '#FFFFFF',
      colorSurfaceElev: '#FFF3E8',
      colorTextPrimary: '#3D2B1F',
      colorTextSecondary: '#8B6355',
      colorTextMuted: '#B89080',
      colorBorder: '#E8D5C4',
      colorSuccess: '#6BAF7A',
      colorAccent: '#9B7FA6',
    },
  },
  {
    name: 'midnight',
    label: 'Midnight',
    emoji: '🌙',
    description: 'Deep dark blues for night owls',
    colors: {
      colorBackground: '#0F1117',
      colorPrimary: '#6C8EF5',
      colorPrimaryDark: '#4F6FE0',
      colorSecondary: '#A78BFA',
      colorSurface: '#1A1D27',
      colorSurfaceElev: '#222536',
      colorTextPrimary: '#E8EAF6',
      colorTextSecondary: '#9499B8',
      colorTextMuted: '#5C6080',
      colorBorder: '#2E3250',
      colorSuccess: '#4ADE80',
      colorAccent: '#F472B6',
    },
  },
  {
    name: 'forest',
    label: 'Forest',
    emoji: '🌲',
    description: 'Earthy greens and warm browns',
    colors: {
      colorBackground: '#F2F7F2',
      colorPrimary: '#4A7C59',
      colorPrimaryDark: '#355A41',
      colorSecondary: '#8B6914',
      colorSurface: '#FFFFFF',
      colorSurfaceElev: '#EAF2EA',
      colorTextPrimary: '#1A2E1A',
      colorTextSecondary: '#4A6350',
      colorTextMuted: '#7A9080',
      colorBorder: '#C8DCC8',
      colorSuccess: '#5BA05B',
      colorAccent: '#8B5CF6',
    },
  },
  {
    name: 'ocean',
    label: 'Ocean',
    emoji: '🌊',
    description: 'Cool blues and seafoam greens',
    colors: {
      colorBackground: '#F0F7FF',
      colorPrimary: '#0EA5E9',
      colorPrimaryDark: '#0284C7',
      colorSecondary: '#06B6D4',
      colorSurface: '#FFFFFF',
      colorSurfaceElev: '#E0F2FE',
      colorTextPrimary: '#0C2340',
      colorTextSecondary: '#3B6E8C',
      colorTextMuted: '#7AAEC4',
      colorBorder: '#BAE0F5',
      colorSuccess: '#10B981',
      colorAccent: '#8B5CF6',
    },
  },
  {
    name: 'rose',
    label: 'Rose',
    emoji: '🌸',
    description: 'Soft pinks and warm whites',
    colors: {
      colorBackground: '#FFF5F7',
      colorPrimary: '#E8457A',
      colorPrimaryDark: '#C73060',
      colorSecondary: '#F59E0B',
      colorSurface: '#FFFFFF',
      colorSurfaceElev: '#FFE8EE',
      colorTextPrimary: '#3D0F1F',
      colorTextSecondary: '#8B4060',
      colorTextMuted: '#B87090',
      colorBorder: '#F0C0D0',
      colorSuccess: '#6BAF7A',
      colorAccent: '#7C3AED',
    },
  },
  {
    name: 'slate',
    label: 'Slate',
    emoji: '🪨',
    description: 'Clean and minimal — neutral grey tones',
    colors: {
      colorBackground: '#F8FAFC',
      colorPrimary: '#475569',
      colorPrimaryDark: '#334155',
      colorSecondary: '#64748B',
      colorSurface: '#FFFFFF',
      colorSurfaceElev: '#F1F5F9',
      colorTextPrimary: '#0F172A',
      colorTextSecondary: '#475569',
      colorTextMuted: '#94A3B8',
      colorBorder: '#CBD5E1',
      colorSuccess: '#22C55E',
      colorAccent: '#8B5CF6',
    },
  },
  {
    name: 'custom',
    label: 'Custom',
    emoji: '🎨',
    description: 'Your own colour palette',
    colors: {
      colorBackground: '#FFF8F0',
      colorPrimary: '#E8825A',
      colorPrimaryDark: '#C4614A',
      colorSecondary: '#F5A623',
      colorSurface: '#FFFFFF',
      colorSurfaceElev: '#FFF3E8',
      colorTextPrimary: '#3D2B1F',
      colorTextSecondary: '#8B6355',
      colorTextMuted: '#B89080',
      colorBorder: '#E8D5C4',
      colorSuccess: '#6BAF7A',
      colorAccent: '#9B7FA6',
    },
  },
];

export const DEFAULT_COLORS: ThemeColors = THEME_PRESETS[0].colors;
