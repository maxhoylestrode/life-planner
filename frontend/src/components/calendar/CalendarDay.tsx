// CalendarDay is rendered inline within CalendarView.tsx for performance.
// This file is kept for reference — the day cell logic lives in CalendarView.tsx.

export interface CalendarDayProps {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: Array<{
    id: string;
    title: string;
    color: string;
    allDay: boolean;
    startTime: string;
  }>;
  onClick: () => void;
  onDoubleClick: () => void;
  onEventClick: (eventId: string) => void;
}

export function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
