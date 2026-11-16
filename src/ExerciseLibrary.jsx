import { useEffect, useRef, useState } from 'react';
import { buildExerciseProgress, EXERCISE_COMPLETIONS_KEY } from '../shared/exercise-progress.js';
import { workoutCategories } from '../shared/exercises.js';
import './ExerciseLibrary.css';

function ExerciseMedia({ exercise, playing = true, compact = false, replayKey = 0 }) {
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(
    () => !compact || typeof IntersectionObserver === 'undefined',
  );
  const mediaRef = useRef(null);
  const videoRef = useRef(null);
  const previousReplayKey = useRef(replayKey);
  const { media } = exercise;

  const pausedGif = media.type === 'gif' && !playing;

  useEffect(() => {
    if (!compact || media.type !== 'video') return undefined;
    const node = mediaRef.current;
    if (!node) return undefined;

    if (!('IntersectionObserver' in window)) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, { rootMargin: '100px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [compact, media.type]);

  useEffect(() => {
    const video = videoRef.current;
    if (media.type !== 'video' || compact || !video) return;

    if (replayKey !== previousReplayKey.current) {
      video.currentTime = 0;
      previousReplayKey.current = replayKey;
    }

    if (playing) {
      video.play().catch(() => setFailed(true));
    } else {
      video.pause();
    }
  }, [compact, media.type, playing, replayKey]);

  return (
    <div
      className={`exercise-media${compact ? ' compact' : ''}${pausedGif ? ' paused' : ''}`}
      ref={mediaRef}
    >
      {failed ? (
        <div className="exercise-media-fallback" role="img" aria-label={`${exercise.name} media unavailable`}>
          <span>Demonstration unavailable</span>
        </div>
      ) : pausedGif ? (
        <div className="exercise-media-paused" aria-label={`${exercise.name} animation paused`}>
          <span>Animation paused</span>
        </div>
      ) : media.type === 'video' ? (
        <video
          ref={videoRef}
          src={inView || !compact ? media.src : undefined}
          poster={media.poster}
          autoPlay={compact ? inView : playing}
          loop
          muted
          playsInline
          preload={compact ? 'none' : 'metadata'}
          aria-label={`Animated demonstration for ${exercise.name}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <img
          key={`${media.src}-${replayKey}`}
          src={media.src}
          alt={`${media.type === 'gif' ? 'Animated demonstration' : 'Photo guide'} for ${exercise.name}`}
          loading={compact ? 'lazy' : 'eager'}
          onError={() => setFailed(true)}
        />
      )}
      {media.credit && (
        <a
          className="exercise-media-credit"
          href={media.creditUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${media.type === 'video' ? 'Video' : 'Photo'} from ${media.credit}`}
        >
          {media.type === 'video' ? 'Video' : 'Photo'}: {media.credit}
        </a>
      )}
    </div>
  );
}

function formatDuration(seconds) {
  return `00:${String(seconds).padStart(2, '0')}`;
}

function ExerciseDialog({ exercise, completed, onComplete, onClose }) {
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [completionSaveFailed, setCompletionSaveFailed] = useState(false);
  const completionTriggered = useRef(false);
  const isHold = exercise.metric.startsWith('Hold');
  const target = Number(exercise.metric.match(/\d+/)?.[0] ?? 30);
  const duration = Number(exercise.metric.match(/(\d+)\s*sec/)?.[1] ?? 30);
  const cycleSeconds = duration / target;
  const sessionPlaying = playing && elapsed < duration;
  const count = isHold
    ? Math.min(duration, elapsed)
    : Math.min(target, Math.floor(elapsed / cycleSeconds));

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    if (!playing || elapsed >= duration) return undefined;
    const interval = window.setInterval(() => {
      const nextElapsed = Math.min(duration, elapsed + 1);
      setElapsed(nextElapsed);
      if (nextElapsed >= duration && !completionTriggered.current) {
        completionTriggered.current = true;
        if (completed || onComplete()) {
          onClose();
        } else {
          setCompletionSaveFailed(true);
        }
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [completed, duration, elapsed, onClose, onComplete, playing]);

  function replay() {
    setElapsed(0);
    completionTriggered.current = false;
    setCompletionSaveFailed(false);
    setPlaying(true);
    setReplayKey((key) => key + 1);
  }

  return (
    <div className="exercise-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="exercise-dialog" role="dialog" aria-modal="true" aria-labelledby="exercise-title">
        <button className="exercise-close" type="button" aria-label="Close exercise details" onClick={onClose}>×</button>
        <div className="exercise-dialog-visual">
          <ExerciseMedia
            exercise={exercise}
            playing={sessionPlaying}
            replayKey={replayKey}
          />
        </div>
        <div className="exercise-dialog-content">
          <p className="exercise-kicker">EXERCISE GUIDE</p>
          <h2 id="exercise-title">{exercise.name}</h2>
          <p className="exercise-description">{exercise.description}</p>
          <div className="exercise-instruction">
            <strong>How to do it</strong>
            <p>{exercise.instructions}</p>
          </div>
          <div className="exercise-muscles">
            <strong>Target muscles</strong>
            <span>{exercise.muscles}</span>
          </div>
          {exercise.media.credit && (
            <a
              className="exercise-dialog-credit"
              href={exercise.media.creditUrl}
              target="_blank"
              rel="noreferrer"
            >
              {exercise.media.type === 'video' ? 'Video' : 'Photo'} from {exercise.media.credit}
            </a>
          )}
          <div className="exercise-session">
            <div className="exercise-count" aria-live="polite">
              <strong>
                {completionSaveFailed
                  ? 'Session ended'
                  : isHold ? formatDuration(count) : `${count} / ${target}`}
              </strong>
              <span>{isHold ? `HOLD · ${formatDuration(duration)}` : `REPS · ${duration} SEC`}</span>
            </div>
            <div className="exercise-controls">
              <button
                type="button"
                className="exercise-control primary"
                disabled={completionSaveFailed}
                onClick={() => setPlaying((current) => !current)}
              >
                {exercise.media.type === 'gif' || exercise.media.type === 'video'
                  ? playing ? 'Pause' : 'Play'
                  : playing ? 'Pause timer' : 'Resume timer'}
              </button>
              <button type="button" className="exercise-control" onClick={replay}>Replay</button>
              <button
                type="button"
                className="exercise-control"
                disabled
                title={exercise.media.type === 'gif' || exercise.media.type === 'video'
                  ? 'Exercise media playback speed cannot be changed'
                  : 'A still photo has no playback speed'}
              >
                {exercise.media.type === 'gif' || exercise.media.type === 'video' ? 'Speed fixed' : 'Photo guide'}
              </button>
            </div>
          </div>
          <p className="exercise-completion-status" role="status">
            {completionSaveFailed
              ? 'Session complete, but progress could not be saved. Retry below.'
              : completed
                ? 'Already completed today. Finish again to close this exercise.'
                : 'Complete the session to add this exercise to today’s progress and close the guide.'}
          </p>
          {completionSaveFailed && (
            <button
              type="button"
              className="exercise-retry-completion"
              onClick={() => {
                if (onComplete()) onClose();
              }}
            >
              Retry saving completion
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default function ExerciseLibrary() {
  const [categoryId, setCategoryId] = useState('gym');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [completionState, setCompletionState] = useState(() => {
    try {
      const saved = window.localStorage.getItem(EXERCISE_COMPLETIONS_KEY);
      const completions = saved ? JSON.parse(saved) : [];
      buildExerciseProgress(completions);
      return { completions, error: '' };
    } catch (error) {
      return {
        completions: [],
        error: error.message || 'Could not load workout progress from this browser.',
      };
    }
  });
  const [today, setToday] = useState(() => new Date());
  const activeCategory = workoutCategories.find((category) => category.id === categoryId);
  const progress = buildExerciseProgress(completionState.completions, today);
  const completedToday = new Set(progress.completedToday);
  const completionPercent = Math.round(
    (progress.completedToday.length / workoutCategories.flatMap((category) => category.exercises).length) * 100
  );

  useEffect(() => {
    const interval = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  function completeExercise(exercise) {
    const exists = completionState.completions.some((completion) =>
      completion.exerciseId === exercise.id && completion.completedOn === progress.today
    );
    if (exists) return true;

    const completions = [
      ...completionState.completions,
      { exerciseId: exercise.id, completedOn: progress.today },
    ];

    try {
      window.localStorage.setItem(EXERCISE_COMPLETIONS_KEY, JSON.stringify(completions));
      setCompletionState({ completions, error: '' });
      return true;
    } catch (error) {
      setCompletionState((current) => ({
        ...current,
        error: error.message || 'Could not save your workout progress in this browser.',
      }));
      return false;
    }
  }

  return (
    <section className="exercise-library" id="library" aria-labelledby="library-title">
      <div className="exercise-library-heading">
        <div>
          <p className="eyebrow">MOVE WITH CONFIDENCE</p>
          <h2 id="library-title">Exercise library</h2>
          <p>Explore 30 guided movements with animated exercise demonstrations.</p>
        </div>
        <span className="exercise-library-count">30 MOVEMENTS</span>
      </div>

      <section className="workout-progress" aria-labelledby="workout-progress-title">
        <div className="workout-progress-heading">
          <div>
            <p className="eyebrow">YOUR ACTIVITY</p>
            <h3 id="workout-progress-title">Workout progress</h3>
            <p>
              {progress.completedToday.length === 0
                ? 'No exercises logged today yet.'
                : `${progress.completedToday.length} of 30 exercises completed today.`}
            </p>
          </div>
          <strong className="workout-progress-percent">{completionPercent}%</strong>
        </div>
        <div
          className="workout-progress-track"
          role="progressbar"
          aria-label="Today's exercise completion"
          aria-valuemin={0}
          aria-valuemax={30}
          aria-valuenow={progress.completedToday.length}
        >
          <span style={{ width: `${completionPercent}%` }} />
        </div>
        <div className="workout-category-progress">
          {progress.categories.map((category) => (
            <span key={category.id}>
              <strong>{category.name}</strong> {category.completed}/{category.total}
            </span>
          ))}
        </div>
        <div className="weekly-workout-progress" aria-label="Workout progress over the last seven days">
          {progress.week.map((day) => {
            const date = new Date(`${day.date}T12:00:00`);
            const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
            return (
              <div
                className={`weekly-workout-day${day.active ? ' active' : ''}${day.isToday ? ' today' : ''}`}
                key={day.date}
                aria-label={`${weekday}, ${day.completed} exercises completed${day.isToday ? ', today' : ''}`}
                title={`${weekday}: ${day.completed} exercise${day.completed === 1 ? '' : 's'} completed`}
              >
                <small>{weekday}</small>
                <strong>{day.completed}</strong>
                <span>{day.active ? 'Done' : '—'}</span>
              </div>
            );
          })}
        </div>
        <p className="workout-progress-note">A day shows “Done” after at least one exercise is completed.</p>
        {completionState.error && <p className="workout-progress-error" role="alert">{completionState.error}</p>}
      </section>

      <div className="exercise-category-tabs" role="tablist" aria-label="Exercise category">
        {workoutCategories.map((category) => (
          <button
            key={category.id}
            id={`exercise-tab-${category.id}`}
            className={`exercise-category-tab${categoryId === category.id ? ' selected' : ''}`}
            type="button"
            role="tab"
            aria-selected={categoryId === category.id}
            aria-controls={`exercise-panel-${category.id}`}
            onClick={() => setCategoryId(category.id)}
          >
            <span>{category.name}</span>
            <small>10</small>
          </button>
        ))}
      </div>

      <div
        className="exercise-category-panel"
        id={`exercise-panel-${activeCategory.id}`}
        role="tabpanel"
        aria-labelledby={`exercise-tab-${activeCategory.id}`}
        key={activeCategory.id}
      >
        <p className="exercise-category-description">{activeCategory.description}</p>
        <div className="exercise-card-grid">
          {activeCategory.exercises.map((exercise, index) => (
            <article className="exercise-card" key={exercise.id}>
              <div className={`exercise-card-animation ${activeCategory.id}`}>
                <span className="exercise-card-index">{String(index + 1).padStart(2, '0')}</span>
                <ExerciseMedia exercise={exercise} compact />
                {completedToday.has(exercise.id) && (
                  <span className="exercise-card-completed">Done today</span>
                )}
              </div>
              <div className="exercise-card-content">
                <h3>{exercise.name}</h3>
                <p>{exercise.muscles}</p>
                <div className="exercise-card-footer">
                  <span>{exercise.metric}</span>
                  <button type="button" onClick={() => setSelectedExercise(exercise)}>
                    {completedToday.has(exercise.id) ? 'Start again' : 'Start exercise'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      {selectedExercise && (
        <ExerciseDialog
          exercise={selectedExercise}
          completed={completedToday.has(selectedExercise.id)}
          onComplete={() => completeExercise(selectedExercise)}
          onClose={() => setSelectedExercise(null)}
        />
      )}
      <p className="exercise-library-attribution">
        Exercise GIFs by <a href="https://exercisedb.dev/" target="_blank" rel="noreferrer">ExerciseDB by AscendAPI</a>
        {' '}· Yoga videos from <a href="https://www.pexels.com/license/" target="_blank" rel="noreferrer">Pexels</a>
      </p>
    </section>
  );
}
