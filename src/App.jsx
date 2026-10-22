import { useEffect, useRef, useState } from 'react';
import { activityCategories } from '../shared/activities.js';
import './App.css';

const defaultProgress = {
  date: '',
  completedToday: [],
  totals: { completed: 0, minutes: 0 },
  week: [],
};

const today = new Date();
const todayLabels = {
  weekday: today.toLocaleDateString(undefined, { weekday: 'long' }),
  date: today.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }),
};

const timerRunning = (session) =>
  Boolean(session && !session.paused && session.remaining > 0);

function pageFromHash() {
  if (window.location.hash === '#plan') return 'workouts';
  if (window.location.hash === '#progress') return 'progress';
  if (window.location.hash === '#profile') return 'profile';
  return 'dashboard';
}

function Icon({ name, size = 18, ...props }) {
  const shared = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  };
  const drawings = {
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    bolt: <><path d="m13 2-3 8h7l-5 12 1-9H6l7-11Z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 14 4-4 3 2 5-6" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    dumbbell: <><path d="m6.5 6.5 11 11M4 9l5-5M15 20l5-5M3 7l4-4M17 21l4-4M3 10l7-7M14 21l7-7" /></>,
    flexibility: <><circle cx="12" cy="5" r="2" /><path d="m12 8-2 5 4 2 2 5M10 13l-5 3-2 4m7-7 5-4 5 2M10 13l-1 7" /></>,
    play: <><path d="m8 5 12 7-12 7V5Z" /></>,
    pause: <><path d="M9 5v14M15 5v14" /></>,
    strength: <><path d="M6 9v6M3.5 10v4M18 9v6m2.5-5v4M6 12h12" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    walk: <><circle cx="14" cy="5" r="2" /><path d="m12 22 2-7-3-3 2-4 4 3 3 1M8 13l-3 4-2 4M13 15l-4 2 1 5" /></>,
    yoga: <><circle cx="12" cy="5" r="2" /><path d="M12 8v5m0-3-6-2m6 2 6-2M12 13l-5 4-3 4m8-8 5 4 3 4M7 17h10" /></>,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...shared}
      {...props}
    >
      {drawings[name] ?? drawings.activity}
    </svg>
  );
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function DashboardChart({ week }) {
  const maxCompleted = Math.max(1, ...week.map((day) => day.completed));

  return (
    <div className="weekly-chart" role="img" aria-label="Completed workouts during the last seven days">
      {week.map((day) => {
        const height = day.completed ? Math.max(12, (day.completed / maxCompleted) * 100) : 4;
        const weekday = new Date(`${day.date}T12:00:00Z`).toLocaleDateString(undefined, {
          weekday: 'short',
          timeZone: 'UTC',
        });

        return (
          <div className="chart-day" key={day.date}>
            <span className="chart-count">{day.completed || ''}</span>
            <div className="chart-track">
              <div
                className={`chart-bar${day.completed ? ' has-workouts' : ''}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="chart-label">{weekday}</span>
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [mobilePage, setMobilePage] = useState(pageFromHash);
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => {
    const savedCategory = window.localStorage.getItem('fitlife-selected-category');
    return activityCategories.some((category) => category.id === savedCategory)
      ? savedCategory
      : 'workout';
  });
  const [progress, setProgress] = useState(defaultProgress);
  const [progressLoading, setProgressLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [timerSession, setTimerSession] = useState(null);
  const [timerSaving, setTimerSaving] = useState(false);
  const [timerError, setTimerError] = useState(false);
  const [pendingActivityId, setPendingActivityId] = useState(null);
  const completionInProgress = useRef(false);
  const [authMode, setAuthMode] = useState('login');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    function syncPageFromHash() {
      const nextPage = pageFromHash();
      setMobilePage(nextPage === 'profile' && !user ? 'dashboard' : nextPage);
    }

    syncPageFromHash();
    window.addEventListener('popstate', syncPageFromHash);
    window.addEventListener('hashchange', syncPageFromHash);
    return () => {
      window.removeEventListener('popstate', syncPageFromHash);
      window.removeEventListener('hashchange', syncPageFromHash);
    };
  }, [user]);

  const selectedCategory =
    activityCategories.find((category) => category.id === selectedCategoryId) ??
    activityCategories[0];
  const completedToday = new Set(progress.completedToday);
  const categoryCompleted = selectedCategory.activities.filter((activity) =>
    completedToday.has(activity.id)
  ).length;
  const dailyProgress = Math.round(
    (categoryCompleted / selectedCategory.activities.length) * 100
  );
  const todayMinutes = selectedCategory.activities.reduce(
    (total, activity) => total + (completedToday.has(activity.id) ? activity.duration : 0),
    0,
  );
  const weekCompleted = progress.week.reduce((total, day) => total + day.completed, 0);
  const isTimerRunning = timerRunning(timerSession);
  const timerActivityId = timerSession?.activityId;
  const timerFinished = Boolean(timerSession && timerSession.remaining === 0);
  const timerActivity = timerSession
    ? activityCategories
      .flatMap((category) => category.activities)
      .find((activity) => activity.id === timerSession.activityId)
    : null;

  async function loadProgress() {
    setProgressLoading(true);
    try {
      const response = await fetch('/api/progress');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load your progress.');
      setProgress(data);
      setDashboardError('');
    } catch (error) {
      setDashboardError(error.message || 'Could not connect to the server.');
    } finally {
      setProgressLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.status === 401) return;
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load your account.');
        if (!active) return;

        setUser(data.user);
        const progressResponse = await fetch('/api/progress');
        const progressData = await progressResponse.json();
        if (!progressResponse.ok) {
          throw new Error(progressData.error || 'Could not load your progress.');
        }
        if (active) setProgress(progressData);
      } catch (error) {
        if (active) setDashboardError(error.message || 'Could not connect to the server.');
      }
    }

    loadUser();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isTimerRunning) return undefined;

    const interval = window.setInterval(() => {
      setTimerSession((current) => {
        if (!current || current.paused) return current;
        const remaining = Math.max(0, current.remaining - 1);
        return { ...current, remaining, paused: remaining === 0 };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isTimerRunning]);

  useEffect(() => {
    if (!timerFinished || timerError) return undefined;
    if (completionInProgress.current) return undefined;
    completionInProgress.current = true;
    let active = true;

    async function saveCompletion() {
      setTimerSaving(true);
      setDashboardError('');
      try {
        const response = await fetch('/api/progress/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityId: timerActivityId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not save your workout.');
        const progressResponse = await fetch('/api/progress');
        const progressData = await progressResponse.json();
        if (!progressResponse.ok) {
          throw new Error(progressData.error || 'Workout completed, but progress could not be refreshed.');
        }
        if (active) {
          setProgress(progressData);
          setTimerSession(null);
          setDashboardError('Workout complete! Your progress has been updated.');
        }
      } catch (error) {
        if (active) {
          setTimerError(true);
          setDashboardError(error.message || 'Could not connect to the server.');
        }
      } finally {
        if (active) {
          completionInProgress.current = false;
          setTimerSaving(false);
        }
      }
    }

    saveCompletion();
    return () => {
      active = false;
    };
  }, [timerActivityId, timerFinished, timerError]);

  function openAuth(mode) {
    setAuthMode(mode);
    setAuthError('');
    setAuthForm({ name: '', email: '', password: '' });
    setAuthModalOpen(true);
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const response = await fetch(`/api/auth/${authMode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed.');
      setUser(data.user);
      setAuthModalOpen(false);
      setAuthForm({ name: '', email: '', password: '' });

      const progressResponse = await fetch('/api/progress');
      const progressData = await progressResponse.json();
      if (!progressResponse.ok) {
        throw new Error(progressData.error || 'Could not load your progress.');
      }
      setProgress(progressData);
      if (pendingActivityId) {
        const activity = activityCategories.flatMap((category) => category.activities)
          .find((item) => item.id === pendingActivityId);
        if (activity) {
          completionInProgress.current = false;
          setTimerError(false);
          setTimerSession({
            activityId: activity.id,
            remaining: activity.duration * 60,
            paused: false,
          });
        }
        setPendingActivityId(null);
      }
    } catch (error) {
      setAuthError(error.message || 'Could not connect to the server.');
      setAuthModalOpen(true);
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    setDashboardError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not sign out.');
      setUser(null);
      setProgress(defaultProgress);
      setTimerSession(null);
      setPendingActivityId(null);
      setMobilePage('dashboard');
      window.history.replaceState(null, '', '#dashboard');
    } catch (error) {
      setDashboardError(error.message || 'Could not connect to the server.');
    }
  }

  function startActivity(activity) {
    setDashboardError('');
    if (completedToday.has(activity.id)) return;
    if (!user) {
      setPendingActivityId(activity.id);
      openAuth('login');
      return;
    }
    completionInProgress.current = false;
    setTimerError(false);
    setTimerSession({
      activityId: activity.id,
      remaining: activity.duration * 60,
      paused: false,
    });
  }

  function cancelTimer() {
    if (timerSaving) return;
    setTimerSession(null);
    setTimerError(false);
    completionInProgress.current = false;
    setDashboardError('');
  }

  function retryCompletion() {
    completionInProgress.current = false;
    setTimerError(false);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#dashboard">
          <span className="brand-mark"><Icon name="dumbbell" size={20} /></span>
          <span>FIT<span className="brand-highlight">LIFE</span></span>
        </a>
        <p className="sidebar-label">WORKSPACE</p>
        <nav className={`side-nav${user ? ' has-profile' : ''}`} aria-label="Main navigation">
          <a className={`side-nav-link${mobilePage === 'dashboard' ? ' active' : ''}`} aria-current={mobilePage === 'dashboard' ? 'page' : undefined} href="#dashboard" onClick={() => setMobilePage('dashboard')}><Icon name="chart" /> Dashboard</a>
          <a className={`side-nav-link${mobilePage === 'workouts' ? ' active' : ''}`} aria-current={mobilePage === 'workouts' ? 'page' : undefined} href="#plan" onClick={() => setMobilePage('workouts')}><Icon name="dumbbell" /> My workouts</a>
          <a className={`side-nav-link${mobilePage === 'progress' ? ' active' : ''}`} aria-current={mobilePage === 'progress' ? 'page' : undefined} href="#progress" onClick={() => setMobilePage('progress')}><Icon name="activity" /> Progress</a>
          {user && <a className={`side-nav-link${mobilePage === 'profile' ? ' active' : ''}`} aria-current={mobilePage === 'profile' ? 'page' : undefined} href="#profile" onClick={() => setMobilePage('profile')}><Icon name="user" /> Profile</a>}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-coach">
            <span className="coach-icon"><Icon name="target" size={19} /></span>
            <strong>Stay consistent</strong>
            <p>Small steps make strong habits.</p>
          </div>
          {user ? (
            <div className="sidebar-user">
              <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
              <span className="user-name">{user.name}</span>
              <a className="sign-out-link" href="#profile">Profile</a>
            </div>
          ) : (
            <button className="sidebar-sign-in" type="button" onClick={() => openAuth('login')}>
              <Icon name="user" size={16} /> Sign in to save progress
            </button>
          )}
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">FitLife <Icon name="chevron" size={14} /> <strong>Dashboard</strong></div>
          <div className="topbar-actions">
            <div className="date-label"><Icon name="calendar" size={16} /> {todayLabels.weekday}, {todayLabels.date}</div>
            {user ? (
              <span className="topbar-user">
                <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span>{user.name}</span>
              </span>
            ) : (
              <button className="topbar-join" type="button" onClick={() => openAuth('register')}>Create account</button>
            )}
          </div>
        </header>

        <main className="dashboard" id="dashboard" data-mobile-page={mobilePage}>
          <section className="welcome-row">
            <div>
              <p className="eyebrow">FITNESS OVERVIEW</p>
              <h1>Start</h1>
              <p className="welcome-copy">Track your workouts, build consistency, and keep moving forward.</p>
            </div>
            <span className="week-badge">WEEKLY ACTIVITY <strong>{weekCompleted} sessions</strong></span>
          </section>

          {dashboardError && (
            <p className={`dashboard-notice${dashboardError.startsWith('Workout complete') ? ' success' : ''}`} role="status">
              {dashboardError}
              {!user && dashboardError.startsWith('Workout') && (
                <button type="button" onClick={() => openAuth('login')}>Sign in</button>
              )}
              {user && !progressLoading && (
                <button type="button" onClick={loadProgress}>Refresh</button>
              )}
            </p>
          )}

          <section className="stats-grid" aria-label="Workout statistics">
            <article className="stat-card">
              <span className="stat-icon green"><Icon name="activity" /></span>
              <span className="stat-copy"><small>Today’s workouts</small><strong>{user ? `${progress.completedToday.length}` : '—'}<span> sessions</span></strong></span>
              <span className="stat-footnote">Daily total</span>
            </article>
            <article className="stat-card">
              <span className="stat-icon blue"><Icon name="chart" /></span>
              <span className="stat-copy"><small>This week</small><strong>{user ? weekCompleted : '—'}<span> sessions</span></strong></span>
              <span className="stat-footnote">Last 7 days</span>
            </article>
            <article className="stat-card">
              <span className="stat-icon amber"><Icon name="clock" /></span>
              <span className="stat-copy"><small>Active minutes</small><strong>{user ? progress.totals.minutes : '—'}<span> min</span></strong></span>
              <span className="stat-footnote">All time</span>
            </article>
            <article className="stat-card">
              <span className="stat-icon violet"><Icon name="target" /></span>
              <span className="stat-copy"><small>Today’s goal</small><strong>{dailyProgress}<span>%</span></strong></span>
              <span className="stat-footnote">{categoryCompleted} of {selectedCategory.activities.length} completed</span>
            </article>
          </section>

          <section className="workout-banner">
            <div className="banner-copy">
              <span className="banner-label">TODAY’S TRAINING PLAN</span>
              <h2>Make today count.</h2>
              <p>Choose your training focus and complete a session to log your progress.</p>
            </div>
            <div className="banner-summary">
              <Icon name={selectedCategory.icon} size={25} />
              <div><small>YOUR FOCUS</small><strong>{selectedCategory.name}</strong></div>
            </div>
            <a className="banner-button" href="#plan" onClick={() => setMobilePage('workouts')}>View workout plan <Icon name="arrow" size={16} /></a>
          </section>

          <div className="content-grid">
            <section className="workout-panel" id="plan">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">YOUR TRAINING</p>
                  <h2>Choose a workout</h2>
                </div>
                <span className="plan-date"><Icon name="calendar" size={14} /> Today’s plan</span>
              </div>

              <div className="category-tabs" role="tablist" aria-label="Workout category">
                {activityCategories.map((category) => (
                  <button
                    className={`category-tab${selectedCategoryId === category.id ? ' selected' : ''}`}
                    key={category.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedCategoryId === category.id}
                    aria-controls="activity-list"
                    onClick={() => {
                      setSelectedCategoryId(category.id);
                      window.localStorage.setItem('fitlife-selected-category', category.id);
                    }}
                  >
                    <Icon name={category.icon} size={16} />
                    {category.name}
                  </button>
                ))}
              </div>

              <div className="routine-heading">
                <span><strong>{selectedCategory.name} plan</strong><small>{selectedCategory.description}</small></span>
                <span className="routine-count">{categoryCompleted}/{selectedCategory.activities.length} complete</span>
              </div>

              <div className="activity-list" id="activity-list" role="tabpanel">
                {selectedCategory.activities.map((activity, index) => {
                  const isComplete = completedToday.has(activity.id);
                  return (
                    <article className={`activity-row${isComplete ? ' completed' : ''}`} key={activity.id}>
                      <span className="activity-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="activity-icon"><Icon name={activity.icon} size={19} /></span>
                      <div className="activity-details">
                        <h3>{activity.name}</h3>
                        <p>{activity.details}</p>
                        <span className="activity-duration"><Icon name="clock" size={13} /> {activity.duration} min</span>
                      </div>
                      {isComplete ? (
                        <span className="complete-badge"><Icon name="check" size={15} /> Done</span>
                      ) : (
                        <button className="start-button" type="button" onClick={() => startActivity(activity)}>
                          <Icon name="play" size={13} /> Start
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
              {!user && (
                <div className="login-prompt">
                  <span><Icon name="user" size={17} /></span>
                  <p><strong>Save your training history</strong><small>Sign in to record completed workouts and track your progress.</small></p>
                  <button type="button" onClick={() => openAuth('login')}>Sign in</button>
                </div>
              )}
            </section>

            <aside className="progress-panel" id="progress">
              <article className="progress-card">
                <div className="panel-heading compact">
                  <div><p className="eyebrow">CONSISTENCY</p><h2>Last 7 days</h2></div>
                  <span className="chart-icon"><Icon name="chart" size={17} /></span>
                </div>
                {progressLoading ? (
                  <div className="chart-loading">Loading activity…</div>
                ) : user ? (
                  <DashboardChart week={progress.week} />
                ) : (
                  <div className="chart-empty">Sign in to see your weekly activity.</div>
                )}
                <div className="chart-legend"><span /> Completed sessions</div>
              </article>

              <article className="goal-card">
                <div className="panel-heading compact">
                  <div><p className="eyebrow">DAILY GOAL</p><h2>{selectedCategory.name} plan</h2></div>
                  <span className="goal-percent">{dailyProgress}%</span>
                </div>
                <div className="goal-track"><span style={{ width: `${dailyProgress}%` }} /></div>
                <p className="goal-caption">
                  {categoryCompleted} of {selectedCategory.activities.length} sessions complete today
                </p>
                <div className="goal-total">
                  <span><Icon name="clock" size={15} /> {todayMinutes} min active</span>
                  <span>{selectedCategory.activities.length * 3} min goal</span>
                </div>
              </article>

              <div className="training-note">
                <Icon name="target" size={18} />
                <p><strong>Keep your routine simple</strong><span>A steady schedule beats an occasional hard workout.</span></p>
              </div>
            </aside>
          </div>
          {user && (
            <section className="profile-section" id="profile" aria-labelledby="profile-title">
              <div className="profile-heading">
                <div>
                  <p className="eyebrow">ACCOUNT</p>
                  <h2 id="profile-title">Profile</h2>
                </div>
                <button className="profile-logout" type="button" onClick={signOut}>Log out</button>
              </div>
              <div className="profile-details">
                <span className="profile-avatar">{user.name.charAt(0).toUpperCase()}</span>
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {timerSession && timerActivity && (
        <div className="timer-overlay">
          <section className="timer-dialog" role="dialog" aria-modal="true" aria-labelledby="timer-title">
            <button className="timer-close" type="button" aria-label="Cancel workout" onClick={cancelTimer} disabled={timerSaving}>
              <Icon name="close" size={19} />
            </button>
            <p className="eyebrow">WORKOUT IN PROGRESS</p>
            <span className="timer-activity-icon"><Icon name={timerActivity.icon} size={25} /></span>
            <h2 id="timer-title">{timerActivity.name}</h2>
            <p className="timer-instruction">
              {timerSession.remaining === 0
                ? timerSaving
                  ? 'Saving your completed workout…'
                  : timerError
                    ? 'Your session is complete. Try saving it again.'
                    : 'Your session is complete. Saving your progress…'
                : timerSession.paused
                  ? 'Timer paused. Resume when you’re ready.'
                  : 'Stay focused and work at a comfortable pace.'}
            </p>
            <div className="timer-ring" role="timer" aria-live="off" aria-label={`${formatTime(timerSession.remaining)} remaining`}>
              <span>{formatTime(timerSession.remaining)}</span>
              <small>{timerSession.remaining === 0 ? 'COMPLETE' : 'TIME REMAINING'}</small>
            </div>
            {timerError ? (
              <button className="timer-cancel-button timer-retry-button" type="button" onClick={retryCompletion}>Retry saving workout</button>
            ) : (
              <button className="timer-cancel-button" type="button" onClick={cancelTimer} disabled={timerSaving}>
                {timerSaving ? 'Saving workout…' : 'Cancel workout'}
              </button>
            )}
            {timerSession.remaining > 0 && (
              <button className="timer-pause-button" type="button" onClick={() => setTimerSession((current) =>
                current ? { ...current, paused: !current.paused } : current
              )}>
                <Icon name={timerSession.paused ? 'play' : 'pause'} size={14} />
                {timerSession.paused ? 'Resume timer' : 'Pause timer'}
              </button>
            )}
          </section>
        </div>
      )}

      {authModalOpen && (
        <div className="auth-overlay" onClick={(event) => {
          if (event.target === event.currentTarget) {
            setAuthModalOpen(false);
            setPendingActivityId(null);
          }
        }}>
          <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="auth-close" type="button" aria-label="Close" onClick={() => {
              setAuthModalOpen(false);
              setPendingActivityId(null);
            }}>
              <Icon name="close" size={18} />
            </button>
            <p className="eyebrow">{authMode === 'register' ? 'START YOUR JOURNEY' : 'WELCOME BACK'}</p>
            <h2 id="auth-title">{authMode === 'register' ? 'Create your account' : 'Sign in to FitLife'}</h2>
            <p className="auth-subtitle">
              {authMode === 'register'
                ? 'Save completed workouts and track your progress.'
                : 'Sign in to start workouts and save your training history.'}
            </p>
            <form className="auth-form" onSubmit={submitAuth}>
              {authMode === 'register' && (
                <label>
                  Your name
                  <input autoComplete="name" maxLength={80} required value={authForm.name}
                    onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} />
                </label>
              )}
              <label>
                Login ID (email address)
                <input type="email" autoComplete="email" maxLength={254} required value={authForm.email}
                  onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} />
              </label>
              <label>
                Password
                <input type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                  minLength={8} required value={authForm.password}
                  onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} />
              </label>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <button className="auth-submit" type="submit" disabled={authLoading}>
                {authLoading ? 'Please wait...' : authMode === 'register' ? 'Create account' : 'Sign in'}
              </button>
            </form>
            <p className="auth-switch">
              {authMode === 'register' ? 'Already have an account?' : 'New to FitLife?'}{' '}
              <button type="button" onClick={() => {
                setAuthMode(authMode === 'register' ? 'login' : 'register');
                setAuthError('');
                setAuthForm({ name: '', email: '', password: '' });
              }}>
                {authMode === 'register' ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
