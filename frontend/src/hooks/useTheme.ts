import { createContext, useContext, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { useAuth } from './useAuth';

export interface UserPreferences {
  id: string;
  userId: string;
  themeName: string;
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
  fontFamily: string;
  fontSize: string;
  density: string;
  defaultCalendarView: string;
  coffeeWorkMins: number;
  coffeeBreakMins: number;
  createdAt: string;
  updatedAt: string;
}

export type PreferencesPatch = Partial<
  Omit<UserPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
>;

interface ThemeContextValue {
  preferences: UserPreferences | null;
  updatePreferences: (patch: PreferencesPatch) => Promise<void>;
  isLoading: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const FONT_MAP: Record<string, string> = {
  inter: "'Inter', system-ui, -apple-system, sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace",
};

const SIZE_MAP: Record<string, string> = {
  sm: '14px',
  md: '16px',
  lg: '18px',
};

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

export function applyPreferences(prefs: UserPreferences): void {
  const root = document.documentElement;

  // Colour tokens — hex for non-Tailwind CSS, RGB channels for Tailwind opacity modifiers
  root.style.setProperty('--color-background', prefs.colorBackground);
  root.style.setProperty('--color-primary', prefs.colorPrimary);
  root.style.setProperty('--color-primary-rgb', hexToRgb(prefs.colorPrimary));
  root.style.setProperty('--color-primary-dark', prefs.colorPrimaryDark);
  root.style.setProperty('--color-secondary', prefs.colorSecondary);
  root.style.setProperty('--color-secondary-rgb', hexToRgb(prefs.colorSecondary));
  root.style.setProperty('--color-surface', prefs.colorSurface);
  root.style.setProperty('--color-surface-elevated', prefs.colorSurfaceElev);
  root.style.setProperty('--color-text-primary', prefs.colorTextPrimary);
  root.style.setProperty('--color-text-secondary', prefs.colorTextSecondary);
  root.style.setProperty('--color-text-muted', prefs.colorTextMuted);
  root.style.setProperty('--color-border', prefs.colorBorder);
  root.style.setProperty('--color-border-rgb', hexToRgb(prefs.colorBorder));
  root.style.setProperty('--color-success', prefs.colorSuccess);
  root.style.setProperty('--color-accent', prefs.colorAccent);
  root.style.setProperty('--color-accent-rgb', hexToRgb(prefs.colorAccent));

  // Font
  root.style.setProperty('--font-family', FONT_MAP[prefs.fontFamily] ?? FONT_MAP.inter);
  root.style.setProperty('--font-size-base', SIZE_MAP[prefs.fontSize] ?? SIZE_MAP.md);

  // Density
  root.setAttribute('data-density', prefs.density ?? 'comfortable');
}

export function useThemeProvider(): ThemeContextValue {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: async () => {
      const res = await apiClient.get<{ preferences: UserPreferences }>('/preferences');
      return res.data.preferences;
    },
    enabled: isAuthenticated,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data) applyPreferences(data);
  }, [data]);

  const { mutateAsync } = useMutation({
    mutationFn: async (patch: PreferencesPatch) => {
      const res = await apiClient.put<{ preferences: UserPreferences }>('/preferences', patch);
      return res.data.preferences;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['preferences'], updated);
      applyPreferences(updated);
    },
  });

  const updatePreferences = useCallback(
    async (patch: PreferencesPatch) => {
      await mutateAsync(patch);
    },
    [mutateAsync]
  );

  return {
    preferences: data ?? null,
    updatePreferences,
    isLoading,
  };
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
