import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/coffee - get all sessions for the current user
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await prisma.coffeeSession.findMany({
      where: { userId: req.userId },
      orderBy: { completedAt: 'desc' },
    });
    res.json({ sessions });
  } catch (error) {
    console.error('Get coffee sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/coffee - save a completed session
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { label, durationMins } = req.body;

    if (!label || typeof label !== 'string' || !label.trim()) {
      res.status(400).json({ error: 'label is required' });
      return;
    }

    const session = await prisma.coffeeSession.create({
      data: {
        label: label.trim(),
        durationMins: typeof durationMins === 'number' ? durationMins : 30,
        userId: req.userId!,
      },
    });

    res.status(201).json({ session });
  } catch (error) {
    console.error('Create coffee session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/coffee/:id - delete a session
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.coffeeSession.findFirst({
      where: { id, userId: req.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await prisma.coffeeSession.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete coffee session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
