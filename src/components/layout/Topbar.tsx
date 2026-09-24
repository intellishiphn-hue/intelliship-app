import { useAuth } from '../../contexts/AuthContext'
import './Topbar.css'

const ROL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  coordinador: 'Coordinador',
  empleado: 'Empleado',
}

export default function Topbar() {
  const { user, rol, logout } = useAuth()
  const inicial = (user?.email ?? '?').charAt(0).toUpperCase()

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
        <div className="tb-avatar">{inicial}</div>
        <div>
          <div className="tb-user-name">{user?.email ?? ''}</div>
          <div className="tb-user-role">{rol ? ROL_LABEL[rol] ?? rol : ''}</div>
        </div>
        <button className="tb-logout" onClick={() => logout()} title="Cerrar sesion">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </header>
  )
}
