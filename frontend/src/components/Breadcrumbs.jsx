import { NAV_BY_ID, NAV_GROUP_BY_ID } from '../navigation';

export default function Breadcrumbs({ page, onNavigate }) {
  if (page === 'home') return null;
  const route = NAV_BY_ID[page];
  const group = route && NAV_GROUP_BY_ID[route.group];
  if (!route || !group) return <nav className="breadcrumbs" aria-label="Breadcrumb"><span>Workspace</span><span className="breadcrumb-slash" aria-hidden="true">/</span><strong aria-current="page">Page not found</strong></nav>;
  const groupIsCurrent = page === group.landing;
  return <nav className="breadcrumbs" aria-label="Breadcrumb">
    {groupIsCurrent
      ? <strong aria-current="page">{group.label} / {route.label}</strong>
      : <><button type="button" className="breadcrumb-link" onClick={() => onNavigate(group.landing)}>{group.label}</button><span className="breadcrumb-slash" aria-hidden="true">/</span><strong aria-current="page">{route.label}</strong></>}
  </nav>;
}
