import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Login.css'

export default function Login() {
  const { login, user, cargando: cargandoSesion } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  // Si ya hay una sesion activa (login exitoso o sesion previa), manda al panel.
  if (!cargandoSesion && user) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      await login(email.trim(), password)
    } catch {
      setError('Correo o contrasena incorrectos.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-logo">IS</div>
        <h1>INTELLISHIP</h1>
        <p className="login-sub">Inicia sesion en el panel unificado</p>

        <label className="login-label">Correo</label>
        <input
          className="login-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@intelliship.hn"
          required
          autoFocus
        />

        <label className="login-label">Contrasena</label>
        <input
          className="login-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          required
        />

        {error && <div className="login-error">{error}</div>}

        <button className="login-btn" type="submit" disabled={cargando}>
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
