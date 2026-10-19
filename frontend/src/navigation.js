import {
  Activity, Atom, Boxes, ClipboardPlus, FileChartColumn, FileClock,
  FlaskConical, Hospital, House, LayoutDashboard, Network, PlayCircle,
  Settings2, Siren, Truck, UserRoundPlus, Waypoints,
} from 'lucide-react';

// One route registry drives the page picker, dock, active state, title and breadcrumb.
export const NAV_GROUPS = [
  {
    id: 'workspace', label: 'Workspace', landing: 'home',
    items: [
      { id: 'home', label: 'Home', icon: House },
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'blood-banks', label: 'Blood banks', icon: Boxes },
      { id: 'hospitals', label: 'Hospitals', icon: Hospital },
      { id: 'network', label: 'Network', icon: Network },
    ],
  },
  {
    id: 'operations', label: 'Operations', landing: 'optimization',
    items: [
      { id: 'optimization', label: 'Optimization', icon: Settings2 },
      { id: 'emergency', label: 'Emergency simulation', icon: Siren },
      { id: 'demo', label: 'Demo mode', icon: PlayCircle },
    ],
  },
  {
    id: 'coordination', label: 'Coordination', landing: 'donor-network',
    items: [
      { id: 'donor-network', label: 'Donor Network', icon: UserRoundPlus },
      { id: 'emergency-requests', label: 'Emergency Blood Request', icon: ClipboardPlus },
      { id: 'coordination', label: 'Collection & transport', icon: Truck },
    ],
  },
  {
    id: 'research', label: 'Research', landing: 'results',
    items: [
      { id: 'results', label: 'Solver Lab', icon: FileClock },
      { id: 'reports', label: 'Experiment reports', icon: FileChartColumn },
      { id: 'quantum-lab', label: 'Quantum Optimization Lab', icon: Atom },
      { id: 'flow', label: 'How it works', icon: Waypoints },
      { id: 'about', label: 'About / methodology', icon: FlaskConical },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap(group => group.items.map(item => ({ ...item, group: group.id })));
export const NAV_BY_ID = Object.fromEntries(NAV_ITEMS.map(item => [item.id, item]));
export const NAV_GROUP_BY_ID = Object.fromEntries(NAV_GROUPS.map(group => [group.id, group]));
export const PAGE_TITLES = Object.fromEntries(NAV_ITEMS.map(({ id, label }) => [id, label]));

export function resolveRoute(pathname = window.location.pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return 'home';
  const id = decodeURIComponent(path.slice(1));
  return NAV_BY_ID[id] ? id : 'not-found';
}

export function routePath(id) {
  return id === 'home' ? '/' : `/${id}`;
}
