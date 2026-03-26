import { useState } from 'react';
import { X, Copy, Check, Download, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';

interface IcalTokenResponse {
  feedUrl: string;
  token: string;
}

const INSTRUCTIONS = [
  {
    platform: 'iOS',
    steps: [
      'Open Settings → Calendar → Accounts',
      'Tap "Add Account" → "Other"',
      'Tap "Add Subscribed Calendar"',
      'Paste the feed URL and tap Next',
    ],
  },
  {
    platform: 'Android (Google Calendar)',
    steps: [
      'Open Google Calendar on desktop (calendar.google.com)',
      'Sidebar → "Other calendars" → click "+" → "From URL"',
      'Paste the feed URL and click "Add Calendar"',
      'The calendar syncs automatically to your Android device',
    ],
  },
  {
    platform: 'Google Calendar (web)',
    steps: [
      'Go to calendar.google.com',
      'Click "+" next to "Other calendars" in the left sidebar',
      'Select "From URL"',
      'Paste the feed URL and click "Add Calendar"',
    ],
  },
  {
    platform: 'Outlook',
    steps: [
      'Open Outlook → Calendar view',
      'Click "Add calendar" → "Subscribe from web"',
      'Paste the feed URL and click "Import"',
    ],
  },
  {
    platform: 'GNOME Calendar / Thunderbird',
    steps: [
      'Thunderbird: File → New Calendar → "On the Network"',
      'Choose "iCalendar (ICS)" format',
      'Paste the feed URL and click "Find Calendars"',
      'GNOME Calendar: uses GNOME Online Accounts — add via Settings → Online Accounts',
    ],
  },
];

export default function SyncModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [expandedInstructions, setExpandedInstructions] = useState<string | null>(null);

  const {
    data,
    isFetching,
    refetch,
  } = useQuery<IcalTokenResponse>({
    queryKey: ['ical-token'],
    queryFn: async () => {
      const res = await apiClient.get<IcalTokenResponse>('/auth/ical-token');
      return res.data;
    },
    enabled: generated,
    staleTime: Infinity,
  });

  async function handleGenerate() {
    setGenerated(true);
    await refetch();
  }

  async function handleCopy() {
    if (!data?.feedUrl) return;
    await navigator.clipboard.writeText(data.feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    if (!data?.feedUrl) return;
    const res = await fetch(data.feedUrl);
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calendar.ics';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-text-primary">Sync & Export</h2>
          </div>
          <button
            className="p-2 rounded-xl hover:bg-surface-elevated text-text-secondary transition-colors"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
          {/* Subscribe section */}
          <section>
            <h3 className="text-sm font-semibold text-text-primary mb-1">
              Subscribe on your devices
            </h3>
            <p className="text-xs text-text-secondary mb-3">
              Generate a private feed URL and add it to any calendar app. Your events will sync
              automatically.
            </p>

            {!generated || !data ? (
              <button
                className="btn-primary text-sm"
                onClick={handleGenerate}
                disabled={isFetching}
              >
                {isFetching ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                Generate feed URL
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    readOnly
                    value={data.feedUrl}
                    className="input-field text-xs font-mono flex-1"
                  />
                  <button
                    className="btn-secondary text-sm px-3 flex-shrink-0"
                    onClick={handleCopy}
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-text-muted">
                  Keep this URL private — anyone with it can read your calendar.
                </p>
              </div>
            )}

            {/* Per-platform instructions */}
            {generated && data && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-text-secondary">
                  How to subscribe:
                </p>
                {INSTRUCTIONS.map((inst) => (
                  <div key={inst.platform} className="border border-border rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-elevated transition-colors text-sm font-medium text-text-primary"
                      onClick={() =>
                        setExpandedInstructions(
                          expandedInstructions === inst.platform ? null : inst.platform,
                        )
                      }
                    >
                      {inst.platform}
                      {expandedInstructions === inst.platform ? (
                        <ChevronDown className="w-4 h-4 text-text-secondary" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-text-secondary" />
                      )}
                    </button>
                    {expandedInstructions === inst.platform && (
                      <div className="px-4 pb-3 border-t border-border bg-surface">
                        <ol className="list-decimal list-inside space-y-1 mt-2">
                          {inst.steps.map((step, i) => (
                            <li key={i} className="text-xs text-text-secondary">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Export section */}
          <section>
            <h3 className="text-sm font-semibold text-text-primary mb-1">Export</h3>
            <p className="text-xs text-text-secondary mb-3">
              Download a one-time snapshot of all your events as an .ics file.
            </p>
            <button
              className="btn-secondary text-sm"
              onClick={handleDownload}
              disabled={!data}
              title={!data ? 'Generate a feed URL first' : undefined}
            >
              <Download className="w-4 h-4" />
              Download .ics
            </button>
            {!data && (
              <p className="text-xs text-text-muted mt-1">
                Generate a feed URL above to enable download.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
