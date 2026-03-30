import { useState, useEffect, type ElementType } from 'react';
import {
  Palette,
  Type,
  LayoutGrid,
  Calendar,
  Coffee,
  User,
  AlertTriangle,
  Check,
  LayoutDashboard,
} from 'lucide-react';
import { useTheme, type PreferencesPatch } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { THEME_PRESETS, type ThemeColors } from '../lib/themes';

const COLOR_FIELD_LABELS: Record<keyof ThemeColors, string> = {
  colorBackground: 'Background',
  colorPrimary: 'Primary',
  colorPrimaryDark: 'Primary Dark',
  colorSecondary: 'Secondary',
  colorSurface: 'Surface',
  colorSurfaceElev: 'Surface Elevated',
  colorTextPrimary: 'Text Primary',
  colorTextSecondary: 'Text Secondary',
  colorTextMuted: 'Text Muted',
  colorBorder: 'Border',
  colorSuccess: 'Success',
  colorAccent: 'Accent',
};

const FONT_OPTIONS = [
  { value: 'inter', label: 'Inter (Default)' },
  { value: 'georgia', label: 'Georgia (Serif)' },
  { value: 'mono', label: 'Monospace' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
];

const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compact', desc: 'Tighter spacing' },
  { value: 'comfortable', label: 'Comfortable', desc: 'Balanced spacing' },
  { value: 'spacious', label: 'Spacious', desc: 'Relaxed spacing' },
];

const CALENDAR_VIEW_OPTIONS = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
];

function SectionCard({ children }: { children: React.ReactNode }) {
  return <section className="card p-5">{children}</section>;
}

function SectionTitle({ icon: Icon, title }: { icon: ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-primary" />
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
    </div>
  );
}

export default function Settings() {
  const { preferences, updatePreferences, isLoading } = useTheme();
  const { user } = useAuth();
  const [workMins, setWorkMins] = useState('');
  const [breakMins, setBreakMins] = useState('');
  const [weatherCity, setWeatherCity] = useState('');
  const [kumaUrl, setKumaUrl] = useState('');
  const [kumaSlug, setKumaSlug] = useState('');

  useEffect(() => {
    if (preferences) {
      setWorkMins(String(preferences.coffeeWorkMins));
      setBreakMins(String(preferences.coffeeBreakMins));
      setWeatherCity(preferences.weatherCity ?? 'London');
      setKumaUrl(preferences.uptimeKumaUrl ?? '');
      setKumaSlug(preferences.uptimeKumaSlug ?? '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences?.coffeeWorkMins, preferences?.coffeeBreakMins, preferences?.weatherCity, preferences?.uptimeKumaUrl, preferences?.uptimeKumaSlug]);

  if (isLoading || !preferences) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Loading settings…
      </div>
    );
  }

  const save = (patch: PreferencesPatch) => updatePreferences(patch).catch(console.error);

  const handleThemeSelect = (themeName: string) => {
    if (themeName === 'custom') {
      save({ themeName: 'custom' });
    } else {
      const preset = THEME_PRESETS.find(p => p.name === themeName);
      if (preset) save({ themeName, ...preset.colors });
    }
  };

  const handleWorkBlur = () => {
    const v = parseInt(workMins, 10);
    if (!isNaN(v) && v >= 1 && v <= 180) {
      save({ coffeeWorkMins: v });
    } else {
      setWorkMins(String(preferences.coffeeWorkMins));
    }
  };

  const handleBreakBlur = () => {
    const v = parseInt(breakMins, 10);
    if (!isNaN(v) && v >= 1 && v <= 60) {
      save({ coffeeBreakMins: v });
    } else {
      setBreakMins(String(preferences.coffeeBreakMins));
    }
  };

  // Access colour fields via cast — ThemeColors keys are a subset of UserPreferences keys
  const currentColors = preferences as unknown as ThemeColors;

  return (
    <div className="h-full overflow-auto page-enter">
      <div className="max-w-2xl mx-auto px-6 py-6 pb-16 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            Personalise your LifePlanner experience
          </p>
        </div>

        {/* ── Appearance ── */}
        <SectionCard>
          <SectionTitle icon={Palette} title="Appearance" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {THEME_PRESETS.map(preset => {
              const active = preferences.themeName === preset.name;
              return (
                <button
                  key={preset.name}
                  onClick={() => handleThemeSelect(preset.name)}
                  className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                    active
                      ? 'border-primary shadow-sm'
                      : 'border-border hover:border-primary/40'
                  }`}
                  style={{ background: preset.colors.colorBackground }}
                >
                  {active && (
                    <span
                      className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: preset.colors.colorPrimary }}
                    >
                      <Check className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                  <div className="flex gap-1 mb-2">
                    {[
                      preset.colors.colorPrimary,
                      preset.colors.colorSecondary,
                      preset.colors.colorAccent,
                      preset.colors.colorSuccess,
                    ].map((c, i) => (
                      <span
                        key={i}
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <p
                    className="text-xs font-semibold leading-tight"
                    style={{ color: preset.colors.colorTextPrimary }}
                  >
                    {preset.emoji} {preset.label}
                  </p>
                  <p
                    className="text-[10px] mt-0.5 leading-tight"
                    style={{ color: preset.colors.colorTextSecondary }}
                  >
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Custom colour editor */}
          {preferences.themeName === 'custom' && (
            <div className="mt-5 pt-5 border-t border-border">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                Custom Colours
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
                {(Object.keys(COLOR_FIELD_LABELS) as (keyof ThemeColors)[]).map(field => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="color"
                      value={currentColors[field]}
                      onChange={e =>
                        save({ [field]: e.target.value } as unknown as PreferencesPatch)
                      }
                      className="w-8 h-8 rounded-lg cursor-pointer border border-border p-0.5 bg-transparent"
                    />
                    <span className="text-xs text-text-secondary">
                      {COLOR_FIELD_LABELS[field]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Typography ── */}
        <SectionCard>
          <SectionTitle icon={Type} title="Typography" />
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5 block">
                Font Family
              </label>
              <select
                value={preferences.fontFamily}
                onChange={e => save({ fontFamily: e.target.value })}
                className="input-field text-sm"
              >
                {FONT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5 block">
                Font Size
              </label>
              <div className="flex gap-2">
                {FONT_SIZE_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => save({ fontSize: o.value })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                      preferences.fontSize === o.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface-elevated text-text-secondary border-border hover:border-primary/40'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── Density ── */}
        <SectionCard>
          <SectionTitle icon={LayoutGrid} title="Layout Density" />
          <div className="grid grid-cols-3 gap-3">
            {DENSITY_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => save({ density: o.value })}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  preferences.density === o.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    preferences.density === o.value ? 'text-primary' : 'text-text-primary'
                  }`}
                >
                  {o.label}
                </p>
                <p className="text-xs text-text-muted mt-0.5">{o.desc}</p>
              </button>
            ))}
          </div>
        </SectionCard>

        {/* ── Calendar ── */}
        <SectionCard>
          <SectionTitle icon={Calendar} title="Calendar Defaults" />
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5 block">
              Default View
            </label>
            <div className="flex gap-2">
              {CALENDAR_VIEW_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => save({ defaultCalendarView: o.value })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                    preferences.defaultCalendarView === o.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface-elevated text-text-secondary border-border hover:border-primary/40'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* ── Coffee Timer ── */}
        <SectionCard>
          <SectionTitle icon={Coffee} title="Coffee Timer Defaults" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-secondary mb-1.5 block">
                Work duration{' '}
                <span className="text-text-muted">(1–180 min)</span>
              </label>
              <input
                type="number"
                min={1}
                max={180}
                value={workMins}
                onChange={e => setWorkMins(e.target.value)}
                onBlur={handleWorkBlur}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1.5 block">
                Break duration{' '}
                <span className="text-text-muted">(1–60 min)</span>
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={breakMins}
                onChange={e => setBreakMins(e.target.value)}
                onBlur={handleBreakBlur}
                className="input-field"
              />
            </div>
          </div>
        </SectionCard>

        {/* ── Dashboard ── */}
        <SectionCard>
          <SectionTitle icon={LayoutDashboard} title="Dashboard" />
          <div className="space-y-4">
            <div>
              <label className="text-xs text-text-secondary mb-1.5 block">Weather Location</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. London, Tokyo, New York"
                value={weatherCity}
                onChange={(e) => setWeatherCity(e.target.value)}
                onBlur={() => {
                  const v = weatherCity.trim();
                  if (v) save({ weatherCity: v });
                  else setWeatherCity(preferences.weatherCity ?? 'London');
                }}
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1.5 block">Temperature Unit</label>
              <div className="flex gap-2">
                {([
                  { value: 'metric', label: 'Metric (°C)' },
                  { value: 'imperial', label: 'Imperial (°F)' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => save({ weatherUnit: opt.value })}
                    className={`flex-1 py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                      (preferences.weatherUnit ?? 'metric') === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-text-secondary hover:border-primary/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1.5 block">Uptime Kuma URL</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. http://apexpi.local:3001"
                value={kumaUrl}
                onChange={(e) => setKumaUrl(e.target.value)}
                onBlur={() => save({ uptimeKumaUrl: kumaUrl.trim() })}
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1.5 block">Status Page Slug</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. dash"
                value={kumaSlug}
                onChange={(e) => setKumaSlug(e.target.value)}
                onBlur={() => save({ uptimeKumaSlug: kumaSlug.trim() })}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── Account ── */}
        <SectionCard>
          <SectionTitle icon={User} title="Account" />
          {user && (
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-text-secondary">Username</span>
                <span className="text-sm font-medium text-text-primary">{user.username}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-text-secondary">Email</span>
                <span className="text-sm font-medium text-text-primary">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-text-secondary">Member since</span>
                <span className="text-sm font-medium text-text-primary">
                  {new Date(user.createdAt).toLocaleDateString('en-GB', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Danger Zone ── */}
        <SectionCard>
          <SectionTitle icon={AlertTriangle} title="Danger Zone" />
          <p className="text-sm text-text-secondary mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button
            disabled
            title="Contact support to delete your account"
            className="btn-danger opacity-50 cursor-not-allowed"
          >
            <AlertTriangle className="w-4 h-4" />
            Delete Account
          </button>
          <p className="text-xs text-text-muted mt-2">
            To delete your account, please contact support.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
