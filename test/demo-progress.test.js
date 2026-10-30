import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDemoProgress } from '../shared/demo-progress.js';

test('builds browser demo progress and ignores duplicate or invalid completions', () => {
  const progress = buildDemoProgress([
    { activityId: 'cardio-walk', completedOn: '2026-10-30' },
    { activityId: 'cardio-walk', completedOn: '2026-10-30' },
    { activityId: 'workout-core', completedOn: '2026-10-29' },
    { activityId: 'not-an-activity', completedOn: '2026-10-30' },
    { activityId: 'yoga-stretch', completedOn: '2026-10-20' },
    { activityId: 'yoga-stretch', completedOn: '2026-02-30' },
  ], new Date('2026-10-30T12:00:00.000Z'));

  assert.deepEqual(progress.completedToday, ['cardio-walk']);
  assert.deepEqual(progress.totals, { completed: 3, minutes: 37 });
  assert.equal(progress.week.length, 7);
  assert.equal(progress.week[5].date, '2026-10-29');
  assert.deepEqual(progress.week[5], {
    date: '2026-10-29',
    completed: 1,
    minutes: 12,
  });
  assert.deepEqual(progress.week[6], {
    date: '2026-10-30',
    completed: 1,
    minutes: 15,
  });
});
