import { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  allDay: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

const EVENT_COLORS = [
  { value: '#E8825A', label: 'Coral' },
  { value: '#F5A623', label: 'Amber' },
  { value: '#6BAF7A', label: 'Green' },
  { value: '#9B7FA6', label: 'Purple' },
  { value: '#5B9BD5', label: 'Blue' },
  { value: '#E87E7E', label: 'Rose' },
  { value: '#7EC8C8', label: 'Teal' },
  { value: '#B8A898', label: 'Warm gray' },
];

interface EventModalProps {
  event?: CalendarEvent | null;
  defaultDate?: Date;
  onSave: (data: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    allDay: boolean;
    color: string;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

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
  d.setHours(10, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
}

function dateToLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
      ? allDay
        ? toLocalDateInput(event.startTime)
        : toLocalDatetimeInput(event.startTime)
      : allDay
        ? dateToLocalInput(initDate)
        : defaultStartForDate(initDate)
  );
  const [endTime, setEndTime] = useState(
    event?.endTime
      ? allDay
        ? toLocalDateInput(event.endTime)
        : toLocalDatetimeInput(event.endTime)
      : allDay
        ? dateToLocalInput(initDate)
        : defaultEndForDate(initDate)
  );
  const [color, setColor] = useState(event?.color || '#E8825A');
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

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Color
            </label>
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
        <div className="px-6 pb-6 pt-3 border-t border-border flex items-center justify-between">
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

export { EVENT_COLORS };
