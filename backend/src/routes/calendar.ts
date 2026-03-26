import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { expandRecurring, isVirtualId, splitVirtualId, BaseEvent } from '../lib/rruleHelper';

const router = Router();

router.use(authenticate);

// GET /api/calendar?month=3&year=2024   OR   ?start=ISO&end=ISO
// Returns stored + virtual recurring occurrences within the window
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year, start, end } = req.query;

    let windowStart: Date;
    let windowEnd: Date;

    if (start && end) {
      windowStart = new Date(String(start));
      windowEnd = new Date(String(end));
      if (isNaN(windowStart.getTime()) || isNaN(windowEnd.getTime())) {
        res.status(400).json({ error: 'Invalid start or end date' });
        return;
      }
    } else if (month && year) {
      const m = parseInt(String(month), 10);
      const y = parseInt(String(year), 10);
      if (isNaN(m) || isNaN(y) || m < 1 || m > 12) {
        res.status(400).json({ error: 'Invalid month or year' });
        return;
      }
      windowStart = new Date(y, m - 1, 1);
      windowEnd = new Date(y, m, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
      windowEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Fetch master recurring events (no parentEventId) that have rrule
    const recurringMasters = await prisma.event.findMany({
      where: {
        userId: req.userId,
        rrule: { not: null },
        parentEventId: null,
      },
    });

    // Fetch child override events within window
    const childOverrides = await prisma.event.findMany({
      where: {
        userId: req.userId,
        parentEventId: { not: null },
        startTime: { gte: windowStart, lte: windowEnd },
      },
    });
    // Map recurrenceId → child event (includes DELETED sentinels)
    const overridesByRecurrenceId = new Map(
      childOverrides.map((c) => [c.recurrenceId, c]),
    );
    // Visible overrides (not deleted sentinels)
    const visibleOverrides = childOverrides.filter((c) => c.rrule !== 'DELETED');

    // Fetch regular (non-recurring) events within window
    const regularEvents = await prisma.event.findMany({
      where: {
        userId: req.userId,
        rrule: null,
        parentEventId: null,
        startTime: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { startTime: 'asc' },
    });

    // Expand recurring events, skipping occurrences that have child overrides
    const virtualEvents: unknown[] = [];
    for (const master of recurringMasters) {
      const occurrences = expandRecurring(master as BaseEvent, windowStart, windowEnd);
      for (const occ of occurrences) {
        // Skip if there's a child override for this occurrence
        if (overridesByRecurrenceId.has(occ.recurrenceId)) {
          // The child override is already in childOverrides array
          continue;
        }
        virtualEvents.push(occ);
      }
    }

    // Combine and sort
    const allEvents = [
      ...regularEvents,
      ...visibleOverrides,
      ...virtualEvents,
    ].sort(
      (a, b) =>
        new Date((a as { startTime: Date }).startTime).getTime() -
        new Date((b as { startTime: Date }).startTime).getTime(),
    );

    res.json({ events: allEvents });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/calendar - Create a new event
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      startTime,
      endTime,
      allDay,
      color,
      rrule,
      reminderMinutes,
    } = req.body;

    if (!title || !startTime) {
      res.status(400).json({ error: 'Title and start time are required' });
      return;
    }

    const event = await prisma.event.create({
      data: {
        title,
        description: description || null,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        allDay: allDay ?? false,
        color: color || '#E8825A',
        rrule: rrule || null,
        reminderMinutes: reminderMinutes !== undefined ? Number(reminderMinutes) : null,
        userId: req.userId!,
      },
    });

    res.status(201).json({ event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/calendar/:id - Update an event (or create a child override for a virtual occurrence)
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      startTime,
      endTime,
      allDay,
      color,
      rrule,
      reminderMinutes,
    } = req.body;

    // If this is a virtual occurrence id, create a child override instead
    if (isVirtualId(id)) {
      const [parentId, dateStr] = splitVirtualId(id);

      const parentEvent = await prisma.event.findFirst({
        where: { id: parentId, userId: req.userId },
      });

      if (!parentEvent) {
        res.status(404).json({ error: 'Parent event not found' });
        return;
      }

      // Build the recurrenceId from the date string (YYYYMMDD → ISO date)
      const y = dateStr.slice(0, 4);
      const m = dateStr.slice(4, 6);
      const d = dateStr.slice(6, 8);
      const recurrenceId = new Date(
        `${y}-${m}-${d}T${parentEvent.startTime.toISOString().slice(11)}`,
      ).toISOString();

      // Check for existing override
      const existingOverride = await prisma.event.findFirst({
        where: { parentEventId: parentId, recurrenceId, userId: req.userId },
      });

      if (existingOverride) {
        const updated = await prisma.event.update({
          where: { id: existingOverride.id },
          data: {
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description }),
            ...(startTime !== undefined && { startTime: new Date(startTime) }),
            ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
            ...(allDay !== undefined && { allDay }),
            ...(color !== undefined && { color }),
            ...(reminderMinutes !== undefined && { reminderMinutes: reminderMinutes !== null ? Number(reminderMinutes) : null }),
          },
        });
        res.json({ event: updated });
        return;
      }

      const override = await prisma.event.create({
        data: {
          title: title ?? parentEvent.title,
          description: description !== undefined ? description : parentEvent.description,
          startTime: startTime ? new Date(startTime) : parentEvent.startTime,
          endTime: endTime !== undefined ? (endTime ? new Date(endTime) : null) : parentEvent.endTime,
          allDay: allDay !== undefined ? allDay : parentEvent.allDay,
          color: color ?? parentEvent.color,
          recurrenceId,
          parentEventId: parentId,
          reminderMinutes: reminderMinutes !== undefined ? Number(reminderMinutes) : parentEvent.reminderMinutes,
          userId: req.userId!,
        },
      });

      res.json({ event: override });
      return;
    }

    const existingEvent = await prisma.event.findFirst({
      where: { id, userId: req.userId },
    });

    if (!existingEvent) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(startTime !== undefined && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        ...(allDay !== undefined && { allDay }),
        ...(color !== undefined && { color }),
        ...(rrule !== undefined && { rrule: rrule || null }),
        ...(reminderMinutes !== undefined && { reminderMinutes: reminderMinutes !== null ? Number(reminderMinutes) : null }),
      },
    });

    res.json({ event });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/calendar/:id - Delete an event (or all occurrences of a recurring series)
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { scope } = req.query; // 'this' | 'all' | undefined

    // Virtual occurrence id → add a deleted child marker or delete parent
    if (isVirtualId(id)) {
      const [parentId, dateStr] = splitVirtualId(id);
      const parentEvent = await prisma.event.findFirst({
        where: { id: parentId, userId: req.userId },
      });
      if (!parentEvent) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      if (scope === 'all') {
        await prisma.event.delete({ where: { id: parentId } });
      } else {
        // Create a "deleted" override for this specific occurrence
        const y = dateStr.slice(0, 4);
        const m = dateStr.slice(4, 6);
        const d = dateStr.slice(6, 8);
        const recurrenceId = new Date(
          `${y}-${m}-${d}T${parentEvent.startTime.toISOString().slice(11)}`,
        ).toISOString();

        // Create or update a child override with rrule='DELETED' to suppress this occurrence
        const existing = await prisma.event.findFirst({
          where: { parentEventId: parentId, recurrenceId, userId: req.userId },
        });
        if (existing) {
          await prisma.event.update({ where: { id: existing.id }, data: { rrule: 'DELETED' } });
        } else {
          await prisma.event.create({
            data: {
              title: parentEvent.title,
              description: parentEvent.description,
              startTime: new Date(`${y}-${m}-${d}T${parentEvent.startTime.toISOString().slice(11)}`),
              endTime: null,
              allDay: parentEvent.allDay,
              color: parentEvent.color,
              recurrenceId,
              parentEventId: parentId,
              rrule: 'DELETED',
              userId: req.userId!,
            },
          });
        }
      }
      res.status(204).send();
      return;
    }

    const existingEvent = await prisma.event.findFirst({
      where: { id, userId: req.userId },
    });

    if (!existingEvent) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    await prisma.event.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
