import { useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CalendarEvent } from './EventModal';

export const HOUR_HEIGHT = 64; // px per hour
const SNAP_MINUTES = 15;

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ---- Event block geometry ----

interface EventGeom {
  top: number;
  height: number;
  col: number;
  totalCols: number;
}

function getMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function computeGeometry(events: CalendarEvent[]): Map<string, EventGeom> {
  const result = new Map<string, EventGeom>();
  const sorted = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  type Group = CalendarEvent[];
  const groups: Group[] = [];

  for (const ev of sorted) {
    const evStart = new Date(ev.startTime).getTime();
    const evEnd = ev.endTime
      ? new Date(ev.endTime).getTime()
      : evStart + 30 * 60 * 1000;

    let placed = false;
    for (const group of groups) {
      const groupEnd = Math.max(
        ...group.map((g) =>
          g.endTime
            ? new Date(g.endTime).getTime()
            : new Date(g.startTime).getTime() + 30 * 60 * 1000,
        ),
      );
      if (evStart < groupEnd) {
        group.push(ev);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([ev]);
  }

  for (const group of groups) {
    const totalCols = group.length;
    group.forEach((ev, col) => {
      const startMin = getMinutes(ev.startTime);
      const endMin = ev.endTime ? getMinutes(ev.endTime) : startMin + 30;
      const duration = Math.max(endMin - startMin, 15);
      result.set(ev.id, {
        top: (startMin / 60) * HOUR_HEIGHT,
        height: Math.max((duration / 60) * HOUR_HEIGHT, 20),
        col,
        totalCols,
      });
    });
  }

  return result;
}

// ---- DraggableEvent ----

function DraggableEventBlock({
  event,
  geom,
  colWidth,
  onClick,
  isDragging,
}: {
  event: CalendarEvent;
  geom: EventGeom;
  colWidth: number;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: event.id,
    data: { event },
  });

  const style: React.CSSProperties = {
    position: 'absolute',
    top: geom.top,
    height: geom.height,
    left: `${(geom.col / geom.totalCols) * colWidth}px`,
    width: `${(1 / geom.totalCols) * colWidth - 2}px`,
    backgroundColor: event.color,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 0 : 10,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-lg px-1.5 py-0.5 text-white text-xs font-medium overflow-hidden cursor-grab active:cursor-grabbing select-none shadow-sm"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={event.title}
      role="button"
      aria-label={event.title}
    >
      <div className="truncate font-semibold">{event.title}</div>
      {geom.height > 30 && (
        <div className="truncate opacity-80">{formatTime(event.startTime)}</div>
      )}
    </div>
  );
}

// ---- TimeGrid ----

export interface TimeGridProps {
  days: Date[];
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
  onEventDrop?: (event: CalendarEvent, newStart: Date) => void;
}

export default function TimeGrid({
  days,
  events,
  onEventClick,
  onSlotClick,
  onEventDrop,
}: TimeGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const allDayEvents = events.filter((e) => e.allDay);
  const timedEvents = events.filter((e) => !e.allDay);
  const eventsByDay = days.map((day) =>
    timedEvents.filter((ev) => isSameDay(new Date(ev.startTime), day)),
  );
  const allDayByDay = days.map((day) =>
    allDayEvents.filter((ev) => isSameDay(new Date(ev.startTime), day)),
  );

  function handleDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    if (!onEventDrop) return;
    const draggedEvent = timedEvents.find((ev) => ev.id === e.active.id);
    if (!draggedEvent) return;

    const deltaY = e.delta.y;
    const deltaMinutes =
      Math.round(((deltaY / HOUR_HEIGHT) * 60) / SNAP_MINUTES) * SNAP_MINUTES;

    const colWidth = gridRef.current
      ? gridRef.current.clientWidth / days.length
      : 100;
    const deltaCols = Math.round(e.delta.x / colWidth);

    const newStart = new Date(draggedEvent.startTime);
    newStart.setDate(newStart.getDate() + deltaCols);
    newStart.setMinutes(newStart.getMinutes() + deltaMinutes);

    onEventDrop(draggedEvent, newStart);
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const today = new Date();

  const MIN_COL_WIDTH = 90;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveDragId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragId(null)}
    >
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* Single scroll container — handles both axes */}
        <div
          className="flex-1 overflow-auto min-h-0"
          style={{ touchAction: 'pan-x pan-y' }}
        >
          {/* min-width forces horizontal scroll on narrow viewports */}
          <div style={{ minWidth: `${days.length * MIN_COL_WIDTH + 56}px` }}>

            {/* Day headers — sticky top */}
            <div className="sticky top-0 z-20 flex border-b border-border bg-surface">
              {/* Corner spacer — sticky left so it anchors at top-left */}
              <div className="w-14 flex-shrink-0 sticky left-0 z-30 bg-surface" />
              {days.map((day, i) => {
                const isToday = isSameDay(day, today);
                return (
                  <div
                    key={i}
                    className="flex-1 text-center py-2 border-l border-border"
                    style={{ minWidth: MIN_COL_WIDTH }}
                  >
                    <p className="text-xs text-text-secondary uppercase tracking-wide">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </p>
                    <p
                      className={`text-sm font-bold w-8 h-8 mx-auto flex items-center justify-center rounded-full mt-0.5 ${
                        isToday ? 'bg-primary text-white' : 'text-text-primary'
                      }`}
                    >
                      {day.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* All-day banner */}
            {allDayEvents.length > 0 && (
              <div className="flex border-b border-border bg-surface">
                <div className="w-14 flex-shrink-0 sticky left-0 z-10 bg-surface flex items-center justify-end pr-2 py-1">
                  <span className="text-xs text-text-secondary">all-day</span>
                </div>
                {days.map((_, dayIdx) => (
                  <div
                    key={dayIdx}
                    className="flex-1 border-l border-border py-1 px-0.5 min-h-[32px]"
                    style={{ minWidth: MIN_COL_WIDTH }}
                  >
                    {allDayByDay[dayIdx].map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded px-1.5 py-0.5 text-white text-xs font-medium mb-0.5 truncate cursor-pointer hover:opacity-90"
                        style={{ backgroundColor: ev.color }}
                        onClick={() => onEventClick(ev)}
                      >
                        {ev.title}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Time grid body */}
            <div className="flex" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
              {/* Time axis — sticky left */}
              <div
                className="w-14 flex-shrink-0 sticky left-0 z-10 bg-surface relative border-r border-border/30"
                style={{ height: `${24 * HOUR_HEIGHT}px` }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute right-2 text-xs text-text-muted whitespace-nowrap select-none"
                    style={{ top: h * HOUR_HEIGHT - 8 }}
                  >
                    {h > 0 ? formatHour(h) : ''}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              <div ref={gridRef} className="flex flex-1">
                {days.map((day, dayIdx) => {
                  const dayEvents = eventsByDay[dayIdx];
                  const geomMap = computeGeometry(dayEvents);
                  const isToday = isSameDay(day, today);
                  const nowMinutes = isToday
                    ? today.getHours() * 60 + today.getMinutes()
                    : -1;

                  return (
                    <div
                      key={dayIdx}
                      className="flex-1 relative border-l border-border"
                      style={{ height: `${24 * HOUR_HEIGHT}px`, minWidth: MIN_COL_WIDTH }}
                    >
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-t border-border/50 cursor-pointer hover:bg-primary/5 transition-colors"
                          style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                          onClick={() => onSlotClick(day, h)}
                        />
                      ))}

                      {/* Current time indicator */}
                      {nowMinutes >= 0 && (
                        <div
                          className="absolute left-0 right-0 z-20 pointer-events-none"
                          style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                        >
                          <div className="flex items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 -ml-1.5" />
                            <div className="flex-1 h-0.5 bg-primary" />
                          </div>
                        </div>
                      )}

                      {/* Events */}
                      {dayEvents.map((ev) => {
                        const geom = geomMap.get(ev.id);
                        if (!geom) return null;
                        // scrollWidth gives the actual rendered column width even when horizontally scrolled
                        const colWidth = gridRef.current
                          ? gridRef.current.scrollWidth / days.length
                          : MIN_COL_WIDTH;
                        return (
                          <DraggableEventBlock
                            key={ev.id}
                            event={ev}
                            geom={geom}
                            colWidth={colWidth}
                            onClick={() => onEventClick(ev)}
                            isDragging={activeDragId === ev.id}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Drag overlay ghost */}
      <DragOverlay>
        {activeDragId
          ? (() => {
              const ev = timedEvents.find((e) => e.id === activeDragId);
              if (!ev) return null;
              return (
                <div
                  className="rounded-lg px-2 py-1 text-white text-xs font-semibold shadow-lg opacity-90 pointer-events-none"
                  style={{ backgroundColor: ev.color, width: 120 }}
                >
                  {ev.title}
                </div>
              );
            })()
          : null}
      </DragOverlay>
    </DndContext>
  );
}
