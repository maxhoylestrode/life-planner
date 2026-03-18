import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/notes - Get all notes for the authenticated user
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search } = req.query;

    const notes = await prisma.note.findMany({
      where: {
        userId: req.userId,
        ...(search
          ? {
              OR: [
                { title: { contains: String(search), mode: 'insensitive' } },
                { content: { contains: String(search), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ notes });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notes - Create a new note
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, color } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const note = await prisma.note.create({
      data: {
        title,
        content: content || '',
        color: color || '#FFF3E8',
        userId: req.userId!,
      },
    });

    res.status(201).json({ note });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notes/:id - Update a note
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, content, color } = req.body;

    const existingNote = await prisma.note.findFirst({
      where: { id, userId: req.userId },
    });

    if (!existingNote) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const note = await prisma.note.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(color !== undefined && { color }),
      },
    });

    res.json({ note });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/notes/:id - Delete a note
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingNote = await prisma.note.findFirst({
      where: { id, userId: req.userId },
    });

    if (!existingNote) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    await prisma.note.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
