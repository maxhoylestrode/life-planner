import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/uptime/heartbeat?url=<kumaBase>&slug=<slug>
router.get('/heartbeat', async (req: AuthRequest, res: Response): Promise<void> => {
  const { url, slug } = req.query as { url?: string; slug?: string };

  if (!url || !slug) {
    res.status(400).json({ error: 'url and slug are required' });
    return;
  }

  try {
    const base = String(url).replace(/\/+$/, '');
    const [pageRes, heartbeatRes] = await Promise.all([
      fetch(`${base}/api/status-page/${slug}`),
      fetch(`${base}/api/status-page/heartbeat/${slug}`),
    ]);

    if (!pageRes.ok || !heartbeatRes.ok) {
      res.status(502).json({ error: 'Uptime Kuma returned an error' });
      return;
    }

    const [pageData, heartbeatData] = await Promise.all([
      pageRes.json(),
      heartbeatRes.json(),
    ]);

    res.json({ pageData, heartbeatData });
  } catch (err) {
    console.error('Uptime Kuma proxy error:', err);
    res.status(502).json({ error: 'Could not reach Uptime Kuma' });
  }
});

export default router;
