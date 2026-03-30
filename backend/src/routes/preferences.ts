import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const COLOR_FIELDS = [
  'colorBackground', 'colorPrimary', 'colorPrimaryDark', 'colorSecondary',
  'colorSurface', 'colorSurfaceElev', 'colorTextPrimary', 'colorTextSecondary',
  'colorTextMuted', 'colorBorder', 'colorSuccess', 'colorAccent',
] as const;

// GET /api/preferences — upsert-on-first-visit, returns full preferences object
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const prefs = await prisma.userPreferences.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId! },
      update: {},
    });
    res.json({ preferences: prefs });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/preferences — partial update, validates hex colours
router.put('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    // Colour fields — validate hex
    for (const field of COLOR_FIELDS) {
      if (field in body) {
        const val = String(body[field]);
        if (!HEX_RE.test(val)) {
          res.status(400).json({ error: `Invalid hex colour for ${field}: ${val}` });
          return;
        }
        data[field] = val;
      }
    }

    // String enum fields
    if ('themeName' in body) data.themeName = String(body.themeName);
    if ('fontFamily' in body) data.fontFamily = String(body.fontFamily);
    if ('fontSize' in body) {
      if (!['sm', 'md', 'lg'].includes(String(body.fontSize))) {
        res.status(400).json({ error: 'fontSize must be sm, md, or lg' });
        return;
      }
      data.fontSize = String(body.fontSize);
    }
    if ('density' in body) {
      if (!['compact', 'comfortable', 'spacious'].includes(String(body.density))) {
        res.status(400).json({ error: 'density must be compact, comfortable, or spacious' });
        return;
      }
      data.density = String(body.density);
    }
    if ('defaultCalendarView' in body) {
      if (!['month', 'week', 'day'].includes(String(body.defaultCalendarView))) {
        res.status(400).json({ error: 'defaultCalendarView must be month, week, or day' });
        return;
      }
      data.defaultCalendarView = String(body.defaultCalendarView);
    }

    // Integer fields
    if ('coffeeWorkMins' in body) {
      const v = parseInt(String(body.coffeeWorkMins), 10);
      if (isNaN(v) || v < 1 || v > 180) {
        res.status(400).json({ error: 'coffeeWorkMins must be 1–180' });
        return;
      }
      data.coffeeWorkMins = v;
    }
    if ('coffeeBreakMins' in body) {
      const v = parseInt(String(body.coffeeBreakMins), 10);
      if (isNaN(v) || v < 1 || v > 60) {
        res.status(400).json({ error: 'coffeeBreakMins must be 1–60' });
        return;
      }
      data.coffeeBreakMins = v;
    }

    // Dashboard settings
    if ('weatherCity' in body) data.weatherCity = String(body.weatherCity).slice(0, 100);
    if ('uptimeKumaUrl' in body) data.uptimeKumaUrl = String(body.uptimeKumaUrl).slice(0, 200);
    if ('uptimeKumaSlug' in body) data.uptimeKumaSlug = String(body.uptimeKumaSlug).slice(0, 100);
    if ('weatherUnit' in body) {
      if (!['metric', 'imperial'].includes(String(body.weatherUnit))) {
        res.status(400).json({ error: 'weatherUnit must be metric or imperial' });
        return;
      }
      data.weatherUnit = String(body.weatherUnit);
    }

    const prefs = await prisma.userPreferences.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, ...data },
      update: data,
    });

    res.json({ preferences: prefs });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
