import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import './Sidebar.css'

type NavItem = {
  to: string
  label: string
  icon: React.ReactNode
  badge?: string
}

type NavGroup = {
  label: string
  items: NavItem[]
}

function Icon(path: string) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'PRINCIPAL',
    items: [
      { to: '/', label: 'Dashboard', icon: Icon('M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z') },
      { to: '/buzon', label: 'Buzon Intelliship', icon: Icon('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z') },
    ],
  },
  {
    label: 'OPERACIONES',
    items: [
      { to: '/guias', label: 'Envio de guias', icon: Icon('M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z') },
      { to: '/guias-nacionales', label: 'Guias nacionales', icon: Icon('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M9 13h6M9 17h6') },
      { to: '/bodega', label: 'Bodega', icon: Icon('M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10') },
      { to: '/carga-china', label: 'Carga China', icon: Icon('M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12') },
    ],
  },
  {
    label: 'PERSONAL',
    items: [
      { to: '/personal', label: 'Empleados', icon: Icon('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75') },
      { to: '/asistencia', label: 'Asistencia', icon: Icon('M12 8v4l3 3M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z') },
      { to: '/vacaciones', label: 'Permisos y vacaciones', icon: Icon('M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z') },
      { to: '/documentos', label: 'Documentos', icon: Icon('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6') },
    ],
  },
  {
    label: 'NOMINA',
    items: [
      { to: '/nomina', label: 'Nomina / Planilla', icon: Icon('M2 9h20M6 15h1m3 0h5M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z') },
      { to: '/pagos', label: 'Pagos', icon: Icon('M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6') },
    ],
  },
  {
    label: 'GESTION',
    items: [
      { to: '/reportes', label: 'Reportes', icon: Icon('M3 3v18h18M18 17V9M13 17V5M8 17v-3') },
      { to: '/administracion', label: 'Administracion', icon: Icon('M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z'), badge: 'RRHH' },
      { to: '/configuracion', label: 'Configuracion', icon: Icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z') },
    ],
  },
]

const ROL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  coordinador: 'Coordinador',
  empleado: 'Empleado',
}

export default function Sidebar() {
  const { rol } = useAuth()
  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="sb-logo">IS</div>
        <div className="sb-brand-text">
          <div className="sb-brand-name">INTELLISHIP</div>
          <div className="sb-brand-sub">Panel unificado</div>
        </div>
      </div>

      <div className="sb-role">
        <span className="sb-role-dot" />
        {rol ? ROL_LABEL[rol] ?? rol : '...'}
      </div>

      <nav className="sb-nav">
        {NAV_GROUPS.map((group) => (
          <div className="sb-group" key={group.label}>
            <div className="sb-group-label">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'sb-item' + (isActive ? ' active' : '')}
                end={item.to === '/'}
              >
                <span className="sb-item-icon">{item.icon}</span>
                {item.label}
                {item.badge && <span className="sb-item-badge">{item.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sb-footer">
        <div className="sb-footer-status">
          <span className="sb-status-dot" />
          Sincronizado
        </div>
      </div>
    </aside>
  )
}
