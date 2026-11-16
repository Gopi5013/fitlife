import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workoutCategories } from '../shared/exercises.js';

test('workout library includes ten fully described exercises in each category', () => {
  assert.deepEqual(workoutCategories.map((category) => category.id), ['gym', 'yoga', 'cardio']);

  const exercises = workoutCategories.flatMap((category) => {
    assert.equal(category.exercises.length, 10, `${category.name} should have ten exercises`);
    return category.exercises;
  });

  assert.equal(new Set(exercises.map((exercise) => exercise.id)).size, 30);
  assert.equal(new Set(exercises.map((exercise) => exercise.media.src)).size, 30);
  for (const exercise of exercises) {
    assert.ok(exercise.name, `${exercise.id} should have a name`);
    assert.ok(exercise.description, `${exercise.id} should have a description`);
    assert.ok(exercise.instructions, `${exercise.id} should have instructions`);
    assert.ok(exercise.muscles, `${exercise.id} should list target muscles`);
    assert.ok(['gif', 'image', 'video'].includes(exercise.media.type), `${exercise.id} should use animated media`);
    assert.match(exercise.media.src, /^(https:\/\/|\/)/);
    assert.match(exercise.metric, /\d+/);
    if (exercise.media.type === 'image') {
      assert.ok(exercise.media.credit, `${exercise.id} should credit its photo`);
      assert.ok(exercise.media.creditUrl, `${exercise.id} should link to its photo source`);
      assert.ok(exercise.media.license, `${exercise.id} should state its photo license`);
    }
    if (exercise.media.type === 'video') {
      assert.match(exercise.media.src, /\.mp4$/);
      assert.match(exercise.media.poster, /^https:\/\//);
      assert.ok(exercise.media.creditUrl, `${exercise.id} should link to its video source`);
    }
  }

  const yoga = workoutCategories.find((category) => category.id === 'yoga');
  assert.ok(yoga.exercises.every((exercise) => exercise.media.type !== 'image'));
});
