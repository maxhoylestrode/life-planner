import { RRule } from 'rrule';

export interface BaseEvent {
  id: string;
  rrule: string;
  startTime: Date;
  endTime?: Date | null;
  [key: string]: unknown;
}

export interface VirtualOccurrence extends Omit<BaseEvent, 'rrule'> {
  id: string;
  startTime: Date;
  endTime: Date | null;
  recurrenceId: string;
  parentEventId: string;
  isVirtual: true;
  rrule: string;
}

export function expandRecurring(
  event: BaseEvent,
  windowStart: Date,
  windowEnd: Date,
): VirtualOccurrence[] {
  const duration =
    event.endTime ? event.endTime.getTime() - event.startTime.getTime() : 0;

  let rule: RRule;
  try {
    rule = RRule.fromString(event.rrule);
  } catch {
    return [];
  }

  // Ensure dtstart matches the event's actual startTime
  const adjustedRule = new RRule({
    ...rule.origOptions,
    dtstart: event.startTime,
  });

  const occurrences = adjustedRule.between(windowStart, windowEnd, true);

  return occurrences.map((date) => ({
    ...event,
    id: `${event.id}_${date.toISOString().slice(0, 10).replace(/-/g, '')}`,
    startTime: date,
    endTime: event.endTime ? new Date(date.getTime() + duration) : null,
    recurrenceId: date.toISOString(),
    parentEventId: event.id,
    isVirtual: true as const,
  }));
}

/** Returns true if the given event id looks like a virtual occurrence id */
export function isVirtualId(id: string): boolean {
  // Virtual IDs are formatted as "<parentId>_YYYYMMDD"
  return /_\d{8}$/.test(id);
}

/** Splits a virtual occurrence id into [parentId, dateString] */
export function splitVirtualId(id: string): [string, string] {
  const idx = id.lastIndexOf('_');
  return [id.slice(0, idx), id.slice(idx + 1)];
}
