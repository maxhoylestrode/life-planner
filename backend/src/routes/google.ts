import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/google/callback',
  );
}

// GET /api/google/auth — redirect to Google consent screen
// Attach JWT token as a state param so we can identify the user in the callback
router.get('/auth', authenticate, (req: AuthRequest, res: Response) => {
  const oauth2Client = getOAuthClient();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
    state: req.userId,
  });
  res.redirect(authUrl);
});

// GET /api/google/callback — exchange code for tokens, store on user
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      res.status(400).send('Missing code or state');
      return;
    }

    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(String(code));

    if (!tokens.access_token) {
      res.status(400).send('No access token received');
      return;
    }

    await prisma.user.update({
      where: { id: String(userId) },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token ?? undefined,
        googleTokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : undefined,
      },
    });

    const frontendUrl =
      process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/calendar?synced=true`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.status(500).send('OAuth error');
  }
});

// GET /api/google/status — returns whether the user has connected Google Calendar
router.get('/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        googleAccessToken: true,
        googleLastSync: true,
      },
    });
    res.json({
      connected: !!user?.googleAccessToken,
      lastSync: user?.googleLastSync ?? null,
    });
  } catch (error) {
    console.error('Google status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/google/sync — bidirectional sync with Google Calendar
router.post('/sync', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user?.googleAccessToken) {
      res.status(400).json({ error: 'Google Calendar not connected' });
      return;
    }

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken ?? undefined,
      expiry_date: user.googleTokenExpiry?.getTime(),
    });

    // Auto-refresh tokens if needed
    oauth2Client.on('tokens', async (tokens) => {
      await prisma.user.update({
        where: { id: req.userId },
        data: {
          ...(tokens.access_token && { googleAccessToken: tokens.access_token }),
          ...(tokens.refresh_token && { googleRefreshToken: tokens.refresh_token }),
          ...(tokens.expiry_date && { googleTokenExpiry: new Date(tokens.expiry_date) }),
        },
      });
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Determine which Google calendar to use (default: primary)
    const calendarId = user.googleCalendarId || 'primary';

    // Import: fetch Google events for the next 60 days
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const googleEventsResp = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 500,
    });

    const googleEvents = googleEventsResp.data.items || [];
    let imported = 0;

    for (const gev of googleEvents) {
      if (!gev.id || !gev.summary) continue;
      const googleId = gev.id;
      const startTime = gev.start?.dateTime ?? gev.start?.date;
      const endTime = gev.end?.dateTime ?? gev.end?.date;
      if (!startTime) continue;

      // Upsert by icalUid (we use the Google event id as the icalUid)
      const existing = await prisma.event.findFirst({
        where: { userId: req.userId!, icalUid: googleId },
      });

      if (existing) {
        await prisma.event.update({
          where: { id: existing.id },
          data: {
            title: gev.summary,
            description: gev.description ?? null,
            startTime: new Date(startTime),
            endTime: endTime ? new Date(endTime) : null,
            allDay: !gev.start?.dateTime,
          },
        });
      } else {
        await prisma.event.create({
          data: {
            title: gev.summary,
            description: gev.description ?? null,
            startTime: new Date(startTime),
            endTime: endTime ? new Date(endTime) : null,
            allDay: !gev.start?.dateTime,
            color: '#5B9BD5',
            icalUid: googleId,
            userId: req.userId!,
          },
        });
        imported++;
      }
    }

    // Export: push local events that don't have a Google icalUid
    const localEvents = await prisma.event.findMany({
      where: {
        userId: req.userId,
        icalUid: null,
        parentEventId: null,
        startTime: { gte: new Date() },
      },
    });

    let exported = 0;
    for (const ev of localEvents) {
      try {
        const uid = uuidv4();
        const created = await calendar.events.insert({
          calendarId,
          requestBody: {
            summary: ev.title,
            description: ev.description ?? undefined,
            start: ev.allDay
              ? { date: ev.startTime.toISOString().slice(0, 10) }
              : { dateTime: ev.startTime.toISOString() },
            end: ev.endTime
              ? ev.allDay
                ? { date: ev.endTime.toISOString().slice(0, 10) }
                : { dateTime: ev.endTime.toISOString() }
              : ev.allDay
                ? { date: ev.startTime.toISOString().slice(0, 10) }
                : { dateTime: ev.startTime.toISOString() },
          },
        });

        if (created.data.id) {
          await prisma.event.update({
            where: { id: ev.id },
            data: { icalUid: created.data.id || uid },
          });
          exported++;
        }
      } catch (err) {
        console.warn(`Failed to export event ${ev.id}:`, err);
      }
    }

    // Record last sync time
    await prisma.user.update({
      where: { id: req.userId },
      data: { googleLastSync: new Date() },
    });

    res.json({ imported, exported });
  } catch (error) {
    console.error('Google sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// DELETE /api/google/disconnect — revoke and clear Google tokens
router.delete('/disconnect', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });

    if (user?.googleAccessToken) {
      try {
        const oauth2Client = getOAuthClient();
        await oauth2Client.revokeToken(user.googleAccessToken);
      } catch {
        // Ignore revocation errors (token may be expired)
      }
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        googleLastSync: null,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Google disconnect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
