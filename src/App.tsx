import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Dashboard from './pages/Dashboard'
import Placeholder from './pages/Placeholder'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Topbar />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/buzon" element={<Placeholder title="Buzon Intelliship" />} />
            <Route path="/guias" element={<Placeholder title="Envio de guias" />} />
            <Route path="/guias-nacionales" element={<Placeholder title="Guias nacionales" />} />
            <Route path="/bodega" element={<Placeholder title="Bodega" />} />
            <Route path="/carga-china" element={<Placeholder title="Carga China" />} />
            <Route path="/personal" element={<Placeholder title="Personal" />} />
            <Route path="/asistencia" element={<Placeholder title="Asistencia" />} />
            <Route path="/vacaciones" element={<Placeholder title="Permisos y vacaciones" />} />
            <Route path="/documentos" element={<Placeholder title="Documentos" />} />
            <Route path="/nomina" element={<Placeholder title="Nomina / Planilla" />} />
            <Route path="/pagos" element={<Placeholder title="Pagos" />} />
            <Route path="/reportes" element={<Placeholder title="Reportes" />} />
            <Route path="/administracion" element={<Placeholder title="Administracion" />} />
            <Route path="/configuracion" element={<Placeholder title="Configuracion" />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
