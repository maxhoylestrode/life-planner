import { useState, useEffect } from 'react';
import { X, Save, Trash2, RefreshCw, ChevronDown } from 'lucide-react';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  allDay: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
  rrule?: string | null;
  recurrenceId?: string | null;
  parentEventId?: string | null;
  reminderMinutes?: number | null;
  isVirtual?: boolean;
}

export interface EventSaveData {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  color: string;
  rrule: string | null;
  reminderMinutes: number | null;
}

export const EVENT_COLORS = [
  { value: '#E8825A', label: 'Coral' },
  { value: '#F5A623', label: 'Amber' },
  { value: '#6BAF7A', label: 'Green' },
  { value: '#9B7FA6', label: 'Purple' },
  { value: '#5B9BD5', label: 'Blue' },
  { value: '#E87E7E', label: 'Rose' },
  { value: '#7EC8C8', label: 'Teal' },
  { value: '#B8A898', label: 'Warm gray' },
];

const REMINDER_OPTIONS = [
  { value: null, label: 'None' },
  { value: 0, label: 'At time of event' },
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

type RepeatPreset = 'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'yearly' | 'custom';

const DAY_LABELS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDateInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultStartForDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}

function defaultEndForDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
}

function dateToLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parse a basic RRULE string into the custom builder state */
function parseRrule(rrule: string | null | undefined): {
  preset: RepeatPreset;
  freq: string;
  interval: number;
  byDay: string[];
  endType: 'never' | 'date' | 'count';
  endDate: string;
  count: number;
} {
  const defaults = { preset: 'none' as RepeatPreset, freq: 'WEEKLY', interval: 1, byDay: [], endType: 'never' as const, endDate: '', count: 10 };
  if (!rrule) return defaults;

  const parts: Record<string, string> = {};
  rrule.split(';').forEach((p) => {
    const [k, v] = p.split('=');
    if (k && v !== undefined) parts[k.toUpperCase()] = v;
  });

  const freq = parts['FREQ'] || 'WEEKLY';
  const interval = parseInt(parts['INTERVAL'] || '1', 10) || 1;
  const byDay = parts['BYDAY'] ? parts['BYDAY'].split(',') : [];
  const endType = parts['UNTIL'] ? 'date' : parts['COUNT'] ? 'count' : 'never';
  const endDate = parts['UNTIL'] ? parts['UNTIL'].slice(0, 10) : '';
  const count = parseInt(parts['COUNT'] || '10', 10) || 10;

  let preset: RepeatPreset = 'custom';
  if (interval === 1) {
    if (freq === 'DAILY' && byDay.length === 0) preset = 'daily';
    else if (freq === 'WEEKLY' && byDay.join(',') === 'MO,TU,WE,TH,FR') preset = 'weekdays';
    else if (freq === 'MONTHLY' && byDay.length === 0) preset = 'monthly';
    else if (freq === 'YEARLY' && byDay.length === 0) preset = 'yearly';
    else if (freq === 'WEEKLY' && byDay.length <= 1) preset = 'weekly';
  }

  return { preset, freq, interval, byDay, endType, endDate, count };
}

function buildRrule(
  preset: RepeatPreset,
  startTime: string,
  freq: string,
  interval: number,
  byDay: string[],
  endType: 'never' | 'date' | 'count',
  endDate: string,
  count: number,
): string | null {
  if (preset === 'none') return null;

  let parts: string;
  if (preset === 'daily') parts = 'FREQ=DAILY';
  else if (preset === 'weekdays') parts = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
  else if (preset === 'weekly') {
    const dt = startTime ? new Date(startTime) : new Date();
    const dayIdx = dt.getDay(); // 0=Sun
    const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    parts = `FREQ=WEEKLY;BYDAY=${dayMap[dayIdx]}`;
  } else if (preset === 'monthly') parts = 'FREQ=MONTHLY';
  else if (preset === 'yearly') parts = 'FREQ=YEARLY';
  else {
    // custom
    const bydayStr = byDay.length > 0 && freq === 'WEEKLY' ? `;BYDAY=${byDay.join(',')}` : '';
    parts = `FREQ=${freq};INTERVAL=${interval}${bydayStr}`;
  }

  if (endType === 'date' && endDate) {
    parts += `;UNTIL=${endDate.replace(/-/g, '')}T235959Z`;
  } else if (endType === 'count' && count > 0) {
    parts += `;COUNT=${count}`;
  }

  return parts;
}

interface EventModalProps {
  event?: CalendarEvent | null;
  defaultDate?: Date;
  onSave: (data: EventSaveData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export default function EventModal({
  event,
  defaultDate,
  onSave,
  onDelete,
  onClose,
}: EventModalProps) {
  const initDate = defaultDate || new Date();

  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startTime, setStartTime] = useState(
    event
      ? allDay ? toLocalDateInput(event.startTime) : toLocalDatetimeInput(event.startTime)
      : allDay ? dateToLocalInput(initDate) : defaultStartForDate(initDate),
  );
  const [endTime, setEndTime] = useState(
    event?.endTime
      ? allDay ? toLocalDateInput(event.endTime) : toLocalDatetimeInput(event.endTime)
      : allDay ? dateToLocalInput(initDate) : defaultEndForDate(initDate),
  );
  const [color, setColor] = useState(event?.color || '#E8825A');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(
    event?.reminderMinutes !== undefined && event.reminderMinutes !== null ? event.reminderMinutes : null,
  );

  // Repeat state
  const parsed = parseRrule(event?.rrule);
  const [repeatPreset, setRepeatPreset] = useState<RepeatPreset>(parsed.preset);
  const [customFreq, setCustomFreq] = useState(parsed.freq);
  const [customInterval, setCustomInterval] = useState(parsed.interval);
  const [customByDay, setCustomByDay] = useState<string[]>(parsed.byDay);
  const [customEndType, setCustomEndType] = useState<'never' | 'date' | 'count'>(parsed.endType);
  const [customEndDate, setCustomEndDate] = useState(parsed.endDate);
  const [customCount, setCustomCount] = useState(parsed.count);
  const [showCustom, setShowCustom] = useState(parsed.preset === 'custom');

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!event) {
      if (allDay) {
        setStartTime(dateToLocalInput(initDate));
        setEndTime(dateToLocalInput(initDate));
      } else {
        setStartTime(defaultStartForDate(initDate));
        setEndTime(defaultEndForDate(initDate));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDay]);

  const handleRepeatPresetChange = (p: RepeatPreset) => {
    setRepeatPreset(p);
    setShowCustom(p === 'custom');
  };

  const toggleByDay = (day: string) => {
    setCustomByDay((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Event title is required');
      return;
    }

    const startISO = allDay
      ? new Date(startTime + 'T00:00:00').toISOString()
      : new Date(startTime).toISOString();

    const endISO = endTime
      ? allDay
        ? new Date(endTime + 'T23:59:59').toISOString()
        : new Date(endTime).toISOString()
      : '';

    const rrule = buildRrule(
      repeatPreset,
      startTime,
      customFreq,
      customInterval,
      customByDay,
      customEndType,
      customEndDate,
      customCount,
    );

    setIsSaving(true);
    setError('');

    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        startTime: startISO,
        endTime: endISO,
        allDay,
        color,
        rrule,
        reminderMinutes,
      });
      onClose();
    } catch {
      setError('Failed to save event. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm('Delete this event?')) return;
    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch {
      setError('Failed to delete event.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">
            {event ? 'Edit event' : 'New event'}
          </h2>
          <button
            className="p-2 rounded-xl hover:bg-surface-elevated text-text-secondary transition-colors"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Event title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Meeting, birthday, workout..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Description
            </label>
            <textarea
              className="input-field resize-none"
              placeholder="Optional notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* All day toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                allDay ? 'bg-primary' : 'bg-border'
              }`}
              onClick={() => setAllDay((v) => !v)}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  allDay ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-text-secondary font-medium">All day event</span>
          </div>

          {/* Start / End times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                {allDay ? 'Start date' : 'Start time'}
              </label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                className="input-field text-sm"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                {allDay ? 'End date' : 'End time'}
              </label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                className="input-field text-sm"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Repeat */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Repeat
            </label>
            <select
              className="input-field text-sm"
              value={repeatPreset}
              onChange={(e) => handleRepeatPresetChange(e.target.value as RepeatPreset)}
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="weekdays">Every weekday (Mon–Fri)</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom…</option>
            </select>

            {showCustom && (
              <div className="mt-3 p-4 bg-surface-elevated rounded-xl space-y-3 border border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">Every</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    className="input-field text-sm w-16 px-2 py-1"
                    value={customInterval}
                    onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <select
                    className="input-field text-sm flex-1"
                    value={customFreq}
                    onChange={(e) => setCustomFreq(e.target.value)}
                  >
                    <option value="DAILY">day(s)</option>
                    <option value="WEEKLY">week(s)</option>
                    <option value="MONTHLY">month(s)</option>
                    <option value="YEARLY">year(s)</option>
                  </select>
                </div>

                {customFreq === 'WEEKLY' && (
                  <div>
                    <p className="text-xs text-text-secondary mb-2">Repeat on</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {DAY_LABELS.map((d, i) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleByDay(d)}
                          className={`w-9 h-9 rounded-full text-xs font-medium transition-colors ${
                            customByDay.includes(d)
                              ? 'bg-primary text-white'
                              : 'bg-surface border border-border text-text-secondary hover:border-primary'
                          }`}
                        >
                          {DAY_NAMES_SHORT[i]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs text-text-secondary mb-2">Ends</p>
                  <div className="space-y-2">
                    {(['never', 'date', 'count'] as const).map((type) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="endType"
                          value={type}
                          checked={customEndType === type}
                          onChange={() => setCustomEndType(type)}
                          className="accent-primary"
                        />
                        <span className="text-sm text-text-secondary">
                          {type === 'never' && 'Never'}
                          {type === 'date' && 'On date'}
                          {type === 'count' && 'After'}
                        </span>
                        {type === 'date' && customEndType === 'date' && (
                          <input
                            type="date"
                            className="input-field text-sm py-1 px-2 ml-1"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                          />
                        )}
                        {type === 'count' && customEndType === 'count' && (
                          <div className="flex items-center gap-1.5 ml-1">
                            <input
                              type="number"
                              min={1}
                              max={999}
                              className="input-field text-sm w-16 px-2 py-1"
                              value={customCount}
                              onChange={(e) => setCustomCount(Math.max(1, parseInt(e.target.value) || 1))}
                            />
                            <span className="text-sm text-text-secondary">occurrences</span>
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Remind me
            </label>
            <select
              className="input-field text-sm"
              value={reminderMinutes === null ? 'none' : String(reminderMinutes)}
              onChange={(e) => {
                const v = e.target.value;
                setReminderMinutes(v === 'none' ? null : parseInt(v, 10));
              }}
            >
              {REMINDER_OPTIONS.map((o) => (
                <option key={String(o.value)} value={o.value === null ? 'none' : String(o.value)}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  className="w-8 h-8 rounded-full border-4 transition-all hover:scale-110"
                  style={{
                    backgroundColor: c.value,
                    borderColor: color === c.value ? c.value : 'transparent',
                    boxShadow: color === c.value ? `0 0 0 2px white, 0 0 0 4px ${c.value}` : 'none',
                  }}
                  title={c.label}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 border-t border-border flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            {event && onDelete && (
              <button
                className="btn-danger text-sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost text-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-primary text-sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Small dialog shown before editing a recurring occurrence */
export function RecurringEditDialog({
  onThisOnly,
  onAllEvents,
  onCancel,
}: {
  onThisOnly: () => void;
  onAllEvents: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-text-primary mb-1">Edit recurring event</h2>
        <p className="text-sm text-text-secondary mb-5">Which events do you want to edit?</p>
        <div className="space-y-2">
          <button
            className="w-full text-left px-4 py-3 rounded-xl hover:bg-surface-elevated border border-border transition-colors text-sm font-medium text-text-primary"
            onClick={onThisOnly}
          >
            Edit this event only
          </button>
          <button
            className="w-full text-left px-4 py-3 rounded-xl hover:bg-surface-elevated border border-border transition-colors text-sm font-medium text-text-primary"
            onClick={onAllEvents}
          >
            Edit all events in the series
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-ghost text-sm" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Re-export ChevronDown so SyncModal can use it without extra imports
export { ChevronDown };
