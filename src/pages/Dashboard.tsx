import './Dashboard.css'

type Kpi = {
  label: string
  value: string
  tone: 'blue' | 'green' | 'orange' | 'purple'
  icon: string
}

const KPIS: Kpi[] = [
  { label: 'Total empleados', value: '11', tone: 'blue', icon: '👥' },
  { label: 'Activos hoy', value: '9', tone: 'green', icon: '✅' },
  { label: 'Ausencias hoy', value: '1', tone: 'orange', icon: '⚠️' },
  { label: 'Vacaciones activas', value: '2', tone: 'purple', icon: '🌴' },
]

export default function Dashboard() {
  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <h1>Buenos dias, Sergio</h1>
          <p>jueves, 24 de septiembre &middot; Resumen de INTELLISHIP</p>
        </div>
        <div className="dash-actions">
          <button className="btn-ghost">Personalizar</button>
          <button className="btn-primary">+ Nuevo registro</button>
        </div>
      </div>

      <div className="quick-row">
        <button className="quick-btn quick-in">
          <span className="quick-btn-icon">→]</span>
          Marcar entrada
        </button>
        <button className="quick-btn quick-out">
          <span className="quick-btn-icon">[→</span>
          Marcar salida
        </button>
        <a className="quick-buzon" href="/buzon">
          <span className="quick-buzon-icon">💬</span>
          <div>
            <div className="quick-buzon-title">Buzon Intelliship</div>
            <div className="quick-buzon-sub">Te escuchamos — envia tu reporte</div>
          </div>
          <span className="quick-buzon-arrow">&rarr;</span>
        </a>
      </div>

      <div className="kpi-row">
        {KPIS.map((k) => (
          <div className="kpi-card" key={k.label}>
            <div className="kpi-top">
              <span className="kpi-label">{k.label}</span>
              <span className={`kpi-icon kpi-${k.tone}`}>{k.icon}</span>
            </div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Solicitudes pendientes</div>
              <div className="card-sub">Vacaciones y permisos por aprobar</div>
            </div>
            <a className="card-link" href="#">Ver todas &rarr;</a>
          </div>
          <div className="empty-state">
            <div className="empty-emoji">📭</div>
            <div>No hay solicitudes pendientes</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Cumpleanos proximos</div>
              <div className="card-sub">Este mes</div>
            </div>
            <a className="card-link" href="#">Ver &rarr;</a>
          </div>
          <div className="empty-state">
            <div className="empty-emoji">🎂</div>
            <div>Sin cumpleanos esta semana</div>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Nomina del periodo</div>
              <div className="card-sub">Quincena actual</div>
            </div>
          </div>
          <div className="stat-big green">L 0.00</div>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Documentacion pendiente</div>
              <div className="card-sub">Expedientes incompletos</div>
            </div>
          </div>
          <div className="stat-big orange">0</div>
        </div>
      </div>
    </div>
  )
}
