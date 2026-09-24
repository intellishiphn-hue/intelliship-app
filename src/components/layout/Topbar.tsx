import './Topbar.css'

export default function Topbar() {
  return (
    <header className="tb">
      <div className="tb-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input placeholder="Buscar empleado, recibo, contenedor..." />
        <kbd>⌘K</kbd>
      </div>
      <div className="tb-user">
        <div className="tb-avatar">S</div>
        <div>
          <div className="tb-user-name">scasalvarez</div>
          <div className="tb-user-role">Administrador</div>
        </div>
      </div>
    </header>
  )
}
