import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/todos/stats - Get todo statistics
router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalCompleted, completedToday, totalPending] = await Promise.all([
      prisma.todo.count({
        where: { userId: req.userId, completed: true },
      }),
      prisma.todo.count({
        where: {
          userId: req.userId,
          completed: true,
          completedAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.todo.count({
        where: { userId: req.userId, completed: false },
      }),
    ]);

    const totalToday = await prisma.todo.count({
      where: {
        userId: req.userId,
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    res.json({
      stats: {
        totalCompleted,
        completedToday,
        totalPending,
        totalToday,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/todos/lists - Get all todo lists
router.get('/lists', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lists = await prisma.todoList.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { todos: true },
        },
      },
    });

    res.json({ lists });
  } catch (error) {
    console.error('Get lists error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/todos/lists - Create a new todo list
router.post('/lists', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'List name is required' });
      return;
    }

    const list = await prisma.todoList.create({
      data: {
        name,
        userId: req.userId!,
      },
    });

    res.status(201).json({ list });
  } catch (error) {
    console.error('Create list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/todos/lists/:id - Delete a todo list
router.delete('/lists/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingList = await prisma.todoList.findFirst({
      where: { id, userId: req.userId },
    });

    if (!existingList) {
      res.status(404).json({ error: 'List not found' });
      return;
    }

    await prisma.todoList.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    console.error('Delete list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/todos?listId=xxx - Get todos (optionally filtered by list)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { listId } = req.query;

    const todos = await prisma.todo.findMany({
      where: {
        userId: req.userId,
        ...(listId === 'null' || listId === 'inbox'
          ? { listId: null }
          : listId
            ? { listId: String(listId) }
            : {}),
      },
      orderBy: [{ completed: 'asc' }, { createdAt: 'desc' }],
      include: {
        list: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({ todos });
  } catch (error) {
    console.error('Get todos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/todos - Create a new todo
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { text, priority, listId } = req.body;

    if (!text) {
      res.status(400).json({ error: 'Todo text is required' });
      return;
    }

    const validPriorities = ['low', 'medium', 'high'];
    if (priority && !validPriorities.includes(priority)) {
      res.status(400).json({ error: 'Invalid priority. Must be low, medium, or high' });
      return;
    }

    if (listId) {
      const list = await prisma.todoList.findFirst({
        where: { id: listId, userId: req.userId },
      });
      if (!list) {
        res.status(404).json({ error: 'List not found' });
        return;
      }
    }

    const todo = await prisma.todo.create({
      data: {
        text,
        priority: priority || 'medium',
        listId: listId || null,
        userId: req.userId!,
      },
      include: {
        list: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json({ todo });
  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/todos/:id - Update a todo (toggle complete, edit text, priority)
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { text, completed, priority, listId } = req.body;

    const existingTodo = await prisma.todo.findFirst({
      where: { id, userId: req.userId },
    });

    if (!existingTodo) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    if (priority) {
      const validPriorities = ['low', 'medium', 'high'];
      if (!validPriorities.includes(priority)) {
        res.status(400).json({ error: 'Invalid priority' });
        return;
      }
    }

    let completedAt = existingTodo.completedAt;
    if (completed !== undefined) {
      if (completed && !existingTodo.completed) {
        completedAt = new Date();
      } else if (!completed) {
        completedAt = null;
      }
    }

    const todo = await prisma.todo.update({
      where: { id },
      data: {
        ...(text !== undefined && { text }),
        ...(completed !== undefined && { completed, completedAt }),
        ...(priority !== undefined && { priority }),
        ...(listId !== undefined && { listId: listId || null }),
      },
      include: {
        list: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({ todo });
  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/todos/:id - Delete a todo
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingTodo = await prisma.todo.findFirst({
      where: { id, userId: req.userId },
    });

    if (!existingTodo) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    await prisma.todo.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
