import { useEffect, useState, type FormEvent } from 'react'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { authSecundaria, db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import type { Rol } from '../contexts/AuthContext'
import './Usuarios.css'

type UsuarioRow = { uid: string; rol: Rol; correo?: string }

export default function Usuarios() {
  const { rol: miRol } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [correo, setCorreo] = useState('')
  const [rolNuevo, setRolNuevo] = useState<Rol>('empleado')
  const [creando, setCreando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), (snap) => {
      setUsuarios(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UsuarioRow, 'uid'>) })))
    })
    return unsub
  }, [])

  async function crearUsuario(e: FormEvent) {
    e.preventDefault()
    setMensaje(null)
    const correoLimpio = correo.trim().toLowerCase()
    if (!correoLimpio) return
    setCreando(true)
    try {
      // La clave inicial es el propio correo (decision del negocio).
      const cred = await createUserWithEmailAndPassword(authSecundaria, correoLimpio, correoLimpio)
      await setDoc(doc(db, 'usuarios', cred.user.uid), {
        rol: rolNuevo,
        correo: correoLimpio,
      })
      await signOut(authSecundaria)
      setMensaje({ tipo: 'ok', texto: `Cuenta creada para ${correoLimpio}. Su clave para entrar es su mismo correo.` })
      setCorreo('')
      setRolNuevo('empleado')
    } catch (err: unknown) {
      const codigo = (err as { code?: string })?.code
      const texto =
        codigo === 'auth/email-already-in-use'
          ? 'Ese correo ya tiene una cuenta creada.'
          : codigo === 'auth/invalid-email'
          ? 'Ese correo no es valido.'
          : 'No se pudo crear la cuenta.'
      setMensaje({ tipo: 'error', texto })
    } finally {
      setCreando(false)
    }
  }

  async function cambiarRol(uid: string, nuevoRol: Rol) {
    await setDoc(doc(db, 'usuarios', uid), { rol: nuevoRol }, { merge: true })
  }

  if (miRol !== 'admin') {
    return (
      <div className="usr-page">
        <div className="empty-state">Solo el Administrador puede ver esta seccion.</div>
      </div>
    )
  }

  return (
    <div className="usr-page">
      <div className="usr-head">
        <div>
          <h1>Usuarios</h1>
          <p>Cuentas de acceso al panel y su rol</p>
        </div>
      </div>

      <form className="usr-form" onSubmit={crearUsuario}>
        <div>
          <label>Correo del nuevo usuario</label>
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="nombre@intelliship.hn"
            required
          />
        </div>
        <div>
          <label>Rol</label>
          <select value={rolNuevo} onChange={(e) => setRolNuevo(e.target.value as Rol)}>
            <option value="empleado">Empleado</option>
            <option value="coordinador">Coordinador</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <button className="btn-primary" type="submit" disabled={creando}>
          {creando ? 'Creando...' : '+ Crear usuario'}
        </button>
      </form>

      {mensaje && <div className={`usr-msg usr-msg-${mensaje.tipo}`}>{mensaje.texto}</div>}

      <div className="usr-card">
        {usuarios.length === 0 ? (
          <div className="empty-state">Todavia no hay usuarios creados desde aqui</div>
        ) : (
          <table className="usr-table">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Rol</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.uid}>
                  <td>{u.correo || u.uid}</td>
                  <td>
                    <select value={u.rol} onChange={(e) => cambiarRol(u.uid, e.target.value as Rol)}>
                      <option value="empleado">Empleado</option>
                      <option value="coordinador">Coordinador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="usr-nota">
        La clave de cada usuario es su propio correo. No hay opcion de "olvide mi clave" porque no
        hace falta: siempre es el mismo correo.
      </p>
    </div>
  )
}
