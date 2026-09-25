import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

export type Rol = 'admin' | 'coordinador' | 'empleado'

type AuthState = {
  user: User | null
  rol: Rol | null
  empleadoId: string | null
  cargando: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [rol, setRol] = useState<Rol | null>(null)
  const [empleadoId, setEmpleadoId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          // Datos guardados en Firestore: usuarios/{uid} -> { rol, empleadoId? }
          // empleadoId vincula esta cuenta con su registro en empleados/{id},
          // para que el reloj marcador sepa automaticamente quien es sin
          // tener que elegir el nombre de una lista.
          const snap = await getDoc(doc(db, 'usuarios', u.uid))
          const data = snap.exists() ? snap.data() : null
          setRol((data?.rol ?? 'empleado') as Rol)
          setEmpleadoId((data?.empleadoId as string) ?? null)
        } catch {
          setRol('empleado')
          setEmpleadoId(null)
        }
      } else {
        setRol(null)
        setEmpleadoId(null)
      }
      setCargando(false)
    })
    return unsub
  }, [])

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, rol, empleadoId, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
