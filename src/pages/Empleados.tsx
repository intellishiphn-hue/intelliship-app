import { useEffect, useState, type FormEvent } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import './Empleados.css'

type Empleado = {
  id: string
  nombre: string
  puesto: string
  correo: string
  telefono: string
  fechaIngreso: string
  activo: boolean
}

const VACIO = { nombre: '', puesto: '', correo: '', telefono: '', fechaIngreso: '' }

function CeldaSalario({ empleadoId }: { empleadoId: string }) {
  const [salario, setSalario] = useState('')
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    const ref = doc(db, 'empleados', empleadoId, 'confidencial', 'datos')
    const unsub = onSnapshot(ref, (snap) => {
      setSalario(snap.exists() ? String(snap.data().salarioBase ?? '') : '')
      setCargado(true)
    })
    return unsub
  }, [empleadoId])

  async function guardar() {
    const ref = doc(db, 'empleados', empleadoId, 'confidencial', 'datos')
    await setDoc(ref, { salarioBase: Number(salario) || 0 }, { merge: true })
  }

  if (!cargado) return null

  return (
    <input
      className="emp-salario-input"
      type="number"
      value={salario}
      placeholder="L 0.00"
      onChange={(e) => setSalario(e.target.value)}
      onBlur={guardar}
    />
  )
}

export default function Empleados() {
  const { rol } = useAuth()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'empleados'), orderBy('nombre'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEmpleados(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Empleado, 'id'>) })))
        setCargando(false)
      },
      (err) => {
        console.error(err)
        setError('No se pudo cargar la lista de empleados.')
        setCargando(false)
      }
    )
    return unsub
  }, [])

  async function agregarEmpleado(e: FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setGuardando(true)
    try {
      await addDoc(collection(db, 'empleados'), {
        ...form,
        activo: true,
        creadoEl: serverTimestamp(),
      })
      setForm(VACIO)
      setMostrarForm(false)
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar el empleado.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarEmpleado(id: string) {
    if (!confirm('¿Eliminar este empleado? Esta accion no se puede deshacer.')) return
    try {
      await deleteDoc(doc(db, 'empleados', id))
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el empleado.')
    }
  }

  const esAdmin = rol === 'admin'

  return (
    <div className="emp-page">
      <div className="emp-head">
        <div>
          <h1>Empleados</h1>
          <p>{empleados.length} {empleados.length === 1 ? 'empleado registrado' : 'empleados registrados'}</p>
        </div>
        <button className="btn-primary" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo empleado'}
        </button>
      </div>

      {error && <div className="emp-error">{error}</div>}

      {mostrarForm && (
        <form className="emp-form" onSubmit={agregarEmpleado}>
          <div className="emp-form-grid">
            <div>
              <label>Nombre completo</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <label>Puesto</label>
              <input
                value={form.puesto}
                onChange={(e) => setForm({ ...form, puesto: e.target.value })}
              />
            </div>
            <div>
              <label>Correo</label>
              <input
                type="email"
                value={form.correo}
                onChange={(e) => setForm({ ...form, correo: e.target.value })}
              />
            </div>
            <div>
              <label>Telefono</label>
              <input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </div>
            <div>
              <label>Fecha de ingreso</label>
              <input
                type="date"
                value={form.fechaIngreso}
                onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
              />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar empleado'}
          </button>
        </form>
      )}

      <div className="emp-card">
        {cargando ? (
          <div className="empty-state">Cargando...</div>
        ) : empleados.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">👥</div>
            <div>Todavia no hay empleados registrados</div>
          </div>
        ) : (
          <table className="emp-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Puesto</th>
                <th>Correo</th>
                <th>Telefono</th>
                <th>Ingreso</th>
                {esAdmin && <th>Salario base</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {empleados.map((emp) => (
                <tr key={emp.id}>
                  <td className="emp-nombre">{emp.nombre}</td>
                  <td>{emp.puesto || '—'}</td>
                  <td>{emp.correo || '—'}</td>
                  <td>{emp.telefono || '—'}</td>
                  <td>{emp.fechaIngreso || '—'}</td>
                  {esAdmin && (
                    <td>
                      <CeldaSalario empleadoId={emp.id} />
                    </td>
                  )}
                  <td>
                    <button className="emp-del" onClick={() => eliminarEmpleado(emp.id)} title="Eliminar">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
