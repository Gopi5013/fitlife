import { workoutCategories } from './exercises.js';

export const EXERCISE_COMPLETIONS_KEY = 'fitlife-exercise-completions';

const exerciseIds = new Set(
  workoutCategories.flatMap((category) => category.exercises.map((exercise) => exercise.id)),
);

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day;
}

export function buildExerciseProgress(completions, today = new Date()) {
  if (!Array.isArray(completions)) {
    throw new Error('Saved workout history is invalid. Clear this site’s data to reset it.');
  }

  const uniqueCompletions = new Map();
  for (const completion of completions) {
    if (
      typeof completion?.exerciseId !== 'string'
      || !exerciseIds.has(completion.exerciseId)
      || !isValidDateKey(completion.completedOn)
    ) {
      throw new Error('Saved workout history is invalid. Clear this site’s data to reset it.');
    }

    uniqueCompletions.set(`${completion.completedOn}:${completion.exerciseId}`, completion);
  }

  const normalizedCompletions = [...uniqueCompletions.values()];
  const todayKey = dateKey(today);
  const completedToday = normalizedCompletions
    .filter((completion) => completion.completedOn === todayKey)
    .map((completion) => completion.exerciseId);

  const categories = workoutCategories.map((category) => {
    const categoryCompleted = category.exercises.filter((exercise) =>
      completedToday.includes(exercise.id)
    ).length;
    return {
      id: category.id,
      name: category.name,
      completed: categoryCompleted,
      total: category.exercises.length,
    };
  });

  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
    const date = dateKey(day);
    const completed = normalizedCompletions.filter((completion) =>
      completion.completedOn === date
    ).length;
    return {
      date,
      completed,
      active: completed > 0,
      isToday: date === todayKey,
    };
  });

  return {
    today: todayKey,
    completedToday,
    categories,
    week,
  };
}
