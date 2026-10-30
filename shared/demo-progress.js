import { activityCategories } from './activities.js';

const activitiesById = new Map(
  activityCategories.flatMap((category) =>
    category.activities.map((activity) => [activity.id, activity])
  ),
);

export function buildDemoProgress(completions, today = new Date()) {
  const todayDate = today.toISOString().slice(0, 10);
  const todayTimestamp = Date.parse(`${todayDate}T00:00:00.000Z`);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(todayTimestamp - (6 - index) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return { date, completed: 0, minutes: 0 };
  });
  const weeklyTotals = new Map(week.map((day) => [day.date, day]));
  const seenCompletions = new Set();
  const validCompletions = Array.isArray(completions)
    ? completions.filter((completion) => {
      if (
        typeof completion?.activityId !== 'string'
        || typeof completion.completedOn !== 'string'
        || !activitiesById.has(completion.activityId)
        || !/^\d{4}-\d{2}-\d{2}$/.test(completion.completedOn)
      ) {
        return false;
      }

      const completionDate = new Date(`${completion.completedOn}T00:00:00.000Z`);
      if (
        Number.isNaN(completionDate.getTime())
        || completionDate.toISOString().slice(0, 10) !== completion.completedOn
      ) {
        return false;
      }

      const key = `${completion.completedOn}:${completion.activityId}`;
      if (seenCompletions.has(key)) return false;
      seenCompletions.add(key);
      return true;
    })
    : [];
  const completedToday = validCompletions
    .filter((completion) => completion.completedOn === todayDate)
    .map((completion) => completion.activityId);

  for (const completion of validCompletions) {
    const day = weeklyTotals.get(completion.completedOn);
    if (day) {
      day.completed += 1;
      day.minutes += activitiesById.get(completion.activityId).duration;
    }
  }

  return {
    date: todayDate,
    completedToday,
    totals: {
      completed: validCompletions.length,
      minutes: validCompletions.reduce(
        (total, completion) => total + activitiesById.get(completion.activityId).duration,
        0,
      ),
    },
    week,
  };
}
