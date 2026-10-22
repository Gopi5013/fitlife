import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/database.js';
import { activityCategories } from '../shared/activities.js';

let directory;
let db;
let server;
let baseUrl;

before(async () => {
  directory = mkdtempSync(join(tmpdir(), 'fitlife-auth-'));
  db = openDatabase(join(directory, 'test.sqlite'));
  server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (db) db.close();
  if (directory) rmSync(directory, { recursive: true, force: true });
});

test('registration, authenticated session, login, and logout', async () => {
  const registration = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Fit User',
      email: 'FIT.USER@example.com',
      password: 'strong-password',
    }),
  });
  assert.equal(registration.status, 201);
  const registered = await registration.json();
  assert.deepEqual(registered.user, {
    id: 1,
    name: 'Fit User',
    email: 'fit.user@example.com',
  });
  const cookie = registration.headers.get('set-cookie').split(';')[0];
  assert.match(cookie, /^fitlife_session=/);
  assert.equal(
    db.prepare('SELECT password_hash FROM users WHERE id = 1').get().password_hash
      .startsWith('$2'),
    true,
  );
  assert.equal(
    db.prepare('SELECT token_hash FROM sessions WHERE user_id = 1').get().token_hash.length,
    64,
  );

  const currentUser = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(currentUser.status, 200);
  assert.equal((await currentUser.json()).user.email, 'fit.user@example.com');

  const emptyProgress = await fetch(`${baseUrl}/api/progress`, {
    headers: { Cookie: cookie },
  });
  assert.equal(emptyProgress.status, 200);
  const initialProgress = await emptyProgress.json();
  assert.equal(initialProgress.completedToday.length, 0);
  assert.equal(initialProgress.totals.completed, 0);
  assert.equal(initialProgress.week.length, 7);

  const completion = await fetch(`${baseUrl}/api/progress/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ activityId: 'cardio-walk' }),
  });
  assert.equal(completion.status, 201);
  assert.equal((await completion.json()).alreadyCompleted, false);

  const duplicateCompletion = await fetch(`${baseUrl}/api/progress/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ activityId: 'cardio-walk' }),
  });
  assert.equal(duplicateCompletion.status, 200);
  assert.equal((await duplicateCompletion.json()).alreadyCompleted, true);

  const updatedProgressResponse = await fetch(`${baseUrl}/api/progress`, {
    headers: { Cookie: cookie },
  });
  const updatedProgress = await updatedProgressResponse.json();
  assert.deepEqual(updatedProgress.completedToday, ['cardio-walk']);
  assert.equal(updatedProgress.totals.completed, 1);
  assert.equal(updatedProgress.totals.minutes, 15);
  assert.equal(updatedProgress.week.at(-1).completed, 1);

  const invalidCompletion = await fetch(`${baseUrl}/api/progress/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ activityId: 'unlisted-activity', duration: 999 }),
  });
  assert.equal(invalidCompletion.status, 400);

  const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Another User',
      email: 'fit.user@example.com',
      password: 'strong-password',
    }),
  });
  assert.equal(duplicate.status, 409);

  const badPassword = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'fit.user@example.com', password: 'wrong-password' }),
  });
  assert.equal(badPassword.status, 401);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'FIT.USER@example.com', password: 'strong-password' }),
  });
  assert.equal(login.status, 200);
  const loginCookie = login.headers.get('set-cookie').split(';')[0];

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: loginCookie },
  });
  assert.equal(logout.status, 200);
  const signedOut = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: loginCookie },
  });
  assert.equal(signedOut.status, 401);
});

test('registration rejects weak passwords', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Fit User',
      email: 'weak@example.com',
      password: 'short',
    }),
  });
  assert.equal(response.status, 400);
});

test('malformed JSON receives a client error', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'Request body must contain valid JSON.',
  });
});

test('progress endpoints require authentication', async () => {
  const progress = await fetch(`${baseUrl}/api/progress`);
  assert.equal(progress.status, 401);

  const completion = await fetch(`${baseUrl}/api/progress/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activityId: 'yoga-morning-flow' }),
  });
  assert.equal(completion.status, 401);
});

test('all cardio, workout, and yoga activities record isolated account progress', async () => {
  const registration = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Second User',
      email: 'second.user@example.com',
      password: 'another-strong-password',
    }),
  });
  assert.equal(registration.status, 201);
  const cookie = registration.headers.get('set-cookie').split(';')[0];

  const activities = activityCategories.flatMap((category) => category.activities);
  for (const activity of activities) {
    const response = await fetch(`${baseUrl}/api/progress/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ activityId: activity.id }),
    });
    assert.equal(response.status, 201, `${activity.id} should complete`);
  }

  const response = await fetch(`${baseUrl}/api/progress`, {
    headers: { Cookie: cookie },
  });
  assert.equal(response.status, 200);
  const progress = await response.json();
  assert.equal(progress.completedToday.length, activities.length);
  assert.equal(progress.totals.completed, activities.length);
  assert.equal(
    progress.totals.minutes,
    activities.reduce((total, activity) => total + activity.duration, 0),
  );

  const firstUserId = db.prepare(
    'SELECT id FROM users WHERE email = ?',
  ).get('fit.user@example.com').id;
  const secondUserId = db.prepare(
    'SELECT id FROM users WHERE email = ?',
  ).get('second.user@example.com').id;
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM activity_completions WHERE user_id = ?')
      .get(firstUserId).count,
    1,
  );
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM activity_completions WHERE user_id = ?')
      .get(secondUserId).count,
    activities.length,
  );
});
