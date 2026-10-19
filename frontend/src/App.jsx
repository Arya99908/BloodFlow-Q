import { lazy, Suspense, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { api } from './services/api';
import LoadingState from './components/Feedback';
import AlertCenter from './components/AlertCenter';
import Chatbot from './components/Chatbot';
import Dock from './components/Dock';
import SquishSwitch from './components/SquishSwitch';
import Breadcrumbs from './components/Breadcrumbs';
import { NAV_GROUPS, NAV_ITEMS, NAV_BY_ID, PAGE_TITLES, resolveRoute, routePath } from './navigation';

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BloodBanks = lazy(() => import('./pages/BloodBanks'));
const Hospitals = lazy(() => import('./pages/Hospitals'));
const NetworkPage = lazy(() => import('./pages/Network'));
const Optimization = lazy(() => import('./pages/Optimization'));
const EmergencySimulation = lazy(() => import('./pages/EmergencySimulation'));
const Results = lazy(() => import('./pages/Results'));
const About = lazy(() => import('./pages/About'));
const DemoMode = lazy(() => import('./pages/DemoMode'));
const Flow = lazy(() => import('./pages/Flow'));

// The private coordination module includes an optional auth client. Load it
// only when a user opens those pages so the public research dashboard stays
// light and usable when no private database is configured.
const DonorNetwork = lazy(() => import('./pages/DonorNetwork'));
const EmergencyRequests = lazy(() => import('./pages/EmergencyRequests'));
const Coordination = lazy(() => import('./pages/Coordination'));

const DOCK_ITEMS = [
  { ...NAV_BY_ID.home },
  ...NAV_GROUPS.map(group => ({
    id: group.id,
    label: group.label,
    icon: group.id === 'workspace' ? NAV_BY_ID.dashboard.icon : group.items[0].icon,
    active: false,
    menu: group.items.filter(item => item.id !== 'home').map(item => ({ ...item, icon: <item.icon size={15} /> })),
    onClick: () => {},
  })),
];

export default function App() {
  const [page, setPage] = useState(() => resolveRoute());
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('bloodflow-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [optimizationLoading, setOptimizationLoading] = useState(false);
  const [optimizationError, setOptimizationError] = useState('');
  const [toast, setToast] = useState(null);
  const [coordinationDemo, setCoordinationDemo] = useState(null);
  const [welcome, setWelcome] = useState(() => {
    try { return !localStorage.getItem('bloodflow-welcome-v2001-complete'); } catch { return false; }
  });
  useEffect(() => {
    const onPopState = () => {
      setPage(resolveRoute());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('bloodflow-theme', theme); } catch { /* Storage may be unavailable in private browsing. */ }
  }, [theme]);

  useEffect(() => {
    const label = PAGE_TITLES[page] || 'Page not found';
    document.title = `${label} | BloodFlow-Q`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = `${label} for BloodFlow-Q synthetic blood logistics and quantum optimization research.`;
    const canonical = document.querySelector('link[rel="canonical"]');
    const pageUrl = window.location.origin + window.location.pathname;
    if (canonical) canonical.href = pageUrl;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = `${label} | BloodFlow-Q`;
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription && description) ogDescription.content = description.content;
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.content = `${window.location.origin}/bloodflow-q-social.png`;
    let breadcrumbData = document.querySelector('#bloodflow-breadcrumb-data');
    if (!breadcrumbData) { breadcrumbData = document.createElement('script'); breadcrumbData.id = 'bloodflow-breadcrumb-data'; breadcrumbData.type = 'application/ld+json'; document.head.appendChild(breadcrumbData); }
    breadcrumbData.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'BloodFlow-Q', item: pageUrl }, { '@type': 'ListItem', position: 2, name: label, item: pageUrl }] });
  }, [page]);

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

  const runQuickOptimization = async () => {
    setPage('optimization'); setOptimizationLoading(true); setOptimizationError('');
    try { setOptimizationResult(await api.optimize({ method: 'greedy' })); setToast({ kind: 'success', message: 'Optimization completed. Results are ready to review.' }); }
    catch (issue) { setOptimizationError(issue.message || 'Optimization could not be completed.'); setToast({ kind: 'error', message: issue.message || 'Optimization could not be completed.' }); }
    finally { setOptimizationLoading(false); }
    window.setTimeout(() => setToast(null), 5000);
  };

  const navigate = (target) => {
    if (target === page || (target !== 'not-found' && !NAV_BY_ID[target])) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    window.history.pushState({}, '', routePath(target));
    setPage(target);
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };
  const renderPage = () => {
    switch (page) {
      case 'home': return <Home onNavigate={navigate} />;
      case 'flow': return <Flow onNavigate={navigate} />;
      case 'dashboard': return <Dashboard onNavigate={navigate} onOptimization={runQuickOptimization} theme={theme} />;
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
      case 'not-found': return <section className="not-found panel"><span className="eyebrow">404 · PAGE NOT FOUND</span><h1>This route isn’t in the research workspace.</h1><p>Return to the BloodFlow-Q home page to continue exploring.</p><button className="button button-primary" onClick={() => navigate('home')}>Back to home</button></section>;
      default: return <Home onNavigate={navigate} />;
    }
  };

  return <div className="app-shell">
    {toast && <div className={`app-toast app-toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}><span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification">×</button></div>}
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <div className="main-shell">
      <header className="topbar">
        <a className="topbar-brand" href="/" onClick={(e) => { e.preventDefault(); navigate('home'); }}>
          <img src="/bloodflow-q-logo.webp" alt="" />
          <span>BloodFlow<span>-Q</span></span>
        </a>
        <Breadcrumbs page={page} onNavigate={navigate} />
        <div className="topbar-right">
          <AlertCenter onNavigate={navigate} onOptimization={runQuickOptimization} />
          <label className="theme-toggle theme-switch">
            <SquishSwitch checked={theme === 'dark'} onChange={(checked) => setTheme(checked ? 'dark' : 'light')} ariaLabel="Toggle dark theme" trackColor="var(--text-muted)" trackOnColor="var(--primary)" thumbColor="var(--bg-canvas)" thumbOnColor="var(--bg-canvas)" width={58} height={30} stretch={22} />
            <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </label>
          <span className="environment-pill"><i aria-hidden="true" />Synthetic data</span>
        </div>
      </header>
      <main className="page-content" id="main-content"><div key={page} className={`page-container page-enter page-${page}`}><Suspense fallback={<LoadingState label={`Loading ${PAGE_TITLES[page]?.toLowerCase() || 'page'}…`} />}>{renderPage()}</Suspense></div></main>
      {page !== 'home' && <footer className="app-footer"><span><Activity size={13} /> BloodFlow-Q</span><span>Aggregate logistics model <i /> Synthetic data only <i /> Not for clinical decisions</span><span className="footer-build">Research workspace</span></footer>}
    </div>
    <Dock className="bloodflow-dock" position="bottom" theme={theme} baseItemSize={32} magnification={39} panelHeight={48} gap={7} autoHide={false} accentColor="var(--primary)" showLabels={true} items={DOCK_ITEMS.map((item) => {
      if (item.menu) return { ...item, icon:<item.icon size={19}/>, active:page !== 'home' && NAV_GROUPS.find(group => group.items.some(route => route.id === page))?.id === item.id, menu:item.menu.map(route => ({ ...route, active:page===route.id, onClick:()=>navigate(route.id,{viaDock:true}) })) };
      return { ...item, icon:<item.icon size={19}/>, active:page===item.id, onClick:()=>navigate(item.id,{viaDock:true}) };
    })} style={{position:'fixed',bottom:12,zIndex:60}} />
    {welcome && <div className="welcome-backdrop"><section className="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><button type="button" className="dialog-close" aria-label="Dismiss welcome message" onClick={() => { try { localStorage.setItem('bloodflow-welcome-v2001-complete', 'true'); } catch {} setWelcome(false); }}>×</button><img src="/bloodflow-q-logo.webp" alt="" /><div className="eyebrow">SYNTHETIC RESEARCH WORKSPACE</div><h1 id="welcome-title">Welcome to BloodFlow-Q</h1><p>Explore the network, run an allocation method, and inspect its measured result. All scenario data is synthetic.</p><button type="button" className="button button-primary" onClick={() => { try { localStorage.setItem('bloodflow-welcome-v2001-complete', 'true'); } catch {} setWelcome(false); navigate('dashboard'); }}>Open dashboard</button></section></div>}
    <Chatbot currentPage={page} currentTheme={theme} onNavigate={navigate} onOptimization={runQuickOptimization} onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
  </div>;
}
