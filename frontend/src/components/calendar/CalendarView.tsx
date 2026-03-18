import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Clock, Pencil, Trash2 } from 'lucide-react';
import apiClient from '../../api/client';
import EventModal, { CalendarEvent } from './EventModal';

interface EventsResponse {
  events: CalendarEvent[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getEventDateKey(event: CalendarEvent): string {
  const d = new Date(event.startTime);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function CalendarView() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1); // 1-indexed
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultModalDate, setDefaultModalDate] = useState<Date>(today);

  const { data, isLoading } = useQuery<EventsResponse>({
    queryKey: ['events', viewYear, viewMonth],
    queryFn: async () => {
      const response = await apiClient.get<EventsResponse>('/calendar', {
        params: { month: viewMonth, year: viewYear },
      });
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (eventData: {
      title: string;
      description: string;
      startTime: string;
      endTime: string;
      allDay: boolean;
      color: string;
    }) => {
      const response = await apiClient.post('/calendar', eventData);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      title: string;
      description: string;
      startTime: string;
      endTime: string;
      allDay: boolean;
      color: string;
    }) => {
      const response = await apiClient.put(`/calendar/${id}`, data);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/calendar/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    const lastDay = new Date(viewYear, viewMonth, 0);

    // Get day of week for first day (0=Sun, adjust to Mon=0)
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: Array<{ date: Date; inMonth: boolean }> = [];

    // Pad before
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() - i - 1);
      days.push({ date: d, inMonth: false });
    }

    // Month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(viewYear, viewMonth - 1, d), inMonth: true });
    }

    // Pad after (to complete last row)
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(lastDay);
        d.setDate(d.getDate() + i);
        days.push({ date: d, inMonth: false });
      }
    }

    return days;
  }, [viewYear, viewMonth]);

  // Group events by date key
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    (data?.events || []).forEach((ev) => {
      const key = getEventDateKey(ev);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [data]);

  const selectedDateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
  const selectedEvents = eventsByDate[selectedDateKey] || [];

  const goToPrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth() + 1);
    setSelectedDate(today);
  };

  const openNewEvent = (date?: Date) => {
    setEditingEvent(null);
    setDefaultModalDate(date || selectedDate);
    setIsModalOpen(true);
  };

  const openEditEvent = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setIsModalOpen(true);
  };

  const handleSave = async (eventData: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    allDay: boolean;
    color: string;
  }) => {
    if (editingEvent) {
      await updateMutation.mutateAsync({ id: editingEvent.id, ...eventData });
    } else {
      await createMutation.mutateAsync(eventData);
    }
  };

  const handleDelete = async () => {
    if (editingEvent) {
      await deleteMutation.mutateAsync(editingEvent.id);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:h-full gap-0">
      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              className="p-2 rounded-xl hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
              onClick={goToPrevMonth}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-text-primary min-w-[160px] text-center">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </h2>
            <button
              className="p-2 rounded-xl hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
              onClick={goToNextMonth}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-sm py-1.5" onClick={goToToday}>
              Today
            </button>
            <button className="btn-primary text-sm py-1.5" onClick={() => openNewEvent()}>
              <Plus className="w-4 h-4" />
              Add Event
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-text-secondary py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 flex-1 gap-px bg-border rounded-2xl overflow-hidden border border-border">
            {calendarDays.map(({ date, inMonth }, idx) => {
              const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
              const dayEvents = eventsByDate[key] || [];
              const isToday = isSameDay(date, today);
              const isSelected = isSameDay(date, selectedDate);
              const maxVisible = 3;
              const overflow = dayEvents.length - maxVisible;

              return (
                <div
                  key={idx}
                  className={`
                    bg-surface min-h-[80px] lg:min-h-[100px] p-1.5 cursor-pointer transition-colors relative
                    ${!inMonth ? 'opacity-40' : ''}
                    ${isSelected && !isToday ? 'bg-primary/5' : ''}
                    hover:bg-surface-elevated
                  `}
                  onClick={() => {
                    setSelectedDate(date);
                    if (!inMonth) {
                      setViewYear(date.getFullYear());
                      setViewMonth(date.getMonth() + 1);
                    }
                  }}
                  onDoubleClick={() => openNewEvent(date)}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`
                        text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors
                        ${isToday ? 'bg-primary text-white font-bold' : isSelected ? 'bg-primary/20 text-primary font-semibold' : 'text-text-primary'}
                      `}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  {/* Event pills */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, maxVisible).map((ev) => (
                      <div
                        key={ev.id}
                        className="event-pill text-white truncate"
                        style={{ backgroundColor: ev.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditEvent(ev);
                        }}
                        title={ev.title}
                      >
                        {ev.allDay ? '' : formatTime(ev.startTime) + ' '}
                        {ev.title}
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div className="text-xs text-text-secondary font-medium px-1">
                        +{overflow} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Side panel — selected day events */}
      <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-surface flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-text-primary">
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {selectedEvents.length === 0
                ? 'No events'
                : `${selectedEvents.length} event${selectedEvents.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            className="p-2 rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors shadow-warm"
            onClick={() => openNewEvent()}
            title="Add event"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-2">
          {selectedEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-text-secondary text-sm">Nothing scheduled</p>
              <p className="text-text-muted text-xs mt-1">Tap the + button or double-click a day to add an event</p>
            </div>
          )}

          {selectedEvents.map((ev) => (
            <div
              key={ev.id}
              className="group flex items-start gap-3 p-3 rounded-xl bg-surface-elevated border border-border/60 hover:border-border transition-all"
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                style={{ backgroundColor: ev.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{ev.title}</p>
                {ev.allDay ? (
                  <p className="text-xs text-text-secondary mt-0.5">All day</p>
                ) : (
                  <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(ev.startTime)}
                    {ev.endTime && ` → ${formatTime(ev.endTime)}`}
                  </p>
                )}
                {ev.description && (
                  <p className="text-xs text-text-muted mt-1 line-clamp-2">{ev.description}</p>
                )}
              </div>
              <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  className="p-1.5 rounded-lg hover:bg-border text-text-secondary hover:text-primary transition-colors"
                  onClick={() => openEditEvent(ev)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1.5 rounded-lg hover:bg-red-50 text-text-secondary hover:text-red-500 transition-colors"
                  onClick={() => deleteMutation.mutate(ev.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Event Modal */}
      {isModalOpen && (
        <EventModal
          event={editingEvent}
          defaultDate={defaultModalDate}
          onSave={handleSave}
          onDelete={editingEvent ? handleDelete : undefined}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEvent(null);
          }}
        />
      )}
    </div>
  );
}
