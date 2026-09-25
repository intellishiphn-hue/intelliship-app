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
  writeBatch,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import './CargaChina.css'

export const ESTADOS_CHINA = [
  'Recibido en bodega China',
  'Cargando Contenedor',
  'Contenedor cerrado / embarcado',
  'En espera de salida a transito por naviera',
  'En transito maritimo',
  'Llego a Honduras (aduana)',
  'Proceso de aduanas',
  'Listo para entrega',
  'Entregado al cliente',
]

type Cliente = {
  id: string
  casillero: string
  nombre: string
  telefono: string
  email: string
  etiquetaUrl?: string
  etiquetaNombreArchivo?: string
}

type HistorialItem = { estado: string; fecha: string }

type Contenedor = {
  id: string
  nombre: string
  estado: string
  fechaEstimada: string
  historialEstados: HistorialItem[]
}

type Recibo = {
  id: string
  clienteId: string
  contenedorId: string
  contenido: string
  cbm: string
  estado: string
  numeroWR?: string
  peso?: string
  pesoUnidad?: string
  medidas?: string
  facturaUrl?: string
  facturaNombreArchivo?: string
  packingUrl?: string
  packingNombreArchivo?: string
  fotoUrl?: string
  fotoNombreArchivo?: string
}

const hoy = () => new Date().toISOString().slice(0, 10)

type Tab = 'clientes' | 'contenedores' | 'recibos'

export default function CargaChina() {
  const { rol } = useAuth()
  const esAdmin = rol === 'admin'
  const [tab, setTab] = useState<Tab>('recibos')
  const [error, setError] = useState<string | null>(null)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [contenedores, setContenedores] = useState<Contenedor[]>([])
  const [recibos, setRecibos] = useState<Recibo[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const unsub1 = onSnapshot(
      query(collection(db, 'chinaClientes'), orderBy('nombre')),
      (snap) => setClientes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cliente, 'id'>) }))),
      (err) => {
        console.error(err)
        setError('No se pudo cargar los clientes.')
      }
    )
    const unsub2 = onSnapshot(
      query(collection(db, 'chinaContenedores'), orderBy('fechaEstimada', 'desc')),
      (snap) =>
        setContenedores(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contenedor, 'id'>) }))),
      (err) => {
        console.error(err)
        setError('No se pudo cargar los contenedores.')
      }
    )
    const unsub3 = onSnapshot(
      collection(db, 'chinaRecibos'),
      (snap) => {
        setRecibos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Recibo, 'id'>) })))
        setCargando(false)
      },
      (err) => {
        console.error(err)
        setError('No se pudo cargar los recibos.')
        setCargando(false)
      }
    )
    return () => {
      unsub1()
      unsub2()
      unsub3()
    }
  }, [])

  const clientePorId = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes])
  const contenedorPorId = useMemo(() => Object.fromEntries(contenedores.map((c) => [c.id, c])), [contenedores])

  return (
    <div className="cc-page">
      <div className="cc-head">
        <div>
          <h1>Carga China</h1>
          <p>
            {clientes.length} cliente{clientes.length === 1 ? '' : 's'} · {contenedores.length} contenedor
            {contenedores.length === 1 ? '' : 'es'} · {recibos.length} recibo{recibos.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {error && <div className="cc-error">{error}</div>}

      <div className="cc-tabs">
        <button className={tab === 'recibos' ? 'cc-tab cc-tab-activo' : 'cc-tab'} onClick={() => setTab('recibos')}>
          Recibos
        </button>
        <button className={tab === 'contenedores' ? 'cc-tab cc-tab-activo' : 'cc-tab'} onClick={() => setTab('contenedores')}>
          Contenedores
        </button>
        <button className={tab === 'clientes' ? 'cc-tab cc-tab-activo' : 'cc-tab'} onClick={() => setTab('clientes')}>
          Clientes
        </button>
      </div>

      {tab === 'clientes' && (
        <TabClientes clientes={clientes} esAdmin={esAdmin} setError={setError} />
      )}
      {tab === 'contenedores' && (
        <TabContenedores contenedores={contenedores} recibos={recibos} esAdmin={esAdmin} setError={setError} />
      )}
      {tab === 'recibos' && (
        <TabRecibos
          recibos={recibos}
          clientes={clientes}
          contenedores={contenedores}
          clientePorId={clientePorId}
          contenedorPorId={contenedorPorId}
          esAdmin={esAdmin}
          cargando={cargando}
          setError={setError}
        />
      )}
    </div>
  )
}

function TabClientes({
  clientes,
  esAdmin,
  setError,
}: {
  clientes: Cliente[]
  esAdmin: boolean
  setError: (e: string | null) => void
}) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const siguienteCasillero = `INTELL ${clientes.length + 1}`
  const [form, setForm] = useState({ casillero: siguienteCasillero, nombre: '', telefono: '', email: '' })
  const [etiqueta, setEtiqueta] = useState<File | null>(null)

  function abrirForm() {
    if (!mostrarForm) setForm((f) => ({ ...f, casillero: f.nombre ? f.casillero : siguienteCasillero }))
    setMostrarForm((v) => !v)
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!form.nombre || !form.casillero) return
    setGuardando(true)
    try {
      const docRef = await addDoc(collection(db, 'chinaClientes'), { ...form })
      if (etiqueta) {
        const path = `china/clientes/${docRef.id}/${Date.now()}_${etiqueta.name}`
        const storageRef = ref(storage, path)
        await uploadBytes(storageRef, etiqueta, { contentType: etiqueta.type || 'application/octet-stream' })
        const url = await getDownloadURL(storageRef)
        await updateDoc(doc(db, 'chinaClientes', docRef.id), { etiquetaUrl: url, etiquetaNombreArchivo: etiqueta.name })
      }
      setForm({ casillero: `INTELL ${clientes.length + 2}`, nombre: '', telefono: '', email: '' })
      setEtiqueta(null)
      setMostrarForm(false)
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar el cliente.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este cliente? Esta accion no se puede deshacer.')) return
    try {
      await deleteDoc(doc(db, 'chinaClientes', id))
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el cliente.')
    }
  }

  return (
    <div>
      <div className="cc-subhead">
        <div className="cc-subhead-titulo">Clientes con casillero</div>
        <button className="btn-primary" onClick={abrirForm}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo cliente'}
        </button>
      </div>

      {mostrarForm && (
        <form className="cc-form" onSubmit={guardar}>
          <div className="cc-form-grid">
            <div>
              <label>Casillero *</label>
              <input value={form.casillero} onChange={(e) => setForm({ ...form, casillero: e.target.value })} required autoFocus />
            </div>
            <div>
              <label>Nombre *</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div>
              <label>Telefono</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label>Etiqueta (PDF, opcional)</label>
              <input type="file" accept="application/pdf,image/*" onChange={(e) => setEtiqueta(e.target.files?.[0] || null)} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar cliente'}
          </button>
        </form>
      )}

      <div className="cc-card">
        {clientes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🧾</div>
            <div>Todavia no hay clientes con casillero</div>
          </div>
        ) : (
          <table className="cc-table">
            <thead>
              <tr>
                <th>Casillero</th>
                <th>Nombre</th>
                <th>Telefono</th>
                <th>Email</th>
                <th>Etiqueta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td className="cc-casillero">{c.casillero}</td>
                  <td className="cc-nombre">{c.nombre}</td>
                  <td>{c.telefono || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td>
                    {c.etiquetaUrl ? (
                      <a href={c.etiquetaUrl} target="_blank" rel="noreferrer">
                        Ver
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {esAdmin && (
                      <button className="cc-del" onClick={() => eliminar(c.id)} title="Eliminar">
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

function TabContenedores({
  contenedores,
  recibos,
  esAdmin,
  setError,
}: {
  contenedores: Contenedor[]
  recibos: Recibo[]
  esAdmin: boolean
  setError: (e: string | null) => void
}) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ nombre: '', fechaEstimada: '' })

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!form.nombre) return
    setGuardando(true)
    try {
      await addDoc(collection(db, 'chinaContenedores'), {
        nombre: form.nombre,
        estado: ESTADOS_CHINA[0],
        fechaEstimada: form.fechaEstimada,
        historialEstados: [{ estado: ESTADOS_CHINA[0], fecha: hoy() }],
      })
      setForm({ nombre: '', fechaEstimada: '' })
      setMostrarForm(false)
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar el contenedor.')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(cont: Contenedor, estado: string) {
    try {
      await updateDoc(doc(db, 'chinaContenedores', cont.id), {
        estado,
        historialEstados: [...(cont.historialEstados || []), { estado, fecha: hoy() }],
      })
    } catch (err) {
      console.error(err)
      setError('No se pudo actualizar el estado.')
    }
  }

  async function sincronizarRecibos(cont: Contenedor) {
    const reciborsDelContenedor = recibos.filter((r) => r.contenedorId === cont.id)
    if (reciborsDelContenedor.length === 0) return
    if (
      !confirm(
        `Esto va a poner el estado "${cont.estado}" en los ${reciborsDelContenedor.length} recibo(s) de este contenedor, y avisa por WhatsApp a cada cliente. ¿Continuar?`
      )
    )
      return
    try {
      const batch = writeBatch(db)
      reciborsDelContenedor.forEach((r) => {
        batch.update(doc(db, 'chinaRecibos', r.id), { estado: cont.estado })
      })
      await batch.commit()
    } catch (err) {
      console.error(err)
      setError('No se pudo sincronizar el estado a los recibos.')
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este contenedor? Esta accion no se puede deshacer.')) return
    try {
      await deleteDoc(doc(db, 'chinaContenedores', id))
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el contenedor.')
    }
  }

  return (
    <div>
      <div className="cc-subhead">
        <div className="cc-subhead-titulo">Contenedores</div>
        <button className="btn-primary" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo contenedor'}
        </button>
      </div>

      {mostrarForm && (
        <form className="cc-form" onSubmit={guardar}>
          <div className="cc-form-grid">
            <div>
              <label>Nombre *</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Contenedor finales de septiembre"
                required
                autoFocus
              />
            </div>
            <div>
              <label>Fecha estimada de llegada</label>
              <input type="date" value={form.fechaEstimada} onChange={(e) => setForm({ ...form, fechaEstimada: e.target.value })} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar contenedor'}
          </button>
        </form>
      )}

      {contenedores.length === 0 ? (
        <div className="cc-card">
          <div className="empty-state">
            <div className="empty-emoji">🚢</div>
            <div>Todavia no hay contenedores</div>
          </div>
        </div>
      ) : (
        <div className="cc-contenedores-grid">
          {contenedores.map((c) => (
            <div className="cc-contenedor-card" key={c.id}>
              <div className="cc-contenedor-head">
                <div className="cc-contenedor-nombre">{c.nombre}</div>
                {esAdmin && (
                  <button className="cc-del" onClick={() => eliminar(c.id)} title="Eliminar">
                    ✕
                  </button>
                )}
              </div>
              {c.fechaEstimada && <div className="cc-contenedor-fecha">Llegada estimada: {c.fechaEstimada}</div>}
              <label className="cc-contenedor-estado-label">Estado actual</label>
              <select className="cc-contenedor-estado" value={c.estado} onChange={(e) => cambiarEstado(c, e.target.value)}>
                {ESTADOS_CHINA.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
              <button
                className="cc-sync-btn"
                onClick={() => sincronizarRecibos(c)}
                disabled={!recibos.some((r) => r.contenedorId === c.id)}
                title="Aplica el estado actual a todos los recibos de este contenedor y avisa por WhatsApp a cada cliente"
              >
                📲 Aplicar estado a sus recibos y avisar por WhatsApp
              </button>
              <details className="cc-historial">
                <summary>Historial ({(c.historialEstados || []).length})</summary>
                <ul>
                  {(c.historialEstados || []).map((h, i) => (
                    <li key={i}>
                      <b>{h.fecha}</b> — {h.estado}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TabRecibos({
  recibos,
  clientes,
  contenedores,
  clientePorId,
  contenedorPorId,
  esAdmin,
  cargando,
  setError,
}: {
  recibos: Recibo[]
  clientes: Cliente[]
  contenedores: Contenedor[]
  clientePorId: Record<string, Cliente>
  contenedorPorId: Record<string, Contenedor>
  esAdmin: boolean
  cargando: boolean
  setError: (e: string | null) => void
}) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    clienteId: '',
    contenedorId: '',
    contenido: '',
    cbm: '',
    numeroWR: '',
    peso: '',
    pesoUnidad: 'kg',
    medidas: '',
  })
  const [factura, setFactura] = useState<File | null>(null)
  const [packing, setPacking] = useState<File | null>(null)
  const [foto, setFoto] = useState<File | null>(null)

  async function subirArchivo(reciboId: string, carpeta: string, archivo: File) {
    const path = `china/recibos/${reciboId}/${carpeta}_${Date.now()}_${archivo.name}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, archivo, { contentType: archivo.type || 'application/octet-stream' })
    const url = await getDownloadURL(storageRef)
    return url
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!form.clienteId || !form.contenido) return
    setGuardando(true)
    try {
      const estadoInicial = form.contenedorId
        ? contenedorPorId[form.contenedorId]?.estado || ESTADOS_CHINA[0]
        : ESTADOS_CHINA[0]
      const docRef = await addDoc(collection(db, 'chinaRecibos'), { ...form, estado: estadoInicial })
      const extra: Record<string, string> = {}
      if (factura) {
        extra.facturaUrl = await subirArchivo(docRef.id, 'factura', factura)
        extra.facturaNombreArchivo = factura.name
      }
      if (packing) {
        extra.packingUrl = await subirArchivo(docRef.id, 'packing', packing)
        extra.packingNombreArchivo = packing.name
      }
      if (foto) {
        extra.fotoUrl = await subirArchivo(docRef.id, 'foto', foto)
        extra.fotoNombreArchivo = foto.name
      }
      if (Object.keys(extra).length > 0) {
        await updateDoc(doc(db, 'chinaRecibos', docRef.id), extra)
      }
      setForm({ clienteId: '', contenedorId: '', contenido: '', cbm: '', numeroWR: '', peso: '', pesoUnidad: 'kg', medidas: '' })
      setFactura(null)
      setPacking(null)
      setFoto(null)
      setMostrarForm(false)
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar el recibo.')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(id: string, estado: string) {
    try {
      await updateDoc(doc(db, 'chinaRecibos', id), { estado })
    } catch (err) {
      console.error(err)
      setError('No se pudo actualizar el estado.')
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este recibo? Esta accion no se puede deshacer.')) return
    try {
      await deleteDoc(doc(db, 'chinaRecibos', id))
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el recibo.')
    }
  }

  return (
    <div>
      <div className="cc-subhead">
        <div className="cc-subhead-titulo">Recibos</div>
        <button className="btn-primary" onClick={() => setMostrarForm((v) => !v)} disabled={clientes.length === 0}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo recibo'}
        </button>
      </div>

      {clientes.length === 0 && !mostrarForm && (
        <p className="cc-aviso">Primero registra al menos un cliente en la pestaña "Clientes".</p>
      )}

      {mostrarForm && (
        <form className="cc-form" onSubmit={guardar}>
          <div className="cc-form-grid">
            <div>
              <label>Cliente *</label>
              <select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} required autoFocus>
                <option value="">Selecciona...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.casillero} — {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Contenedor</label>
              <select value={form.contenedorId} onChange={(e) => setForm({ ...form, contenedorId: e.target.value })}>
                <option value="">Sin asignar aun</option>
                {contenedores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Contenido *</label>
              <input value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} required />
            </div>
            <div>
              <label>CBM</label>
              <input value={form.cbm} onChange={(e) => setForm({ ...form, cbm: e.target.value })} placeholder="Ej: 0.3" />
            </div>
            <div>
              <label>Numero WR</label>
              <input value={form.numeroWR} onChange={(e) => setForm({ ...form, numeroWR: e.target.value })} placeholder="Ej: WR-000012" />
            </div>
            <div>
              <label>Peso</label>
              <div className="cc-form-peso">
                <input value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value })} placeholder="Ej: 100" />
                <select value={form.pesoUnidad} onChange={(e) => setForm({ ...form, pesoUnidad: e.target.value })}>
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
              </div>
            </div>
            <div>
              <label>Medidas</label>
              <input value={form.medidas} onChange={(e) => setForm({ ...form, medidas: e.target.value })} placeholder="Ej: 40x30x20 cm" />
            </div>
          </div>
          <div className="cc-form-grid">
            <div>
              <label>Factura (PDF)</label>
              <input type="file" accept="application/pdf,image/*" onChange={(e) => setFactura(e.target.files?.[0] || null)} />
            </div>
            <div>
              <label>Packing list (PDF)</label>
              <input type="file" accept="application/pdf,image/*" onChange={(e) => setPacking(e.target.files?.[0] || null)} />
            </div>
            <div>
              <label>Foto</label>
              <input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files?.[0] || null)} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar recibo'}
          </button>
        </form>
      )}

      <div className="cc-card">
        {cargando ? (
          <div className="empty-state">Cargando...</div>
        ) : recibos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">📦</div>
            <div>Todavia no hay recibos</div>
          </div>
        ) : (
          <table className="cc-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contenido</th>
                <th>CBM</th>
                <th>WR / Peso</th>
                <th>Adjuntos</th>
                <th>Contenedor</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recibos.map((r) => (
                <tr key={r.id}>
                  <td className="cc-nombre">
                    {clientePorId[r.clienteId]
                      ? `${clientePorId[r.clienteId].casillero} — ${clientePorId[r.clienteId].nombre}`
                      : '—'}
                  </td>
                  <td>{r.contenido}</td>
                  <td>{r.cbm || '—'}</td>
                  <td>
                    {r.numeroWR || '—'}
                    {r.peso ? ` · ${r.peso} ${r.pesoUnidad || 'kg'}` : ''}
                  </td>
                  <td className="cc-adjuntos">
                    {r.facturaUrl && (
                      <a href={r.facturaUrl} target="_blank" rel="noreferrer">
                        Factura
                      </a>
                    )}
                    {r.packingUrl && (
                      <a href={r.packingUrl} target="_blank" rel="noreferrer">
                        Packing
                      </a>
                    )}
                    {r.fotoUrl && (
                      <a href={r.fotoUrl} target="_blank" rel="noreferrer">
                        Foto
                      </a>
                    )}
                    {!r.facturaUrl && !r.packingUrl && !r.fotoUrl && '—'}
                  </td>
                  <td>{r.contenedorId ? contenedorPorId[r.contenedorId]?.nombre || '—' : 'Sin asignar'}</td>
                  <td>
                    <select className="cc-recibo-estado" value={r.estado} onChange={(e) => cambiarEstado(r.id, e.target.value)}>
                      {ESTADOS_CHINA.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {esAdmin && (
                      <button className="cc-del" onClick={() => eliminar(r.id)} title="Eliminar">
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
