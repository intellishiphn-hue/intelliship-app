import { useEffect, useState, type FormEvent } from 'react'
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
import './EnvioGuias.css'

type Envio = {
  id: string
  nombre: string
  telefono: string
  empresa: string
  guia: string
  link: string
  estado: string
  fecha: string
}

const ESTADOS = ['En camino', 'Entregado', 'Con problema']

const hoy = () => new Date().toISOString().slice(0, 10)

const VACIO = { nombre: '', telefono: '', empresa: 'Cargo Expreso', guia: '', link: '', fecha: hoy() }

export default function EnvioGuias() {
  const { rol } = useAuth()
  const esAdmin = rol === 'admin'
  const [envios, setEnvios] = useState<Envio[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'cargoExpreso'), orderBy('fecha', 'desc')),
      (snap) => {
        setEnvios(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Envio, 'id'>) })))
        setCargando(false)
      },
      (err) => {
        console.error(err)
        setError('No se pudo cargar el historial de guias.')
        setCargando(false)
      }
    )
    return unsub
  }, [])

  async function guardarEnvio(e: FormEvent) {
    e.preventDefault()
    if (!form.nombre || !form.guia) return
    setGuardando(true)
    try {
      await addDoc(collection(db, 'cargoExpreso'), {
        nombre: form.nombre,
        telefono: form.telefono,
        empresa: form.empresa,
        guia: form.guia,
        link: form.link,
        fecha: form.fecha,
        estado: 'En camino',
      })
      setForm(VACIO)
      setMostrarForm(false)
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar el envio.')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(id: string, estado: string) {
    try {
      await updateDoc(doc(db, 'cargoExpreso', id), { estado })
    } catch (err) {
      console.error(err)
      setError('No se pudo actualizar el estado.')
    }
  }

  async function eliminarEnvio(id: string) {
    if (!confirm('¿Eliminar este envio? Esta accion no se puede deshacer.')) return
    try {
      await deleteDoc(doc(db, 'cargoExpreso', id))
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el envio.')
    }
  }

  const filtrados = busqueda
    ? envios.filter(
        (e) =>
          e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          e.guia.toLowerCase().includes(busqueda.toLowerCase())
      )
    : envios

  return (
    <div className="eg-page">
      <div className="eg-head">
        <div>
          <h1>Envio de guias</h1>
          <p>{envios.length} guia{envios.length === 1 ? '' : 's'} registrada{envios.length === 1 ? '' : 's'}</p>
        </div>
        <button className="btn-primary" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Nueva guia'}
        </button>
      </div>

      {error && <div className="eg-error">{error}</div>}

      {mostrarForm && (
        <form className="eg-form" onSubmit={guardarEnvio}>
          <div className="eg-form-grid">
            <div>
              <label>Cliente *</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required autoFocus />
            </div>
            <div>
              <label>Telefono</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <label>Empresa</label>
              <input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
            </div>
            <div>
              <label>No. de guia *</label>
              <input value={form.guia} onChange={(e) => setForm({ ...form, guia: e.target.value })} required />
            </div>
            <div className="eg-form-link">
              <label>Link de rastreo</label>
              <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <label>Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar guia'}
          </button>
        </form>
      )}

      <div className="eg-card">
        <div className="eg-card-titulo-row">
          <div className="eg-card-titulo">Historial</div>
          <input
            className="eg-buscador"
            placeholder="Buscar por cliente o guia..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        {cargando ? (
          <div className="empty-state">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🚚</div>
            <div>Todavia no hay guias registradas</div>
          </div>
        ) : (
          <table className="eg-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Empresa</th>
                <th>Guia</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => (
                <tr key={e.id}>
                  <td className="eg-nombre">{e.nombre}</td>
                  <td>{e.empresa}</td>
                  <td>
                    {e.link ? (
                      <a href={e.link} target="_blank" rel="noreferrer" className="eg-link">
                        {e.guia} ↗
                      </a>
                    ) : (
                      e.guia
                    )}
                  </td>
                  <td>{e.fecha}</td>
                  <td>
                    <select
                      className={'eg-estado eg-estado-' + e.estado.replace(/\s+/g, '-').toLowerCase()}
                      value={e.estado}
                      onChange={(ev) => cambiarEstado(e.id, ev.target.value)}
                    >
                      {ESTADOS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {esAdmin && (
                      <button className="eg-del" onClick={() => eliminarEnvio(e.id)} title="Eliminar">
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
