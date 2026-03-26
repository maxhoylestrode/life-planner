import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import ical from 'ical-generator';
import { v4 as uuidv4 } from 'uuid';
import { expandRecurring, BaseEvent } from '../lib/rruleHelper';

const router = Router();

// GET /api/ical/:userId/calendar.ics?token=<icalToken>
// Public (token-protected). Returns iCal feed for the user's events.
router.get('/:userId/calendar.ics', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { token } = req.query;

    if (!token) {
      res.status(401).send('Unauthorized');
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.icalToken !== String(token)) {
      res.status(401).send('Unauthorized');
      return;
    }

    // Fetch all master events (no parentEventId)
    const events = await prisma.event.findMany({
      where: { userId, parentEventId: null },
    });

    // Fetch all child overrides
    const childOverrides = await prisma.event.findMany({
      where: { userId, parentEventId: { not: null } },
    });
    const overridesByRecurrenceId = new Map(
      childOverrides.map((c) => [c.recurrenceId, c]),
    );

    const calendar = ical({ name: `LifePlanner — ${user.username}` });

    const windowStart = new Date();
    windowStart.setFullYear(windowStart.getFullYear() - 1);
    const windowEnd = new Date();
    windowEnd.setFullYear(windowEnd.getFullYear() + 2);

    for (const event of events) {
      // Ensure stable icalUid
      let uid = event.icalUid;
      if (!uid) {
        uid = uuidv4();
        await prisma.event.update({ where: { id: event.id }, data: { icalUid: uid } });
      }

      if (event.rrule && event.rrule !== 'DELETED') {
        const occurrences = expandRecurring(event as unknown as BaseEvent, windowStart, windowEnd);
        for (const occ of occurrences) {
          // Skip deleted or overridden occurrences
          const override = overridesByRecurrenceId.get(occ.recurrenceId);
          if (override?.rrule === 'DELETED') continue;

          const occEvent = override ?? occ;
          calendar.createEvent({
            id: `${uid}_${occ.recurrenceId}`,
            start: occEvent.startTime,
            end: occEvent.endTime ?? occEvent.startTime,
            allDay: event.allDay,
            summary: occEvent.title as string,
            description: (occEvent.description as string | null) ?? '',
          });
        }
      } else if (!event.rrule) {
        calendar.createEvent({
          id: uid,
          start: event.startTime,
          end: event.endTime ?? event.startTime,
          allDay: event.allDay,
          summary: event.title,
          description: event.description ?? '',
        });
      }
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="calendar.ics"');
    res.send(calendar.toString());
  } catch (error) {
    console.error('iCal feed error:', error);
    res.status(500).send('Error generating calendar');
  }
});

export default router;
