export default function PageHeader({ eyebrow, title, description, action }) {
  return <header className="page-header">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
    {action && <div className="page-header-action">{action}</div>}
  </header>;
}
