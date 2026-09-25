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
import './Pagos.css'

type Empleado = { id: string; nombre: string; activo?: boolean }

type Pago = {
  id: string
  empleadoId: string
  periodo: string
  mes: string
  montoNeto: number
  notas: string
  fechaRegistro: string
}

const PERIODOS = ['1ra Quincena', '2da Quincena']

const VACIO = { empleadoId: '', periodo: '1ra Quincena', mes: '', montoNeto: '', notas: '' }

function mesActual() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}

export default function Pagos() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ ...VACIO, mes: mesActual() })
  const [guardando, setGuardando] = useState(false)
  const [filtroEmpleado, setFiltroEmpleado] = useState('')

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, 'empleados'), orderBy('nombre')), (snap) => {
      setEmpleados(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Empleado, 'id'>) })))
    })
    const unsub2 = onSnapshot(
      query(collection(db, 'pagos'), orderBy('fechaRegistro', 'desc')),
      (snap) => {
        setPagos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Pago, 'id'>) })))
        setCargando(false)
      },
      (err) => {
        console.error(err)
        setError('No se pudo cargar el historial de pagos.')
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

  async function guardarPago(e: FormEvent) {
    e.preventDefault()
    if (!form.empleadoId || !form.mes || !form.montoNeto) return
    setGuardando(true)
    try {
      await addDoc(collection(db, 'pagos'), {
        empleadoId: form.empleadoId,
        periodo: form.periodo,
        mes: form.mes,
        montoNeto: Number(form.montoNeto) || 0,
        notas: form.notas,
        fechaRegistro: new Date().toISOString().slice(0, 10),
      })
      setForm({ ...VACIO, mes: form.mes })
      setMostrarForm(false)
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar el pago.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarPago(id: string) {
    if (!confirm('¿Eliminar este pago? Esta accion no se puede deshacer.')) return
    try {
      await deleteDoc(doc(db, 'pagos', id))
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el pago.')
    }
  }

  const pagosFiltrados = filtroEmpleado ? pagos.filter((p) => p.empleadoId === filtroEmpleado) : pagos
  const totalFiltrado = pagosFiltrados.reduce((sum, p) => sum + (p.montoNeto || 0), 0)

  return (
    <div className="pag-page">
      <div className="pag-head">
        <div>
          <h1>Nómina / Pagos</h1>
          <p>
            {pagos.length} {pagos.length === 1 ? 'pago registrado' : 'pagos registrados'}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Registrar pago'}
        </button>
      </div>

      {error && <div className="pag-error">{error}</div>}

      <p className="pag-nota-futuro">
        Por ahora este módulo registra el monto neto por quincena (igual que "Registrar Pago" del
        sistema anterior). El desglose completo (salario base, horas extra, IHSS, RAP, etc.), subir
        comprobante del banco, y la carga masiva por Excel de Planilla se agregan más adelante.
      </p>

      {mostrarForm && (
        <form className="pag-form" onSubmit={guardarPago}>
          <div className="pag-form-grid">
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
              <label>Periodo</label>
              <select value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })}>
                {PERIODOS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Mes *</label>
              <input
                type="month"
                value={form.mes}
                onChange={(e) => setForm({ ...form, mes: e.target.value })}
                required
              />
            </div>
            <div>
              <label>Monto neto (Lps) *</label>
              <input
                type="number"
                step="0.01"
                value={form.montoNeto}
                onChange={(e) => setForm({ ...form, montoNeto: e.target.value })}
                required
              />
            </div>
            <div className="pag-form-notas">
              <label>Notas</label>
              <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar pago'}
          </button>
        </form>
      )}

      <div className="pag-card">
        <div className="pag-card-titulo-row">
          <div className="pag-card-titulo">
            Historial{filtroEmpleado ? ` — Total: L. ${totalFiltrado.toLocaleString('es-HN', { minimumFractionDigits: 2 })}` : ''}
          </div>
          <select
            className="pag-filtro"
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
        ) : pagosFiltrados.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">💰</div>
            <div>Todavia no hay pagos registrados</div>
          </div>
        ) : (
          <table className="pag-table">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Mes</th>
                <th>Periodo</th>
                <th>Monto neto</th>
                <th>Notas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.map((p) => (
                <tr key={p.id}>
                  <td className="pag-nombre">{nombrePorId[p.empleadoId] || p.empleadoId}</td>
                  <td>{p.mes}</td>
                  <td>{p.periodo}</td>
                  <td className="pag-monto">L. {(p.montoNeto || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}</td>
                  <td>{p.notas || '—'}</td>
                  <td>
                    <button className="pag-del" onClick={() => eliminarPago(p.id)} title="Eliminar">
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
