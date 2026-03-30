import { Server, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { useUptimeKuma, type MonitorHeartbeat } from '../../hooks/useUptimeKuma';

function Sparkline({ beats }: { beats: MonitorHeartbeat[] }) {
  const pings = beats.map((b) => b.ping ?? 0);
  if (pings.length < 2) return null;

  const max = Math.max(...pings, 1);
  const w = 80;
  const h = 24;
  const step = w / (pings.length - 1);

  const points = pings
    .map((p, i) => `${i * step},${h - (p / max) * h}`)
    .join(' ');

  return (
    <svg width={w} height={h} className="overflow-visible opacity-60">
      <polyline
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

export default function ServerStatusWidget() {
  const { preferences } = useTheme();
  const url = preferences?.uptimeKumaUrl ?? '';
  const slug = preferences?.uptimeKumaSlug ?? '';

  const { monitors, isLoading, isError, isMisconfigured } = useUptimeKuma(url, slug);

  if (isMisconfigured) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-text-primary">Servers</span>
        </div>
        <p className="text-xs text-text-muted mb-2">Configure Uptime Kuma in Settings to see server status.</p>
        <Link to="/settings" className="text-xs text-primary flex items-center gap-1 hover:underline">
          <Settings className="w-3 h-3" /> Open Settings
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card p-5 space-y-3 animate-pulse">
        <div className="h-4 w-20 bg-border rounded" />
        {[1, 2].map((i) => (
          <div key={i} className="h-8 bg-border rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Server className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-text-primary">Servers</span>
        </div>
        <p className="text-xs text-text-muted">Could not reach Uptime Kuma</p>
      </div>
    );
  }

  const allUp = monitors.every((m) => m.isUp);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-text-primary">Servers</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          allUp ? 'bg-success/15 text-success' : 'bg-red-500/15 text-red-500'
        }`}>
          {allUp ? 'All Online' : 'Issues Detected'}
        </span>
      </div>

      <div className="space-y-3">
        {monitors.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            {/* Status dot */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.isUp ? 'bg-success' : 'bg-red-500'}`} />

            {/* Name + uptime */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-text-primary truncate">{m.name}</span>
                <span className={`text-xs font-semibold tabular-nums flex-shrink-0 ${
                  m.uptime24h >= 0.99 ? 'text-success' : m.uptime24h >= 0.95 ? 'text-secondary' : 'text-red-500'
                }`}>
                  {(m.uptime24h * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <Sparkline beats={m.heartbeats} />
                {m.latestPing !== null && (
                  <span className="text-xs text-text-muted tabular-nums">{m.latestPing}ms</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
