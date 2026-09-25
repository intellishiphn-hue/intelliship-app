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
import './Buzon.css'

const CATEGORIAS = ['Sugerencia', 'Queja', 'Felicitacion', 'Problema tecnico', 'Otro']

type Estado = 'nuevo' | 'revisado' | 'archivado'

type Reporte = {
  id: string
  nombre: string
  categoria: string
  mensaje: string
  estado: Estado
  fecha: string
  fechaActualizado: string
  notaInterna: string
}

const hoy = () => new Date().toISOString().slice(0, 10)

const ESTADO_LABEL: Record<Estado, string> = {
  nuevo: 'Nuevo',
  revisado: 'Revisado',
  archivado: 'Archivado',
}

export default function Buzon() {
  const { user, empleadoId, rol } = useAuth()
  const puedeVerBandeja = rol === 'admin' || rol === 'coordinador'
  const esAdmin = rol === 'admin'

  const [empleados, setEmpleados] = useState<{ id: string; nombre: string }[]>([])
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [cargando, setCargando] = useState(puedeVerBandeja)
  const [error, setError] = useState<string | null>(null)

  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const [filtro, setFiltro] = useState<'nuevo' | 'revisado' | 'archivado' | 'todos'>('nuevo')
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    if (!puedeVerBandeja) return
    const unsub1 = onSnapshot(collection(db, 'empleados'), (snap) => {
      setEmpleados(snap.docs.map((d) => ({ id: d.id, nombre: (d.data() as { nombre?: string }).nombre || '' })))
    })
    const unsub2 = onSnapshot(
      query(collection(db, 'buzon'), orderBy('fecha', 'desc')),
      (snap) => {
        setReportes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reporte, 'id'>) })))
        setCargando(false)
      },
      (err) => {
        console.error(err)
        setError('No se pudo cargar la bandeja de reportes.')
        setCargando(false)
      }
    )
    return () => {
      unsub1()
      unsub2()
    }
  }, [puedeVerBandeja])

  const miNombre = useMemo(() => {
    if (empleadoId) {
      const emp = empleados.find((e) => e.id === empleadoId)
      if (emp?.nombre) return emp.nombre
    }
    return user?.email || 'Anonimo'
  }, [empleadoId, empleados, user])

  async function enviarReporte(e: FormEvent) {
    e.preventDefault()
    if (!mensaje.trim()) return
    setEnviando(true)
    try {
      await addDoc(collection(db, 'buzon'), {
        nombre: miNombre,
        categoria,
        mensaje: mensaje.trim(),
        estado: 'nuevo',
        fecha: hoy(),
        fechaActualizado: hoy(),
        notaInterna: '',
      })
      setMensaje('')
      setCategoria(CATEGORIAS[0])
      setEnviado(true)
      setTimeout(() => setEnviado(false), 5000)
    } catch (err) {
      console.error(err)
      setError('No se pudo enviar el reporte. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const visibles = filtro === 'todos' ? reportes : reportes.filter((r) => r.estado === filtro)
  const conteo = (estado: Estado) => reportes.filter((r) => r.estado === estado).length

  return (
    <div className="buz-page">
      <div className="buz-head">
        <h1>Buzon Intelliship</h1>
        <p>Te escuchamos — cualquier sugerencia, queja o reporte llega directo a la gerencia.</p>
      </div>

      {error && <div className="buz-error">{error}</div>}

      <form className="buz-form" onSubmit={enviarReporte}>
        <div className="buz-form-grid">
          <div>
            <label>Categoria</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label>Tu mensaje *</label>
        <textarea
          className="buz-textarea"
          rows={4}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Contanos que pasa, que sugerencia tenes, o que necesitas..."
          required
        />
        <div className="buz-form-footer">
          <span className="buz-como">Se enviara como: {miNombre}</span>
          <button className="btn-primary" type="submit" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar reporte'}
          </button>
        </div>
        {enviado && <p className="buz-confirmacion">✓ ¡Gracias! Tu reporte fue enviado.</p>}
      </form>

      {puedeVerBandeja && (
        <>
          <div className="buz-tabs">
            <button className={filtro === 'nuevo' ? 'buz-tab buz-tab-activo' : 'buz-tab'} onClick={() => setFiltro('nuevo')}>
              Nuevos ({conteo('nuevo')})
            </button>
            <button className={filtro === 'revisado' ? 'buz-tab buz-tab-activo' : 'buz-tab'} onClick={() => setFiltro('revisado')}>
              Revisados ({conteo('revisado')})
            </button>
            <button className={filtro === 'archivado' ? 'buz-tab buz-tab-activo' : 'buz-tab'} onClick={() => setFiltro('archivado')}>
              Archivados ({conteo('archivado')})
            </button>
            <button className={filtro === 'todos' ? 'buz-tab buz-tab-activo' : 'buz-tab'} onClick={() => setFiltro('todos')}>
              Todos ({reportes.length})
            </button>
          </div>

          <div className="buz-lista">
            {cargando ? (
              <div className="empty-state">Cargando...</div>
            ) : visibles.length === 0 ? (
              <div className="empty-state">
                <div className="empty-emoji">📭</div>
                <div>No hay reportes en esta vista</div>
              </div>
            ) : (
              visibles.map((r) => (
                <FilaReporte
                  key={r.id}
                  reporte={r}
                  expandido={expandido === r.id}
                  onToggle={() => setExpandido(expandido === r.id ? null : r.id)}
                  esAdmin={esAdmin}
                  setError={setError}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

function FilaReporte({
  reporte,
  expandido,
  onToggle,
  esAdmin,
  setError,
}: {
  reporte: Reporte
  expandido: boolean
  onToggle: () => void
  esAdmin: boolean
  setError: (e: string | null) => void
}) {
  const [nota, setNota] = useState(reporte.notaInterna || '')
  const [guardandoNota, setGuardandoNota] = useState(false)

  async function cambiarEstado(estado: Estado) {
    try {
      await updateDoc(doc(db, 'buzon', reporte.id), { estado, fechaActualizado: hoy() })
    } catch (err) {
      console.error(err)
      setError('No se pudo actualizar el reporte.')
    }
  }

  async function guardarNota() {
    setGuardandoNota(true)
    try {
      await updateDoc(doc(db, 'buzon', reporte.id), { notaInterna: nota })
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar la nota.')
    } finally {
      setGuardandoNota(false)
    }
  }

  async function eliminar() {
    if (!confirm('¿Eliminar este reporte? Esta accion no se puede deshacer.')) return
    try {
      await deleteDoc(doc(db, 'buzon', reporte.id))
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el reporte.')
    }
  }

  return (
    <div className={'buz-fila-card' + (expandido ? ' buz-fila-abierta' : '')}>
      <button className="buz-fila-head" onClick={onToggle}>
        <span className={'buz-badge buz-badge-' + reporte.estado}>{ESTADO_LABEL[reporte.estado]}</span>
        <span className="buz-fila-categoria">{reporte.categoria}</span>
        <span className="buz-fila-nombre">{reporte.nombre}</span>
        <span className="buz-fila-fecha">{reporte.fecha}</span>
      </button>

      {expandido && (
        <div className="buz-fila-body">
          <p className="buz-mensaje">{reporte.mensaje}</p>

          <label className="buz-nota-label">Nota interna (no la ve quien reporto)</label>
          <textarea
            className="buz-textarea buz-nota"
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />

          <div className="buz-fila-acciones">
            <button className="buz-btn-secundario" onClick={guardarNota} disabled={guardandoNota}>
              {guardandoNota ? 'Guardando...' : 'Guardar nota'}
            </button>
            {reporte.estado !== 'revisado' && (
              <button className="buz-btn-secundario" onClick={() => cambiarEstado('revisado')}>
                Marcar revisado
              </button>
            )}
            {reporte.estado !== 'archivado' && (
              <button className="buz-btn-secundario" onClick={() => cambiarEstado('archivado')}>
                Archivar
              </button>
            )}
            {reporte.estado === 'archivado' && (
              <button className="buz-btn-secundario" onClick={() => cambiarEstado('nuevo')}>
                Reabrir
              </button>
            )}
            {esAdmin && (
              <button className="buz-del" onClick={eliminar} title="Eliminar">
                ✕ Eliminar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
