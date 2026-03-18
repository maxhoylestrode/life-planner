import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/calendar?month=3&year=2024 - Get events for a month
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query;

    let startDate: Date;
    let endDate: Date;

    if (month && year) {
      const m = parseInt(String(month), 10);
      const y = parseInt(String(year), 10);

      if (isNaN(m) || isNaN(y) || m < 1 || m > 12) {
        res.status(400).json({ error: 'Invalid month or year' });
        return;
      }

      startDate = new Date(y, m - 1, 1);
      endDate = new Date(y, m, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const events = await prisma.event.findMany({
      where: {
        userId: req.userId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { startTime: 'asc' },
    });

    res.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/calendar - Create a new event
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, startTime, endTime, allDay, color } = req.body;

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
        userId: req.userId!,
      },
    });

    res.status(201).json({ event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/calendar/:id - Update an event
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, startTime, endTime, allDay, color } = req.body;

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
      },
    });

    res.json({ event });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/calendar/:id - Delete an event
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

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
