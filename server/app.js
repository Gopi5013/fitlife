import { createHash, randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { activityCategories } from '../shared/activities.js';

const COOKIE_NAME = 'fitlife_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function setSessionCookie(response, token, production) {
  response.cookie(COOKIE_NAME, token, {
    ...AUTH_COOKIE_OPTIONS,
    secure: production,
    maxAge: SESSION_DURATION_MS,
  });
}

export function createApp(db, { production = process.env.NODE_ENV === 'production' } = {}) {
  const app = express();
  const findUserBySession = db.prepare(`
    SELECT users.id, users.name, users.email, sessions.token_hash, sessions.expires_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `);
  const createSession = db.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
  );
  const findActiveSession = db.prepare(`
    SELECT users.id, users.name, users.email, sessions.token_hash, sessions.expires_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `);
  const requireUser = (request, response, next) => {
    const token = request.cookies[COOKIE_NAME];
    if (!token) return response.status(401).json({ error: 'Sign in to track your activity.' });

    const tokenHash = hashToken(token);
    const session = findActiveSession.get(tokenHash);
    if (!session || session.expires_at <= Date.now()) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      response.clearCookie(COOKIE_NAME, {
        ...AUTH_COOKIE_OPTIONS,
        secure: production,
      });
      return response.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }

    request.user = publicUser(session);
    return next();
  };

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.get('/api/health', (request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/auth/me', (request, response) => {
    const token = request.cookies[COOKIE_NAME];
    if (!token) return response.status(401).json({ error: 'Not signed in.' });

    const tokenHash = hashToken(token);
    const session = findUserBySession.get(tokenHash);
    if (!session || session.expires_at <= Date.now()) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      response.clearCookie(COOKIE_NAME, {
        ...AUTH_COOKIE_OPTIONS,
        secure: production,
      });
      return response.status(401).json({ error: 'Not signed in.' });
    }

    return response.json({ user: publicUser(session) });
  });

  app.get('/api/progress', requireUser, (request, response) => {
    const today = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const completedToday = db.prepare(
      'SELECT activity_id FROM activity_completions WHERE user_id = ? AND completed_on = ?',
    ).all(request.user.id, today).map((row) => row.activity_id);
    const totals = db.prepare(`
      SELECT COUNT(*) AS completed, COALESCE(SUM(duration_minutes), 0) AS minutes
      FROM activity_completions
      WHERE user_id = ?
    `).get(request.user.id);
    const weeklyRows = db.prepare(`
      SELECT completed_on, COUNT(*) AS completed,
        COALESCE(SUM(duration_minutes), 0) AS minutes
      FROM activity_completions
      WHERE user_id = ? AND completed_on >= ?
      GROUP BY completed_on
    `).all(request.user.id, startDate);
    const weeklyTotals = new Map(weeklyRows.map((row) => [row.completed_on, row]));
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const day = weeklyTotals.get(date);
      return {
        date,
        completed: day?.completed ?? 0,
        minutes: day?.minutes ?? 0,
      };
    });

    return response.json({
      date: today,
      completedToday,
      totals: {
        completed: totals.completed,
        minutes: totals.minutes,
      },
      week,
    });
  });

  app.post('/api/progress/complete', requireUser, (request, response) => {
    const activityId = typeof request.body?.activityId === 'string'
      ? request.body.activityId
      : '';
    const activity = activityCategories
      .flatMap((category) => category.activities)
      .find((item) => item.id === activityId);
    if (!activity) {
      return response.status(400).json({ error: 'Choose a valid activity.' });
    }

    const completedOn = new Date().toISOString().slice(0, 10);
    const result = db.prepare(`
      INSERT INTO activity_completions
        (user_id, activity_id, completed_on, completed_at, duration_minutes)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (user_id, activity_id, completed_on) DO NOTHING
    `).run(
      request.user.id,
      activity.id,
      completedOn,
      new Date().toISOString(),
      activity.duration,
    );

    return response.status(result.changes ? 201 : 200).json({
      completed: true,
      alreadyCompleted: result.changes === 0,
    });
  });

  app.post('/api/auth/register', authLimiter, async (request, response) => {
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
    const email = typeof request.body?.email === 'string'
      ? request.body.email.trim().toLowerCase()
      : '';
    const password = typeof request.body?.password === 'string' ? request.body.password : '';

    if (!name || name.length > 80) {
      return response.status(400).json({ error: 'Name must be between 1 and 80 characters.' });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      return response.status(400).json({ error: 'Password must be at least 8 characters and no more than 72 bytes.' });
    }

    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      return response.status(409).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    let result;
    try {
      result = db.prepare(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      ).run(name, email, passwordHash);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return response.status(409).json({ error: 'An account with that email already exists.' });
      }
      throw error;
    }

    const userId = Number(result.lastInsertRowid);
    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    createSession.run(hashToken(token), userId, expiresAt);
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    setSessionCookie(response, token, production);

    return response.status(201).json({
      user: { id: userId, name, email },
    });
  });

  app.post('/api/auth/login', authLimiter, async (request, response) => {
    const email = typeof request.body?.email === 'string'
      ? request.body.email.trim().toLowerCase()
      : '';
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (Buffer.byteLength(password, 'utf8') > 72) {
      return response.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const user = db.prepare(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?',
    ).get(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return response.status(401).json({ error: 'Email or password is incorrect.' });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    createSession.run(hashToken(token), user.id, expiresAt);
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    setSessionCookie(response, token, production);

    return response.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', (request, response) => {
    const token = request.cookies[COOKIE_NAME];
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    }
    response.clearCookie(COOKIE_NAME, {
      ...AUTH_COOKIE_OPTIONS,
      secure: production,
    });
    return response.json({ message: 'Signed out.' });
  });

  if (production) {
    const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const distDirectory = resolve(projectDirectory, 'dist');
    app.use(express.static(distDirectory));
    app.use((request, response, next) => {
      if (request.method !== 'GET' || request.path === '/api' || request.path.startsWith('/api/')) {
        return next();
      }
      return response.sendFile(resolve(distDirectory, 'index.html'), (error) => {
        if (error) next(error);
      });
    });
  }

  app.use((request, response) => {
    response.status(404).json({ error: 'Not found.' });
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    if (error.status === 400 && error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'Request body must contain valid JSON.' });
    }
    if (error.status === 413) {
      return response.status(413).json({ error: 'Request body is too large.' });
    }
    console.error(error);
    return response.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}
