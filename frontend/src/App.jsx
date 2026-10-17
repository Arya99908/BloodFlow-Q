import { lazy, Suspense, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Boxes, ChevronDown, ClipboardPlus, FileClock, FlaskConical, HeartPulse, Hospital, LayoutDashboard, Menu, Moon, Network, Settings2, Siren, Sun, X, PlayCircle, UserRoundPlus, Truck } from 'lucide-react';
import { api } from './services/api';
import Dashboard from './pages/Dashboard';
import BloodBanks from './pages/BloodBanks';
import Hospitals from './pages/Hospitals';
import NetworkPage from './pages/Network';
import Optimization from './pages/Optimization';
import EmergencySimulation from './pages/EmergencySimulation';
import Results from './pages/Results';
import About from './pages/About';
import DemoMode from './pages/DemoMode';
import LoadingState from './components/Feedback';
import Chatbot from './components/Chatbot';
import AlertCenter from './components/AlertCenter';

// The private coordination module includes an optional auth client. Load it
// only when a user opens those pages so the public research dashboard stays
// light and usable when no private database is configured.
const DonorNetwork = lazy(() => import('./pages/DonorNetwork'));
const EmergencyRequests = lazy(() => import('./pages/EmergencyRequests'));
const Coordination = lazy(() => import('./pages/Coordination'));

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'WORKSPACE' },
  { id: 'blood-banks', label: 'Blood banks', icon: Boxes },
  { id: 'hospitals', label: 'Hospitals', icon: Hospital },
  { id: 'network', label: 'Network', icon: Network },
  { id: 'optimization', label: 'Optimization', icon: Settings2, group: 'OPERATIONS' },
  { id: 'emergency', label: 'Emergency simulation', icon: Siren },
  { id: 'demo', label: 'Demo mode', icon: PlayCircle },
  { id: 'donor-network', label: 'Donor Network', icon: UserRoundPlus, group: 'COORDINATION' },
  { id: 'emergency-requests', label: 'Emergency Blood Request', icon: ClipboardPlus },
  { id: 'coordination', label: 'Collection & transport', icon: Truck },
  { id: 'results', label: 'Results', icon: FileClock, group: 'RESEARCH' },
  { id: 'about', label: 'About / methodology', icon: FlaskConical },
];

const TITLES = Object.fromEntries(NAV_ITEMS.map(({ id, label }) => [id, label]));

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('bloodflow-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [optimizationLoading, setOptimizationLoading] = useState(false);
  const [optimizationError, setOptimizationError] = useState('');
  const [coordinationDemo, setCoordinationDemo] = useState(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('bloodflow-theme', theme); } catch { /* Storage may be unavailable in private browsing. */ }
  }, [theme]);

  const startCoordinationDemo = async () => {
    const state = await api.startEmergencyRequestDemo();
    setCoordinationDemo(state);
    return state;
  };

  const advanceCoordinationDemo = async (action, donorId = null) => {
    if (!coordinationDemo) throw new Error('Start the synthetic request before advancing its workflow.');
    const updated = await api.advanceEmergencyRequestDemo(coordinationDemo.action_log || [], action, donorId);
    setCoordinationDemo(updated);
    return updated;
  };

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const runQuickOptimization = async () => {
    setPage('optimization'); setOptimizationLoading(true); setOptimizationError('');
    try { setOptimizationResult(await api.optimize({ method: 'greedy' })); }
    catch (issue) { setOptimizationError(issue.message || 'Optimization could not be completed.'); }
    finally { setOptimizationLoading(false); }
  };

  const navigate = (target) => { setPage(target); setSidebarOpen(false); };
  const renderPage = () => {
    switch (page) {
      case 'blood-banks': return <BloodBanks />;
      case 'hospitals': return <Hospitals />;
      case 'network': return <NetworkPage />;
      case 'optimization': return <Optimization initialRun={optimizationResult} initialLoading={optimizationLoading} initialError={optimizationError} onNavigate={navigate} />;
      case 'emergency': return <EmergencySimulation />;
      case 'demo': return <DemoMode />;
      case 'donor-network': return <DonorNetwork demoState={coordinationDemo} onStartDemo={startCoordinationDemo} onDemoAction={advanceCoordinationDemo} />;
      case 'emergency-requests': return <EmergencyRequests demoState={coordinationDemo} onStartDemo={startCoordinationDemo} onDemoAction={advanceCoordinationDemo} />;
      case 'coordination': return <Coordination demoState={coordinationDemo} onDemoAction={advanceCoordinationDemo} onNavigate={navigate} />;
      case 'results': return <Results />;
      case 'about': return <About />;
      default: return <Dashboard onNavigate={navigate} onOptimization={runQuickOptimization} />;
    }
  };

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside id="primary-navigation" className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label="Main navigation">
      <div className="brand-lockup"><span className="brand-symbol"><HeartPulse size={20} strokeWidth={2.2} /></span><span className="brand-name">BloodFlow<span>-Q</span><small>LOGISTICS RESEARCH</small></span><button className="mobile-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
      <div className="workspace-select"><span className="workspace-avatar">BF</span><span><strong>Research workspace</strong><small>Synthetic environment</small></span><ChevronDown size={15} /></div>
      <nav className="main-nav">{NAV_ITEMS.map((item, index) => <div key={item.id}>{item.group && <div className={`nav-section-label ${index ? 'nav-section-spaced' : ''}`}>{item.group}</div>}<button className={`nav-link ${page === item.id ? 'nav-link-active' : ''}`} aria-current={page === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><item.icon size={17} strokeWidth={1.9} /><span>{item.label}</span>{item.id === 'emergency' && <span className="nav-live-dot" title="Synthetic event simulator" />}</button></div>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-status"><span className="status-dot" /><span><strong>Prototype mode</strong><small>Operational research only</small></span></div><div className="sidebar-disclaimer"><AlertTriangle size={13} /> Not for clinical decisions</div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <button className="mobile-menu" aria-label="Open navigation" aria-controls="primary-navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
        <div className="breadcrumbs" aria-label="Breadcrumb"><span>BloodFlow-Q</span><span className="breadcrumb-slash" aria-hidden="true">/</span><strong aria-current="page">{TITLES[page] || 'Dashboard'}</strong></div>
        <div className="topbar-right">
          <AlertCenter onNavigate={navigate} onOptimization={runQuickOptimization} />
          <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <span className="environment-pill"><i aria-hidden="true" />Synthetic data</span>
          <span className="topbar-divider" />
          <div className="user-chip"><span aria-hidden="true">R</span><strong>Researcher</strong></div>
        </div>
      </header>
      <main className="page-content" id="main-content"><div className="page-container"><Suspense fallback={<LoadingState label="Loading coordination tools…" />}>{renderPage()}</Suspense></div></main>
      <footer className="app-footer"><span><Activity size={13} /> BloodFlow-Q research prototype</span><span>Aggregate logistics model <i /> Synthetic data only</span></footer>
    </div>
    <Chatbot
      currentPage={page}
      currentTheme={theme}
      onNavigate={navigate}
      onOptimization={runQuickOptimization}
      onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    />
  </div>;
}
