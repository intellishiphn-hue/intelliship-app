import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function RutaProtegida({ children }: { children: React.ReactNode }) {
  const { user, cargando } = useAuth()

  if (cargando) {
    return <div style={{ padding: 40, fontSize: 13.5, color: '#94a3b8' }}>Cargando...</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
