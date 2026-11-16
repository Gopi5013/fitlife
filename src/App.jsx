import ExerciseLibrary from './ExerciseLibrary.jsx';
import './App.css';

function Icon({ name, size = 18 }) {
  const drawings = {
    dumbbell: <><path d="m6.5 6.5 11 11M4 9l5-5M15 20l5-5M3 7l4-4M17 21l4-4M3 10l7-7M14 21l7-7" /></>,
    flexibility: <><circle cx="12" cy="5" r="2" /><path d="M12 8v5m0-3-6-2m6 2 6-2M12 13l-5 4-3 4m8-8 5 4 3 4M7 17h10" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      {drawings[name]}
    </svg>
  );
}

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#library">
          <span className="brand-mark"><Icon name="dumbbell" size={20} /></span>
          <span>FIT<span className="brand-highlight">LIFE</span></span>
        </a>
        <p className="sidebar-label">WORKSPACE</p>
        <nav className="side-nav exercise-nav" aria-label="Main navigation">
          <a className="side-nav-link active" aria-current="page" href="#library">
            <Icon name="flexibility" /> Exercises
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-coach">
            <span className="coach-icon"><Icon name="target" size={19} /></span>
            <strong>Stay consistent</strong>
            <p>Small steps make strong habits.</p>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">FitLife <Icon name="chevron" size={14} /> <strong>Exercises</strong></div>
        </header>
        <main className="dashboard exercise-home">
          <ExerciseLibrary />
        </main>
      </div>
    </div>
  );
}

export default App;
