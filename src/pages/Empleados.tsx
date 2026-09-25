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
  apodo: string
  puesto: string
  departamento: string
  correo: string
  telefono: string
  direccion: string
  estadoCivil: string
  genero: string
  fechaNacimiento: string
  fechaIngreso: string
  contactoEmergencia: string
  activo: boolean
}

const VACIO = {
  nombre: '',
  apodo: '',
  puesto: '',
  departamento: '',
  correo: '',
  telefono: '',
  direccion: '',
  estadoCivil: '',
  genero: '',
  fechaNacimiento: '',
  fechaIngreso: '',
  contactoEmergencia: '',
}

function CeldaConfidencial({ empleadoId }: { empleadoId: string }) {
  const [salario, setSalario] = useState('')
  const [cedula, setCedula] = useState('')
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    const ref = doc(db, 'empleados', empleadoId, 'confidencial', 'datos')
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data()
      setSalario(snap.exists() ? String(data?.salarioBase ?? '') : '')
      setCedula(snap.exists() ? String(data?.cedula ?? '') : '')
      setCargado(true)
    })
    return unsub
  }, [empleadoId])

  async function guardarSalario() {
    const ref = doc(db, 'empleados', empleadoId, 'confidencial', 'datos')
    await setDoc(ref, { salarioBase: Number(salario) || 0 }, { merge: true })
  }

  async function guardarCedula() {
    const ref = doc(db, 'empleados', empleadoId, 'confidencial', 'datos')
    await setDoc(ref, { cedula }, { merge: true })
  }

  if (!cargado) return null

  return (
    <>
      <td>
        <input
          className="emp-salario-input"
          value={cedula}
          placeholder="Cedula"
          onChange={(e) => setCedula(e.target.value)}
          onBlur={guardarCedula}
        />
      </td>
      <td>
        <input
          className="emp-salario-input"
          type="number"
          value={salario}
          placeholder="L 0.00"
          onChange={(e) => setSalario(e.target.value)}
          onBlur={guardarSalario}
        />
      </td>
    </>
  )
}

export default function Empleados() {
  const { rol } = useAuth()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)

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

  function abrirNuevo() {
    setForm(VACIO)
    setEditandoId(null)
    setMostrarForm(true)
  }

  function abrirEdicion(emp: Empleado) {
    setForm({
      nombre: emp.nombre || '',
      apodo: emp.apodo || '',
      puesto: emp.puesto || '',
      departamento: emp.departamento || '',
      correo: emp.correo || '',
      telefono: emp.telefono || '',
      direccion: emp.direccion || '',
      estadoCivil: emp.estadoCivil || '',
      genero: emp.genero || '',
      fechaNacimiento: emp.fechaNacimiento || '',
      fechaIngreso: emp.fechaIngreso || '',
      contactoEmergencia: emp.contactoEmergencia || '',
    })
    setEditandoId(emp.id)
    setMostrarForm(true)
  }

  function cerrarForm() {
    setMostrarForm(false)
    setEditandoId(null)
    setForm(VACIO)
  }

  async function guardarForm(e: FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setGuardando(true)
    try {
      if (editandoId) {
        await setDoc(doc(db, 'empleados', editandoId), { ...form }, { merge: true })
      } else {
        await addDoc(collection(db, 'empleados'), {
          ...form,
          activo: true,
          creadoEl: serverTimestamp(),
        })
      }
      cerrarForm()
    } catch (err) {
      console.error(err)
      setError(editandoId ? 'No se pudo guardar los cambios.' : 'No se pudo guardar el empleado.')
    } finally {
      setGuardando(false)
    }
  }

  async function alternarActivo(emp: Empleado) {
    const estaActivo = emp.activo !== false
    const confirmado = estaActivo
      ? confirm(`Marcar a ${emp.nombre} como inactivo (ya no trabaja). Su informacion se conserva, solo se mueve a la lista de inactivos. ¿Continuar?`)
      : confirm(`Reactivar a ${emp.nombre}. ¿Continuar?`)
    if (!confirmado) return
    try {
      await setDoc(doc(db, 'empleados', emp.id), { activo: !estaActivo }, { merge: true })
    } catch (err) {
      console.error(err)
      setError('No se pudo actualizar el estado del empleado.')
    }
  }

  async function eliminarEmpleado(id: string, nombre: string) {
    if (!confirm(`Eliminar definitivamente a ${nombre}. Esta accion no se puede deshacer y se pierde toda su informacion. Si solo ya no trabaja aqui, usa "Marcar inactivo" en vez de esto. ¿Eliminar de todas formas?`)) return
    try {
      await deleteDoc(doc(db, 'empleados', id))
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el empleado.')
    }
  }

  const esAdmin = rol === 'admin'
  const activos = empleados.filter((e) => e.activo !== false)
  const inactivos = empleados.filter((e) => e.activo === false)

  function filaDetalle(emp: Empleado) {
    if (expandido !== emp.id) return null
    const cols = 7 + (esAdmin ? 2 : 0) + 1
    return (
      <tr className="emp-detalle-row" key={emp.id + '-detalle'}>
        <td colSpan={cols}>
          <div className="emp-detalle-grid">
            {emp.apodo && <div><strong>Apodo:</strong> {emp.apodo}</div>}
            {emp.direccion && <div><strong>Direccion:</strong> {emp.direccion}</div>}
            {emp.estadoCivil && <div><strong>Estado civil:</strong> {emp.estadoCivil}</div>}
            {emp.genero && <div><strong>Genero:</strong> {emp.genero}</div>}
            {emp.fechaNacimiento && <div><strong>Nacimiento:</strong> {emp.fechaNacimiento}</div>}
            {emp.contactoEmergencia && <div><strong>Contacto de emergencia:</strong> {emp.contactoEmergencia}</div>}
            {emp.activo === false && <div className="emp-inactivo-tag">Inactivo</div>}
          </div>
        </td>
      </tr>
    )
  }

  function tabla(lista: Empleado[]) {
    return (
      <table className="emp-table">
        <thead>
          <tr>
            <th></th>
            <th>Nombre</th>
            <th>Puesto</th>
            <th>Departamento</th>
            <th>Correo</th>
            <th>Telefono</th>
            <th>Ingreso</th>
            {esAdmin && <th>Cedula</th>}
            {esAdmin && <th>Salario base</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lista.map((emp) => (
            <>
              <tr key={emp.id}>
                <td>
                  <button
                    className="emp-expand-btn"
                    onClick={() => setExpandido(expandido === emp.id ? null : emp.id)}
                    title="Ver mas"
                  >
                    {expandido === emp.id ? '▾' : '▸'}
                  </button>
                </td>
                <td className="emp-nombre">{emp.nombre}</td>
                <td>{emp.puesto || '—'}</td>
                <td>{emp.departamento || '—'}</td>
                <td>{emp.correo || '—'}</td>
                <td>{emp.telefono || '—'}</td>
                <td>{emp.fechaIngreso || '—'}</td>
                {esAdmin && <CeldaConfidencial empleadoId={emp.id} />}
                <td>
                  <div className="emp-row-actions">
                    <button className="emp-edit" onClick={() => abrirEdicion(emp)} title="Editar">
                      ✎
                    </button>
                    <button
                      className="emp-toggle"
                      onClick={() => alternarActivo(emp)}
                      title={emp.activo === false ? 'Reactivar' : 'Marcar inactivo (ya no trabaja)'}
                    >
                      {emp.activo === false ? '↺' : '⏻'}
                    </button>
                    {esAdmin && (
                      <button className="emp-del" onClick={() => eliminarEmpleado(emp.id, emp.nombre)} title="Eliminar definitivamente">
                        ✕
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              {filaDetalle(emp)}
            </>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="emp-page">
      <div className="emp-head">
        <div>
          <h1>Empleados</h1>
          <p>{activos.length} {activos.length === 1 ? 'empleado activo' : 'empleados activos'}{inactivos.length > 0 ? ` · ${inactivos.length} inactivo${inactivos.length === 1 ? '' : 's'}` : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => (mostrarForm ? cerrarForm() : abrirNuevo())}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo empleado'}
        </button>
      </div>

      {error && <div className="emp-error">{error}</div>}

      {mostrarForm && (
        <form className="emp-form" onSubmit={guardarForm}>
          {editandoId && <div className="emp-form-editando">Editando informacion de {form.nombre || 'empleado'}</div>}
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
              <label>Apodo / nombre usual</label>
              <input
                value={form.apodo}
                onChange={(e) => setForm({ ...form, apodo: e.target.value })}
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
              <label>Departamento</label>
              <input
                value={form.departamento}
                onChange={(e) => setForm({ ...form, departamento: e.target.value })}
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
              <label>Direccion</label>
              <input
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              />
            </div>
            <div>
              <label>Estado civil</label>
              <input
                value={form.estadoCivil}
                onChange={(e) => setForm({ ...form, estadoCivil: e.target.value })}
              />
            </div>
            <div>
              <label>Genero</label>
              <input
                value={form.genero}
                onChange={(e) => setForm({ ...form, genero: e.target.value })}
              />
            </div>
            <div>
              <label>Fecha de nacimiento</label>
              <input
                type="date"
                value={form.fechaNacimiento}
                onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })}
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
            <div>
              <label>Contacto de emergencia</label>
              <input
                value={form.contactoEmergencia}
                onChange={(e) => setForm({ ...form, contactoEmergencia: e.target.value })}
              />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Guardar empleado'}
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
          <>
            {tabla(activos)}
            {inactivos.length > 0 && (
              <div className="emp-inactivos-section">
                <div className="emp-inactivos-label">Inactivos ({inactivos.length})</div>
                {tabla(inactivos)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
