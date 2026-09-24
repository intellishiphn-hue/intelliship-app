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
  cargando: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [rol, setRol] = useState<Rol | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          // Rol guardado en Firestore: usuarios/{uid} -> { rol: 'admin' | 'coordinador' | 'empleado' }
          const snap = await getDoc(doc(db, 'usuarios', u.uid))
          setRol((snap.exists() ? snap.data().rol : 'empleado') as Rol)
        } catch {
          setRol('empleado')
        }
      } else {
        setRol(null)
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
    <AuthContext.Provider value={{ user, rol, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
