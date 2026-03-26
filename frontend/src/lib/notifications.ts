import { openDB } from 'idb';
import type { CalendarEvent } from '../components/calendar/EventModal';

const DB_NAME = 'lifeplanner-reminders';
const STORE = 'reminders';

interface ReminderRecord {
  id: string;
  eventId: string;
  title: string;
  fireAt: number; // unix ms
  fired: boolean;
}

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('fireAt', 'fireAt');
        store.createIndex('fired', 'fired');
      }
    },
  });
}

/**
 * Persist a reminder for the given event and schedule a local browser notification.
 * offsetMinutes: how many minutes BEFORE the event to fire (0 = at event time).
 */
export async function scheduleEventReminder(
  event: CalendarEvent,
  offsetMinutes: number,
): Promise<void> {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  const fireAt = new Date(event.startTime).getTime() - offsetMinutes * 60 * 1000;
  const now = Date.now();
  if (fireAt < now) return; // past, skip

  const id = `${event.id}_${offsetMinutes}`;

  const db = await getDB();
  await db.put(STORE, {
    id,
    eventId: event.id,
    title: event.title,
    fireAt,
    fired: false,
  } satisfies ReminderRecord);

  // Schedule a setTimeout-based notification for this session
  const delay = fireAt - now;
  if (delay < 7 * 24 * 60 * 60 * 1000) {
    // Only schedule if within 7 days (setTimeout is unreliable beyond that)
    setTimeout(async () => {
      if (Notification.permission !== 'granted') return;
      const db2 = await getDB();
      const rec = await db2.get(STORE, id) as ReminderRecord | undefined;
      if (!rec || rec.fired) return;
      new Notification(rec.title, {
        body: offsetMinutes === 0
          ? 'Starting now'
          : `Starting in ${offsetMinutes < 60 ? `${offsetMinutes} minutes` : `${offsetMinutes / 60} hour${offsetMinutes / 60 !== 1 ? 's' : ''}`}`,
        icon: '/icon-192.png',
        tag: id,
      });
      await db2.put(STORE, { ...rec, fired: true });
    }, delay);
  }
}

/**
 * On app load: check the DB for any unfired reminders and reschedule them.
 * Call this once from main.tsx or App.tsx.
 */
export async function reschedulePersistedReminders(): Promise<void> {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  const db = await getDB();
  const all = (await db.getAll(STORE)) as ReminderRecord[];
  const now = Date.now();

  for (const rec of all) {
    if (rec.fired) continue;
    const delay = rec.fireAt - now;
    if (delay < 0) {
      // Missed — mark as fired
      await db.put(STORE, { ...rec, fired: true });
      continue;
    }
    if (delay < 7 * 24 * 60 * 60 * 1000) {
      setTimeout(async () => {
        if (Notification.permission !== 'granted') return;
        const db2 = await getDB();
        const latest = await db2.get(STORE, rec.id) as ReminderRecord | undefined;
        if (!latest || latest.fired) return;
        new Notification(latest.title, {
          body: 'Event reminder',
          icon: '/icon-192.png',
          tag: rec.id,
        });
        await db2.put(STORE, { ...latest, fired: true });
      }, delay);
    }
  }
}
