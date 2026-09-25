import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import RutaProtegida from './components/auth/RutaProtegida'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Dashboard from './pages/Dashboard'
import Placeholder from './pages/Placeholder'
import Bodega from './pages/Bodega'
import GuiasNacionales from './pages/GuiasNacionales'
import EnvioGuias from './pages/EnvioGuias'
import CargaChina from './pages/CargaChina'
import Documentos from './pages/Documentos'
import Login from './pages/Login'
import Empleados from './pages/Empleados'
import Usuarios from './pages/Usuarios'
import Vacaciones from './pages/Vacaciones'
import Pagos from './pages/Pagos'
import Asistencia from './pages/Asistencia'

function PanelLayout({ children }: { children: React.ReactNode }) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  return (
    <RutaProtegida>
      <div className="app-shell">
        <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Topbar onAbrirMenu={() => setMenuAbierto(true)} />
          {children}
        </div>
      </div>
    </RutaProtegida>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PanelLayout><Dashboard /></PanelLayout>} />
          <Route path="/buzon" element={<PanelLayout><Placeholder title="Buzon Intelliship" /></PanelLayout>} />
          <Route path="/guias" element={<PanelLayout><EnvioGuias /></PanelLayout>} />
          <Route path="/guias-nacionales" element={<PanelLayout><GuiasNacionales /></PanelLayout>} />
          <Route path="/bodega" element={<PanelLayout><Bodega /></PanelLayout>} />
          <Route path="/carga-china" element={<PanelLayout><CargaChina /></PanelLayout>} />
          <Route path="/personal" element={<PanelLayout><Empleados /></PanelLayout>} />
          <Route path="/asistencia" element={<PanelLayout><Asistencia /></PanelLayout>} />
          <Route path="/vacaciones" element={<PanelLayout><Vacaciones /></PanelLayout>} />
          <Route path="/documentos" element={<PanelLayout><Documentos /></PanelLayout>} />
          <Route path="/nomina" element={<PanelLayout><Pagos /></PanelLayout>} />
          <Route path="/pagos" element={<PanelLayout><Pagos /></PanelLayout>} />
          <Route path="/reportes" element={<PanelLayout><Placeholder title="Reportes" /></PanelLayout>} />
          <Route path="/administracion" element={<PanelLayout><Placeholder title="Administracion" /></PanelLayout>} />
          <Route path="/usuarios" element={<PanelLayout><Usuarios /></PanelLayout>} />
          <Route path="/configuracion" element={<PanelLayout><Placeholder title="Configuracion" /></PanelLayout>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
