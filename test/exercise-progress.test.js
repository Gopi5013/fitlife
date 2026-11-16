import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildExerciseProgress } from '../shared/exercise-progress.js';

test('builds daily category totals and a seven-day completion history', () => {
  const today = new Date(2026, 10, 16, 12);
  const progress = buildExerciseProgress([
    { exerciseId: 'push-ups', completedOn: '2026-11-16' },
    { exerciseId: 'push-ups', completedOn: '2026-11-16' },
    { exerciseId: 'squats', completedOn: '2026-11-16' },
    { exerciseId: 'mountain-pose', completedOn: '2026-11-15' },
  ], today);

  assert.equal(progress.today, '2026-11-16');
  assert.deepEqual(progress.completedToday, ['push-ups', 'squats']);
  assert.deepEqual(progress.categories, [
    { id: 'gym', name: 'Gym', completed: 2, total: 10 },
    { id: 'yoga', name: 'Yoga', completed: 0, total: 10 },
    { id: 'cardio', name: 'Cardio', completed: 0, total: 10 },
  ]);
  assert.deepEqual(progress.week.at(-2), {
    date: '2026-11-15',
    completed: 1,
    active: true,
    isToday: false,
  });
  assert.deepEqual(progress.week.at(-1), {
    date: '2026-11-16',
    completed: 2,
    active: true,
    isToday: true,
  });
});

test('rejects invalid saved exercise progress', () => {
  assert.throws(
    () => buildExerciseProgress([{ exerciseId: 'unknown', completedOn: '2026-11-16' }]),
    /Saved workout history is invalid/,
  );
  assert.throws(
    () => buildExerciseProgress([{ exerciseId: 'push-ups', completedOn: '2026-02-30' }]),
    /Saved workout history is invalid/,
  );
});
