import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import './Bodega.css'

type Servicio = 'EXPRESS' | 'AEREO' | 'MARITIMO' | 'OTRO'

type Pedido = {
  id: string
  nombre: string
  telefono: string
  servicio: Servicio
  cantidad: number
  fechaPedido: string
  empacado: boolean
  fechaEmpacado: string | null
}

const SERVICIOS: { value: Servicio; label: string }[] = [
  { value: 'EXPRESS', label: 'Express' },
  { value: 'AEREO', label: 'Aereo' },
  { value: 'MARITIMO', label: 'Maritimo' },
  { value: 'OTRO', label: 'Otro' },
]

const SERVICIO_LABEL: Record<string, string> = Object.fromEntries(
  SERVICIOS.map((s) => [s.value, s.label])
)

const hoy = () => new Date().toISOString().slice(0, 10)

const VACIO = { nombre: '', telefono: '', servicio: 'EXPRESS' as Servicio, cantidad: '1', fechaPedido: hoy() }

export default function Bodega() {
  const { rol } = useAuth()
  const esAdmin = rol === 'admin'
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [filtro, setFiltro] = useState<'pendientes' | 'empacados' | 'todos'>('pendientes')

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'bodega'), orderBy('fechaPedido', 'desc')),
      (snap) => {
        setPedidos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Pedido, 'id'>) })))
        setCargando(false)
      },
      (err) => {
        console.error(err)
        setError('No se pudo cargar la bodega.')
        setCargando(false)
      }
    )
    return unsub
  }, [])

  async function guardarPedido(e: FormEvent) {
    e.preventDefault()
    if (!form.nombre || !form.telefono) return
    setGuardando(true)
    try {
      await addDoc(collection(db, 'bodega'), {
        nombre: form.nombre,
        telefono: form.telefono,
        servicio: form.servicio,
        cantidad: Number(form.cantidad) || 1,
        fechaPedido: form.fechaPedido,
        empacado: false,
        fechaEmpacado: null,
      })
      setForm(VACIO)
      setMostrarForm(false)
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar el pedido.')
    } finally {
      setGuardando(false)
    }
  }

  async function marcarEmpacado(id: string) {
    try {
      await updateDoc(doc(db, 'bodega', id), { empacado: true, fechaEmpacado: hoy() })
    } catch (err) {
      console.error(err)
      setError('No se pudo actualizar el pedido.')
    }
  }

  async function desmarcarEmpacado(id: string) {
    try {
      await updateDoc(doc(db, 'bodega', id), { empacado: false, fechaEmpacado: null })
    } catch (err) {
      console.error(err)
      setError('No se pudo actualizar el pedido.')
    }
  }

  async function eliminarPedido(id: string) {
    if (!confirm('¿Eliminar este pedido de bodega? Esta accion no se puede deshacer.')) return
    try {
      await deleteDoc(doc(db, 'bodega', id))
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el pedido.')
    }
  }

  const pendientes = useMemo(() => pedidos.filter((p) => !p.empacado), [pedidos])
  const empacados = useMemo(() => pedidos.filter((p) => p.empacado), [pedidos])
  const visibles = filtro === 'pendientes' ? pendientes : filtro === 'empacados' ? empacados : pedidos

  return (
    <div className="bod-page">
      <div className="bod-head">
        <div>
          <h1>Bodega</h1>
          <p>
            {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'} · {empacados.length} empacado
            {empacados.length === 1 ? '' : 's'}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo pedido'}
        </button>
      </div>

      {error && <div className="bod-error">{error}</div>}

      {mostrarForm && (
        <form className="bod-form" onSubmit={guardarPedido}>
          <div className="bod-form-grid">
            <div>
              <label>Nombre del cliente *</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <label>Telefono *</label>
              <input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                required
              />
            </div>
            <div>
              <label>Servicio</label>
              <select
                value={form.servicio}
                onChange={(e) => setForm({ ...form, servicio: e.target.value as Servicio })}
              >
                {SERVICIOS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Cantidad</label>
              <input
                type="number"
                min={1}
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
              />
            </div>
            <div>
              <label>Fecha del pedido</label>
              <input
                type="date"
                value={form.fechaPedido}
                onChange={(e) => setForm({ ...form, fechaPedido: e.target.value })}
              />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar pedido'}
          </button>
        </form>
      )}

      <div className="bod-tabs">
        <button className={filtro === 'pendientes' ? 'bod-tab bod-tab-activo' : 'bod-tab'} onClick={() => setFiltro('pendientes')}>
          Pendientes ({pendientes.length})
        </button>
        <button className={filtro === 'empacados' ? 'bod-tab bod-tab-activo' : 'bod-tab'} onClick={() => setFiltro('empacados')}>
          Empacados ({empacados.length})
        </button>
        <button className={filtro === 'todos' ? 'bod-tab bod-tab-activo' : 'bod-tab'} onClick={() => setFiltro('todos')}>
          Todos ({pedidos.length})
        </button>
      </div>

      <div className="bod-card">
        {cargando ? (
          <div className="empty-state">Cargando...</div>
        ) : visibles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">📦</div>
            <div>No hay pedidos en esta vista</div>
          </div>
        ) : (
          <table className="bod-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefono</th>
                <th>Servicio</th>
                <th>Cantidad</th>
                <th>Fecha pedido</th>
                <th>Fecha empacado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id}>
                  <td className="bod-nombre">{p.nombre}</td>
                  <td>{p.telefono}</td>
                  <td>
                    <span className={'bod-tag bod-tag-' + p.servicio.toLowerCase()}>
                      {SERVICIO_LABEL[p.servicio] || p.servicio}
                    </span>
                  </td>
                  <td>{p.cantidad}</td>
                  <td>{p.fechaPedido}</td>
                  <td>{p.fechaEmpacado || '—'}</td>
                  <td className="bod-acciones">
                    {p.empacado ? (
                      <button className="bod-btn-secundario" onClick={() => desmarcarEmpacado(p.id)}>
                        Reabrir
                      </button>
                    ) : (
                      <button className="bod-btn-ok" onClick={() => marcarEmpacado(p.id)}>
                        ✓ Empacado
                      </button>
                    )}
                    {esAdmin && (
                      <button className="bod-del" onClick={() => eliminarPedido(p.id)} title="Eliminar">
                        ✕
                      </button>
                    )}
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
