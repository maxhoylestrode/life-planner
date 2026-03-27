import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Pencil,
  Trash2,
  Link2,
  Bell,
  X,
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import apiClient from '../../api/client';
import EventModal, {
  CalendarEvent,
  EventSaveData,
  RecurringEditDialog,
} from './EventModal';
import WeekView from './WeekView';
import DayView from './DayView';
import SyncModal from './SyncModal';
import { scheduleEventReminder } from '../../lib/notifications';
import { useTheme } from '../../hooks/useTheme';

// ---- Types ----

type ViewMode = 'month' | 'week' | 'day';

interface EventsResponse {
  events: CalendarEvent[];
}

// ---- Helpers ----

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
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ---- Multi-day bar layout types & helpers ----

interface SpanBar {
  event: CalendarEvent;
  startCol: number;
  endCol: number;
  slot: number;
  continuesLeft: boolean;
  continuesRight: boolean;
}

interface WeekLayout {
  days: Array<{ date: Date; inMonth: boolean }>;
  bars: SpanBar[];
  hiddenBars: SpanBar[];
  singleDayEvents: Record<number, CalendarEvent[]>;
}

function dayFloor(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function computeWeekLayouts(
  calendarDays: Array<{ date: Date; inMonth: boolean }>,
  events: CalendarEvent[],
): WeekLayout[] {
  const weeks: WeekLayout[] = [];
  for (let w = 0; w < calendarDays.length; w += 7) {
    const weekDays = calendarDays.slice(w, w + 7);
    const wsTime = dayFloor(weekDays[0].date);
    const weTime = dayFloor(weekDays[6].date);

    const weekEvents = events.filter((ev) => {
      const start = dayFloor(new Date(ev.startTime));
      const end = ev.endTime ? dayFloor(new Date(ev.endTime)) : start;
      return start <= weTime && end >= wsTime;
    });

    const multiDay: Array<{
      event: CalendarEvent;
      startCol: number;
      endCol: number;
      continuesLeft: boolean;
      continuesRight: boolean;
    }> = [];
    const singleDayEvents: Record<number, CalendarEvent[]> = {};

    for (const ev of weekEvents) {
      const evStartDay = dayFloor(new Date(ev.startTime));
      const evEndDay = ev.endTime ? dayFloor(new Date(ev.endTime)) : evStartDay;
      const isMultiDay = evEndDay > evStartDay;

      if (isMultiDay) {
        const continuesLeft = evStartDay < wsTime;
        const continuesRight = evEndDay > weTime;
        const clippedStart = Math.max(evStartDay, wsTime);
        const clippedEnd = Math.min(evEndDay, weTime);
        const startCol = weekDays.findIndex((d) => dayFloor(d.date) === clippedStart);
        const endCol = weekDays.findIndex((d) => dayFloor(d.date) === clippedEnd);
        multiDay.push({
          event: ev,
          startCol: startCol >= 0 ? startCol : 0,
          endCol: endCol >= 0 ? endCol : 6,
          continuesLeft,
          continuesRight,
        });
      } else {
        const col = weekDays.findIndex((d) => dayFloor(d.date) === evStartDay);
        if (col >= 0) {
          if (!singleDayEvents[col]) singleDayEvents[col] = [];
          singleDayEvents[col].push(ev);
        }
      }
    }

    // Longer spans first within same start col
    multiDay.sort(
      (a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol),
    );

    // Greedy slot assignment
    const slotEndCols: number[] = [];
    const barsWithSlots: SpanBar[] = [];
    for (const item of multiDay) {
      let slot = slotEndCols.findIndex((ec) => ec < item.startCol);
      if (slot === -1) {
        slot = slotEndCols.length;
        slotEndCols.push(-1);
      }
      slotEndCols[slot] = item.endCol;
      barsWithSlots.push({ ...item, slot });
    }

    weeks.push({
      days: weekDays,
      bars: barsWithSlots.filter((b) => b.slot < 3),
      hiddenBars: barsWithSlots.filter((b) => b.slot >= 3),
      singleDayEvents,
    });
  }
  return weeks;
}

/** Get Monday of the week containing `date` */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ISO date range for API given viewMode and anchor date */
function getQueryRange(mode: ViewMode, anchor: Date): { start: Date; end: Date } {
  if (mode === 'week') {
    const ws = getWeekStart(anchor);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    we.setHours(23, 59, 59, 999);
    // Pad a day on each side so recurring expansions near boundaries are caught
    const start = new Date(ws);
    start.setDate(start.getDate() - 1);
    return { start, end: we };
  }
  if (mode === 'day') {
    const start = new Date(anchor);
    start.setHours(0, 0, 0, 0);
    const end = new Date(anchor);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  // month — include full calendar grid padding (prev/next month days visible)
  const firstDay = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const start = new Date(firstDay);
  start.setDate(start.getDate() - startDow);
  start.setHours(0, 0, 0, 0);
  const end = new Date(lastDay);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ---- Draggable month event pill ----

function DraggableMonthPill({
  event,
  onClick,
  isDragging,
}: {
  event: CalendarEvent;
  onClick: () => void;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: event.id,
    data: { event },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="event-pill text-white truncate cursor-grab active:cursor-grabbing select-none"
      style={{
        backgroundColor: event.color,
        opacity: isDragging ? 0.3 : 1,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={event.title}
    >
      {event.allDay ? '' : formatTime(event.startTime) + ' '}
      {event.title}
    </div>
  );
}

// ---- Droppable day cell ----

function DroppableDayCell({
  date,
  children,
  className,
  onClick,
  onDoubleClick,
}: {
  date: Date;
  children: React.ReactNode;
  className: string;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const id = `day-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const { setNodeRef, isOver } = useDroppable({ id, data: { date } });
  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'bg-primary/10' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </div>
  );
}

// ---- Main Component ----

export default function CalendarView() {
  const queryClient = useQueryClient();
  const today = new Date();
  const { preferences } = useTheme();

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const hasInitViewRef = useRef(false);

  // Initialise view mode from preferences (once, on first load)
  useEffect(() => {
    if (preferences && !hasInitViewRef.current) {
      hasInitViewRef.current = true;
      const pref = preferences.defaultCalendarView as ViewMode;
      if (pref === 'week' || pref === 'day') setViewMode(pref);
    }
  }, [preferences]);
  const [viewDate, setViewDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultModalDate, setDefaultModalDate] = useState<Date>(today);
  const [defaultModalHour, setDefaultModalHour] = useState<number | null>(null);
  const [isSyncOpen, setIsSyncOpen] = useState(false);

  // Recurring edit dialog state
  const [recurringDialogEvent, setRecurringDialogEvent] =
    useState<CalendarEvent | null>(null);

  // Notification permission banner
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'granted',
  );
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(
    () => localStorage.getItem('notif-banner-dismissed') === '1',
  );

  // ---- DnD for month view ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // ---- Query range ----

  const { start: windowStart, end: windowEnd } = useMemo(
    () => getQueryRange(viewMode, viewDate),
    [viewMode, viewDate],
  );

  const queryKey = ['events', windowStart.toISOString(), windowEnd.toISOString()];

  const { data, isLoading } = useQuery<EventsResponse>({
    queryKey,
    queryFn: async () => {
      const response = await apiClient.get<EventsResponse>('/calendar', {
        params: {
          start: windowStart.toISOString(),
          end: windowEnd.toISOString(),
        },
      });
      return response.data;
    },
  });

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: async (eventData: EventSaveData) => {
      const res = await apiClient.post('/calendar', eventData);
      return res.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (result?.event?.reminderMinutes !== null && result?.event?.reminderMinutes !== undefined) {
        scheduleEventReminder(result.event, result.event.reminderMinutes);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...eventData }: EventSaveData & { id: string }) => {
      const res = await apiClient.put(`/calendar/${id}`, eventData);
      return res.data;
    },
    onMutate: async ({ id, startTime, endTime, ...rest }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<EventsResponse>(queryKey);
      queryClient.setQueryData<EventsResponse>(queryKey, (old) => {
        if (!old) return old;
        return {
          events: old.events.map((ev) =>
            ev.id === id
              ? { ...ev, startTime, endTime: endTime || null, ...rest }
              : ev,
          ),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, scope }: { id: string; scope?: string }) => {
      await apiClient.delete(`/calendar/${id}`, { params: scope ? { scope } : undefined });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  // ---- Calendar grid (month view) ----

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const lastDay = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() - i - 1);
      days.push({ date: d, inMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({
        date: new Date(viewDate.getFullYear(), viewDate.getMonth(), d),
        inMonth: true,
      });
    }
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(lastDay);
        d.setDate(d.getDate() + i);
        days.push({ date: d, inMonth: false });
      }
    }
    return days;
  }, [viewDate]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    (data?.events || []).forEach((ev) => {
      const key = getEventDateKey(ev);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [data]);

  const weekLayouts = useMemo(
    () => computeWeekLayouts(calendarDays, data?.events || []),
    [calendarDays, data],
  );

  const selectedDateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
  const selectedEvents = eventsByDate[selectedDateKey] || [];

  // ---- Navigation ----

  const goToPrev = () => {
    const d = new Date(viewDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setViewDate(d);
  };

  const goToNext = () => {
    const d = new Date(viewDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setViewDate(d);
  };

  const goToToday = () => {
    setViewDate(new Date(today));
    setSelectedDate(new Date(today));
  };

  // ---- Title string ----

  const viewTitle = useMemo(() => {
    if (viewMode === 'month') {
      return `${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
    }
    if (viewMode === 'week') {
      const ws = getWeekStart(viewDate);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      if (ws.getFullYear() !== we.getFullYear()) {
        return `${ws.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} — ${we.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
      }
      if (ws.getMonth() !== we.getMonth()) {
        return `${ws.toLocaleDateString('en-US', opts)} — ${we.toLocaleDateString('en-US', opts)}, ${we.getFullYear()}`;
      }
      return `${ws.toLocaleDateString('en-US', opts)} – ${we.getDate()}, ${we.getFullYear()}`;
    }
    return viewDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [viewMode, viewDate]);

  // ---- Modal helpers ----

  const openNewEvent = useCallback(
    (date?: Date, hour?: number) => {
      setEditingEvent(null);
      setDefaultModalDate(date || selectedDate);
      setDefaultModalHour(hour ?? null);
      setIsModalOpen(true);
    },
    [selectedDate],
  );

  const openEditEvent = useCallback((ev: CalendarEvent) => {
    if (ev.parentEventId || ev.isVirtual) {
      setRecurringDialogEvent(ev);
    } else {
      setEditingEvent(ev);
      setIsModalOpen(true);
    }
  }, []);

  const getModalDefaultDate = (): Date => {
    const d = new Date(defaultModalDate);
    if (defaultModalHour !== null) {
      d.setHours(defaultModalHour, 0, 0, 0);
    }
    return d;
  };

  // ---- Save / Delete ----

  const handleSave = async (
    eventData: EventSaveData,
    editScope?: 'this' | 'all',
  ) => {
    if (editingEvent) {
      const targetId =
        editScope === 'all' && editingEvent.parentEventId
          ? editingEvent.parentEventId
          : editingEvent.id;
      await updateMutation.mutateAsync({ id: targetId, ...eventData });
    } else {
      await createMutation.mutateAsync(eventData);
    }
  };

  const handleDelete = async (scope?: 'this' | 'all') => {
    if (!editingEvent) return;
    const deleteScope =
      editingEvent.isVirtual || editingEvent.parentEventId
        ? scope === 'all'
          ? 'all'
          : 'this'
        : undefined;
    await deleteMutation.mutateAsync({ id: editingEvent.id, scope: deleteScope });
  };

  // ---- Month view DnD ----

  function handleMonthDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    const draggedEvent = (data?.events || []).find((ev) => ev.id === e.active.id);
    const destDate = e.over?.data.current?.date as Date | undefined;
    if (!draggedEvent || !destDate) return;

    const origStart = new Date(draggedEvent.startTime);
    const newStart = new Date(destDate);
    newStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);

    if (isSameDay(origStart, newStart)) return;

    const duration =
      draggedEvent.endTime
        ? new Date(draggedEvent.endTime).getTime() - origStart.getTime()
        : 0;
    const newEnd = duration > 0 ? new Date(newStart.getTime() + duration) : null;

    updateMutation.mutate({
      id: draggedEvent.id,
      title: draggedEvent.title,
      description: draggedEvent.description || '',
      startTime: newStart.toISOString(),
      endTime: newEnd ? newEnd.toISOString() : '',
      allDay: draggedEvent.allDay,
      color: draggedEvent.color,
      rrule: draggedEvent.rrule ?? null,
      reminderMinutes: draggedEvent.reminderMinutes ?? null,
    });
  }

  // ---- Week/Day view DnD ----

  const handleTimeGridDrop = useCallback(
    (event: CalendarEvent, newStart: Date) => {
      const origStart = new Date(event.startTime);
      const duration = event.endTime
        ? new Date(event.endTime).getTime() - origStart.getTime()
        : 0;
      const newEnd = duration > 0 ? new Date(newStart.getTime() + duration) : null;

      updateMutation.mutate({
        id: event.id,
        title: event.title,
        description: event.description || '',
        startTime: newStart.toISOString(),
        endTime: newEnd ? newEnd.toISOString() : '',
        allDay: event.allDay,
        color: event.color,
        rrule: event.rrule ?? null,
        reminderMinutes: event.reminderMinutes ?? null,
      });
    },
    [updateMutation],
  );

  // ---- Notification permission ----

  async function requestNotificationPermission() {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm !== 'default') {
      setNotifBannerDismissed(true);
      localStorage.setItem('notif-banner-dismissed', '1');
    }
  }

  function dismissNotifBanner() {
    setNotifBannerDismissed(true);
    localStorage.setItem('notif-banner-dismissed', '1');
  }

  const showNotifBanner =
    !notifBannerDismissed && notifPermission === 'default';

  // ---- Render ----

  const weekStart = getWeekStart(viewDate);

  return (
    <div className="flex flex-col lg:flex-row lg:h-full gap-0">
      {/* Calendar main area */}
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-6">
        {/* Notification banner */}
        {showNotifBanner && (
          <div className="mb-3 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm">
            <Bell className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-amber-800 flex-1">
              Enable notifications to get reminders for your events.
            </span>
            <button
              className="text-amber-700 font-semibold hover:underline"
              onClick={requestNotificationPermission}
            >
              Enable
            </button>
            <button
              className="p-1 rounded hover:bg-amber-100 text-amber-600 transition-colors"
              onClick={dismissNotifBanner}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <button
              className="p-2 rounded-xl hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
              onClick={goToPrev}
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-text-primary min-w-[180px] text-center">
              {viewTitle}
            </h2>
            <button
              className="p-2 rounded-xl hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
              onClick={goToNext}
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex rounded-xl overflow-hidden border border-border bg-surface">
              {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors capitalize ${
                    viewMode === v
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:bg-surface-elevated'
                  }`}
                  onClick={() => setViewMode(v)}
                >
                  {v}
                </button>
              ))}
            </div>

            <button className="btn-secondary text-sm py-1.5" onClick={goToToday}>
              Today
            </button>
            <button
              className="p-2 rounded-xl hover:bg-surface-elevated text-text-secondary hover:text-primary transition-colors"
              onClick={() => setIsSyncOpen(true)}
              title="Sync & Export"
            >
              <Link2 className="w-4 h-4" />
            </button>
            <button
              className="btn-primary text-sm py-1.5"
              onClick={() => openNewEvent()}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Event</span>
            </button>
          </div>
        </div>

        {/* ---- Month View ---- */}
        {viewMode === 'month' && (
          <>
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

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                onDragStart={(e) => setActiveDragId(String(e.active.id))}
                onDragEnd={handleMonthDragEnd}
                onDragCancel={() => setActiveDragId(null)}
              >
                {/* BAR_SLOT = 22px (20px bar + 2px gap), 3 slots = 66px reserved */}
                <div className="flex-1 flex flex-col gap-px bg-border rounded-2xl overflow-hidden border border-border">
                  {weekLayouts.map((layout, wi) => (
                    <div key={wi} className="flex-1 relative">
                      {/* Multi-day bars overlay
                          Bars are absolute children of the week-row's relative div.
                          top = cell-padding(6) + day-badge(28) + mb-1(4) + slot offset */}
                      <div className="absolute inset-0 z-10 pointer-events-none">
                        {layout.bars.map((bar) => {
                          const span = bar.endCol - bar.startCol + 1;
                          const leftPct = (bar.startCol / 7) * 100;
                          const widthPct = (span / 7) * 100;
                          const borderRadius = bar.continuesLeft && bar.continuesRight
                            ? '0'
                            : bar.continuesLeft
                            ? '0 4px 4px 0'
                            : bar.continuesRight
                            ? '4px 0 0 4px'
                            : '4px';
                          return (
                            <div
                              key={`${bar.event.id}-${wi}`}
                              className="absolute flex items-center text-white text-xs truncate cursor-pointer pointer-events-auto px-1.5"
                              style={{
                                left: `calc(${leftPct}% + ${bar.continuesLeft ? 0 : 2}px)`,
                                width: `calc(${widthPct}% - ${(bar.continuesLeft ? 0 : 2) + (bar.continuesRight ? 0 : 2)}px)`,
                                top: 38 + bar.slot * 22,
                                height: 20,
                                backgroundColor: bar.event.color,
                                opacity: bar.continuesLeft || bar.continuesRight ? 0.82 : 1,
                                borderRadius,
                              }}
                              onClick={(e) => { e.stopPropagation(); openEditEvent(bar.event); }}
                              title={bar.event.title}
                            >
                              {!bar.continuesLeft && !bar.event.allDay && (
                                <span className="mr-0.5 opacity-80">{formatTime(bar.event.startTime)}</span>
                              )}
                              {bar.event.title}
                            </div>
                          );
                        })}
                      </div>

                      {/* Day cells */}
                      <div className="grid grid-cols-7 gap-px bg-border h-full">
                        {layout.days.map(({ date, inMonth }, colIdx) => {
                          const isToday = isSameDay(date, today);
                          const isSelected = isSameDay(date, selectedDate);

                          // Max bar slot used in this col (for reserving space)
                          const maxBarSlot = layout.bars.reduce(
                            (mx, b) => b.startCol <= colIdx && colIdx <= b.endCol ? Math.max(mx, b.slot) : mx,
                            -1,
                          );
                          const hiddenBarCount = layout.hiddenBars.filter(
                            (b) => b.startCol <= colIdx && colIdx <= b.endCol,
                          ).length;
                          // Pill slots available = slots 0..2 not occupied by bars
                          const pillSlotsAvail = Math.max(0, 2 - maxBarSlot);
                          const dayPills = layout.singleDayEvents[colIdx] || [];
                          const visiblePills = dayPills.slice(0, pillSlotsAvail);
                          const pillOverflow = dayPills.length - visiblePills.length + hiddenBarCount;

                          return (
                            <DroppableDayCell
                              key={colIdx}
                              date={date}
                              className={`
                                bg-surface min-h-[100px] lg:min-h-[120px] p-1.5 cursor-pointer transition-colors relative
                                ${!inMonth ? 'opacity-40' : ''}
                                ${isSelected && !isToday ? 'bg-primary/5' : ''}
                                hover:bg-surface-elevated
                              `}
                              onClick={() => {
                                setSelectedDate(date);
                                if (!inMonth) {
                                  setViewDate(new Date(date.getFullYear(), date.getMonth(), 1));
                                }
                              }}
                              onDoubleClick={() => openNewEvent(date)}
                            >
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
                              {/* Space reserved for bar slots */}
                              <div style={{ height: 66 }} />
                              {/* Single-day event pills */}
                              <div className="space-y-0.5">
                                {visiblePills.map((ev) => (
                                  <DraggableMonthPill
                                    key={ev.id}
                                    event={ev}
                                    isDragging={activeDragId === ev.id}
                                    onClick={() => openEditEvent(ev)}
                                  />
                                ))}
                                {pillOverflow > 0 && (
                                  <div className="text-xs text-text-secondary font-medium px-1">
                                    +{pillOverflow} more
                                  </div>
                                )}
                              </div>
                            </DroppableDayCell>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <DragOverlay>
                  {activeDragId
                    ? (() => {
                        const ev = (data?.events || []).find(
                          (e) => e.id === activeDragId,
                        );
                        if (!ev) return null;
                        return (
                          <div
                            className="event-pill text-white shadow-lg opacity-90 pointer-events-none"
                            style={{ backgroundColor: ev.color }}
                          >
                            {ev.title}
                          </div>
                        );
                      })()
                    : null}
                </DragOverlay>
              </DndContext>
            )}
          </>
        )}

        {/* ---- Week View ---- */}
        {viewMode === 'week' && (
          <div className="flex-1 min-h-0 rounded-2xl border border-border overflow-hidden bg-surface">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <WeekView
                weekStart={weekStart}
                events={data?.events || []}
                onEventClick={openEditEvent}
                onSlotClick={(date, hour) => openNewEvent(date, hour)}
                onEventDrop={handleTimeGridDrop}
              />
            )}
          </div>
        )}

        {/* ---- Day View ---- */}
        {viewMode === 'day' && (
          <div className="flex-1 min-h-0 rounded-2xl border border-border overflow-hidden bg-surface">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <DayView
                date={viewDate}
                events={data?.events || []}
                onEventClick={openEditEvent}
                onSlotClick={(date, hour) => openNewEvent(date, hour)}
                onEventDrop={handleTimeGridDrop}
              />
            )}
          </div>
        )}
      </div>

      {/* Side panel — only shown in month view */}
      {viewMode === 'month' && (
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
                <p className="text-text-muted text-xs mt-1">
                  Tap + or double-click a day to add an event
                </p>
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
                  <p className="text-sm font-medium text-text-primary truncate">
                    {ev.title}
                    {(ev.rrule || ev.parentEventId) && (
                      <span className="ml-1 text-xs text-text-muted">↻</span>
                    )}
                  </p>
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
                    <p className="text-xs text-text-muted mt-1 line-clamp-2">
                      {ev.description}
                    </p>
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
                    onClick={() =>
                      deleteMutation.mutate({
                        id: ev.id,
                        scope: ev.isVirtual ? 'this' : undefined,
                      })
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Modal */}
      {isModalOpen && (
        <EventModal
          event={editingEvent}
          defaultDate={getModalDefaultDate()}
          onSave={(data) => handleSave(data)}
          onDelete={editingEvent ? () => handleDelete() : undefined}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEvent(null);
          }}
        />
      )}

      {/* Recurring edit dialog */}
      {recurringDialogEvent && (
        <RecurringEditDialog
          onThisOnly={() => {
            setEditingEvent(recurringDialogEvent);
            setRecurringDialogEvent(null);
            setIsModalOpen(true);
          }}
          onAllEvents={() => {
            // Open modal targeting the parent event id
            const parent = recurringDialogEvent.parentEventId
              ? ({ ...recurringDialogEvent, id: recurringDialogEvent.parentEventId, isVirtual: false, parentEventId: null } as CalendarEvent)
              : recurringDialogEvent;
            setEditingEvent(parent);
            setRecurringDialogEvent(null);
            setIsModalOpen(true);
          }}
          onCancel={() => setRecurringDialogEvent(null)}
        />
      )}

      {/* Sync modal */}
      {isSyncOpen && <SyncModal onClose={() => setIsSyncOpen(false)} />}
    </div>
  );
}
