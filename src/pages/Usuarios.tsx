import { useEffect, useState, type FormEvent } from 'react'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { authSecundaria, db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import type { Rol } from '../contexts/AuthContext'
import './Usuarios.css'

type UsuarioRow = { uid: string; rol: Rol; correo?: string; empleadoId?: string }
type Empleado = { id: string; nombre: string; activo?: boolean }

export default function Usuarios() {
  const { rol: miRol } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [correo, setCorreo] = useState('')
  const [rolNuevo, setRolNuevo] = useState<Rol>('empleado')
  const [empleadoIdNuevo, setEmpleadoIdNuevo] = useState('')
  const [creando, setCreando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), (snap) => {
      setUsuarios(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UsuarioRow, 'uid'>) })))
    })
    const unsub2 = onSnapshot(query(collection(db, 'empleados'), orderBy('nombre')), (snap) => {
      setEmpleados(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Empleado, 'id'>) })))
    })
    return () => {
      unsub()
      unsub2()
    }
  }, [])

  const empleadoIdsVinculados = new Set(usuarios.map((u) => u.empleadoId).filter(Boolean))

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
        ...(empleadoIdNuevo ? { empleadoId: empleadoIdNuevo } : {}),
      })
      await signOut(authSecundaria)
      setMensaje({ tipo: 'ok', texto: `Cuenta creada para ${correoLimpio}. Su clave para entrar es su mismo correo.` })
      setCorreo('')
      setRolNuevo('empleado')
      setEmpleadoIdNuevo('')
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

  async function cambiarEmpleadoVinculado(uid: string, empleadoId: string) {
    await setDoc(doc(db, 'usuarios', uid), { empleadoId: empleadoId || null }, { merge: true })
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
        <div>
          <label>Empleado vinculado (opcional)</label>
          <select value={empleadoIdNuevo} onChange={(e) => setEmpleadoIdNuevo(e.target.value)}>
            <option value="">— Ninguno —</option>
            {empleados.map((emp) => (
              <option key={emp.id} value={emp.id} disabled={empleadoIdsVinculados.has(emp.id)}>
                {emp.nombre}{emp.activo === false ? ' (inactivo)' : ''}{empleadoIdsVinculados.has(emp.id) ? ' — ya vinculado' : ''}
              </option>
            ))}
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
                <th>Empleado vinculado</th>
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
                  <td>
                    <select
                      value={u.empleadoId || ''}
                      onChange={(e) => cambiarEmpleadoVinculado(u.uid, e.target.value)}
                    >
                      <option value="">— Ninguno —</option>
                      {empleados.map((emp) => (
                        <option
                          key={emp.id}
                          value={emp.id}
                          disabled={empleadoIdsVinculados.has(emp.id) && u.empleadoId !== emp.id}
                        >
                          {emp.nombre}{emp.activo === false ? ' (inactivo)' : ''}
                        </option>
                      ))}
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
        hace falta: siempre es el mismo correo. Vincular una cuenta con su empleado hace que el reloj
        marcador de Asistencia sepa automaticamente quien es, sin tener que elegir su nombre de una
        lista (asi nadie puede marcar por otra persona).
      </p>
    </div>
  )
}
