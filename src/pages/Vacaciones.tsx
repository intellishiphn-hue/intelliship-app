import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { diasHabiles } from '../lib/fechas'
import { calcularSaldo } from '../lib/vacaciones'
import './Vacaciones.css'

type Empleado = { id: string; nombre: string; activo?: boolean; fechaIngreso?: string }

type Registro = {
  id: string
  empleadoId: string
  tipo: string
  fechaInicio: string
  fechaFin: string
  diasHabiles: number
  notas: string
  fechaRegistro: string
  tieneAdjuntoPendiente?: boolean
}

const TIPOS: { value: string; label: string }[] = [
  { value: 'vacaciones', label: '🌴 Vacaciones' },
  { value: 'permiso_justificado', label: '📋 Permiso Justificado' },
  { value: 'falta_justificada', label: '✅ Falta Justificada' },
  { value: 'falta_no_justificada', label: '❌ Falta No Justificada' },
]

const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.value, t.label]))

const VACIO = { empleadoId: '', tipo: 'vacaciones', fechaInicio: '', fechaFin: '', notas: '' }

export default function Vacaciones() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [filtroEmpleado, setFiltroEmpleado] = useState('')

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, 'empleados'), orderBy('nombre')), (snap) => {
      setEmpleados(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Empleado, 'id'>) })))
    })
    const unsub2 = onSnapshot(
      query(collection(db, 'vacaciones'), orderBy('fechaInicio', 'desc')),
      (snap) => {
        setRegistros(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Registro, 'id'>) })))
        setCargando(false)
      },
      (err) => {
        console.error(err)
        setError('No se pudo cargar el historial de vacaciones y permisos.')
        setCargando(false)
      }
    )
    return () => {
      unsub1()
      unsub2()
    }
  }, [])

  const nombrePorId = useMemo(
    () => Object.fromEntries(empleados.map((e) => [e.id, e.nombre])),
    [empleados]
  )

  const diasCalculados =
    form.fechaInicio && form.fechaFin && form.fechaFin >= form.fechaInicio
      ? diasHabiles(form.fechaInicio, form.fechaFin)
      : 0

  async function guardarRegistro(e: FormEvent) {
    e.preventDefault()
    if (!form.empleadoId || !form.fechaInicio || !form.fechaFin) return
    setGuardando(true)
    try {
      await addDoc(collection(db, 'vacaciones'), {
        empleadoId: form.empleadoId,
        tipo: form.tipo,
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        diasHabiles: diasCalculados,
        notas: form.notas,
        fechaRegistro: new Date().toISOString().slice(0, 10),
      })
      setForm(VACIO)
      setMostrarForm(false)
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar el registro.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarRegistro(id: string) {
    if (!confirm('¿Eliminar este registro? Esta accion no se puede deshacer.')) return
    try {
      await deleteDoc(doc(db, 'vacaciones', id))
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el registro.')
    }
  }

  const activos = empleados.filter((e) => e.activo !== false)
  const saldos = activos.map((emp) => ({
    emp,
    saldo: calcularSaldo(
      emp.fechaIngreso || '',
      registros.filter((r) => r.empleadoId === emp.id)
    ),
  }))

  const registrosFiltrados = filtroEmpleado
    ? registros.filter((r) => r.empleadoId === filtroEmpleado)
    : registros

  return (
    <div className="vac-page">
      <div className="vac-head">
        <div>
          <h1>Permisos y vacaciones</h1>
          <p>
            {registros.length} {registros.length === 1 ? 'registro' : 'registros'} · tú registras
            directamente, sin flujo de aprobación
          </p>
        </div>
        <button className="btn-primary" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo registro'}
        </button>
      </div>

      {error && <div className="vac-error">{error}</div>}

      {mostrarForm && (
        <form className="vac-form" onSubmit={guardarRegistro}>
          <div className="vac-form-grid">
            <div>
              <label>Empleado *</label>
              <select
                value={form.empleadoId}
                onChange={(e) => setForm({ ...form, empleadoId: e.target.value })}
                required
                autoFocus
              >
                <option value="">Selecciona...</option>
                {empleados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Tipo *</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Fecha inicio *</label>
              <input
                type="date"
                value={form.fechaInicio}
                onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                required
              />
            </div>
            <div>
              <label>Fecha fin *</label>
              <input
                type="date"
                value={form.fechaFin}
                onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                required
              />
            </div>
            <div>
              <label>Dias habiles</label>
              <input value={diasCalculados} disabled />
            </div>
            <div className="vac-form-notas">
              <label>Notas</label>
              <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
            </div>
          </div>
          <p className="vac-form-nota-adjunto">
            📎 Adjuntar la hoja firmada y notificar por email a compañeros se agregan pronto — por ahora
            puedes anotarlo en Notas.
          </p>
          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar registro'}
          </button>
        </form>
      )}

      <div className="vac-card vac-saldos">
        <div className="vac-card-titulo">Saldo de vacaciones por empleado</div>
        <table className="vac-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Antigüedad</th>
              <th>Corresponden (este año)</th>
              <th>Usados</th>
              <th>Pendientes</th>
            </tr>
          </thead>
          <tbody>
            {saldos.map(({ emp, saldo }) => (
              <tr key={emp.id}>
                <td className="vac-nombre">{emp.nombre}</td>
                <td>{saldo.anios === 0 ? 'menos de 1 año' : `${saldo.anios} año${saldo.anios > 1 ? 's' : ''}`}</td>
                <td>{saldo.correspondientes}</td>
                <td>{saldo.usados}</td>
                <td className="vac-pendientes">{saldo.pendientes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="vac-card">
        <div className="vac-card-titulo-row">
          <div className="vac-card-titulo">Historial</div>
          <select
            className="vac-filtro"
            value={filtroEmpleado}
            onChange={(e) => setFiltroEmpleado(e.target.value)}
          >
            <option value="">Todos los empleados</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>
        {cargando ? (
          <div className="empty-state">Cargando...</div>
        ) : registrosFiltrados.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🌴</div>
            <div>Todavia no hay registros</div>
          </div>
        ) : (
          <table className="vac-table">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Tipo</th>
                <th>Fecha inicio</th>
                <th>Fecha fin</th>
                <th>Dias</th>
                <th>Notas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {registrosFiltrados.map((r) => (
                <tr key={r.id}>
                  <td className="vac-nombre">{nombrePorId[r.empleadoId] || r.empleadoId}</td>
                  <td>{TIPO_LABEL[r.tipo] || r.tipo}</td>
                  <td>{r.fechaInicio}</td>
                  <td>{r.fechaFin}</td>
                  <td>{r.diasHabiles}</td>
                  <td className="vac-notas">
                    {r.notas || '—'}
                    {r.tieneAdjuntoPendiente && (
                      <span className="vac-adjunto-tag" title="Tenia un documento adjunto en el sistema anterior, pendiente de subir">
                        📎 pendiente
                      </span>
                    )}
                  </td>
                  <td>
                    <button className="vac-del" onClick={() => eliminarRegistro(r.id)} title="Eliminar">
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
