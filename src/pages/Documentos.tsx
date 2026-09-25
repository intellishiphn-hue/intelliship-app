import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import './Documentos.css'

// Lista de tipos de documento para el expediente de cada empleado.
// Los marcados como requerido=true son los que cuentan para el aviso de
// "expediente incompleto" en el Dashboard. Si Sergio quiere otra lista,
// solo hay que ajustar este arreglo.
export const TIPOS_DOCUMENTO: { value: string; requerido: boolean }[] = [
  { value: 'Identidad (DNI)', requerido: true },
  { value: 'Contrato firmado', requerido: true },
  { value: 'Curriculum / CV', requerido: true },
  { value: 'Fotografia', requerido: true },
  { value: 'Antecedentes penales', requerido: false },
  { value: 'Comprobante de domicilio', requerido: false },
  { value: 'Titulo o certificado academico', requerido: false },
  { value: 'Otro', requerido: false },
]

export const TIPOS_REQUERIDOS = TIPOS_DOCUMENTO.filter((t) => t.requerido).map((t) => t.value)

type Empleado = { id: string; nombre: string; activo?: boolean }

type Documento = {
  id: string
  empleadoId: string
  tipo: string
  nombreArchivo: string
  contentType: string
  storagePath: string
  fecha: string
}

const hoy = () => new Date().toISOString().slice(0, 10)

export default function Documentos() {
  const { rol } = useAuth()
  const esAdmin = rol === 'admin'
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, 'empleados'), orderBy('nombre')), (snap) => {
      setEmpleados(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Empleado, 'id'>) })))
    })
    const unsub2 = onSnapshot(
      query(collection(db, 'documentos'), orderBy('fecha', 'desc')),
      (snap) => {
        setDocumentos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Documento, 'id'>) })))
        setCargando(false)
      },
      (err) => {
        console.error(err)
        setError('No se pudo cargar los documentos.')
        setCargando(false)
      }
    )
    return () => {
      unsub1()
      unsub2()
    }
  }, [])

  const docsPorEmpleado = useMemo(() => {
    const mapa: Record<string, Documento[]> = {}
    for (const d of documentos) {
      if (!mapa[d.empleadoId]) mapa[d.empleadoId] = []
      mapa[d.empleadoId].push(d)
    }
    return mapa
  }, [documentos])

  const activos = useMemo(() => empleados.filter((e) => e.activo !== false), [empleados])

  const filtrados = busqueda
    ? activos.filter((e) => e.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : activos

  const incompletos = useMemo(
    () =>
      activos.filter((e) => {
        const tipos = new Set((docsPorEmpleado[e.id] || []).map((d) => d.tipo))
        return TIPOS_REQUERIDOS.some((t) => !tipos.has(t))
      }),
    [activos, docsPorEmpleado]
  )

  return (
    <div className="doc-page">
      <div className="doc-head">
        <div>
          <h1>Documentos</h1>
          <p>
            {activos.length} empleado{activos.length === 1 ? '' : 's'} activo{activos.length === 1 ? '' : 's'} ·{' '}
            {incompletos.length} con expediente incompleto
          </p>
        </div>
        <input
          className="doc-buscador"
          placeholder="Buscar empleado..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {error && <div className="doc-error">{error}</div>}

      <div className="doc-lista">
        {cargando ? (
          <div className="empty-state">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🗂️</div>
            <div>No hay empleados que coincidan</div>
          </div>
        ) : (
          filtrados.map((emp) => (
            <FilaEmpleado
              key={emp.id}
              empleado={emp}
              documentos={docsPorEmpleado[emp.id] || []}
              expandido={expandido === emp.id}
              onToggle={() => setExpandido(expandido === emp.id ? null : emp.id)}
              esAdmin={esAdmin}
              setError={setError}
            />
          ))
        )}
      </div>
    </div>
  )
}

function FilaEmpleado({
  empleado,
  documentos,
  expandido,
  onToggle,
  esAdmin,
  setError,
}: {
  empleado: Empleado
  documentos: Documento[]
  expandido: boolean
  onToggle: () => void
  esAdmin: boolean
  setError: (e: string | null) => void
}) {
  const tiposPresentes = new Set(documentos.map((d) => d.tipo))
  const faltantes = TIPOS_REQUERIDOS.filter((t) => !tiposPresentes.has(t))
  const [tipoSubida, setTipoSubida] = useState(TIPOS_DOCUMENTO[0].value)
  const [subiendo, setSubiendo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function subirArchivo(archivo: File) {
    setSubiendo(true)
    try {
      const nombreLimpio = archivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `documentos/${empleado.id}/${Date.now()}_${nombreLimpio}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, archivo, { contentType: archivo.type || 'application/octet-stream' })
      await addDoc(collection(db, 'documentos'), {
        empleadoId: empleado.id,
        tipo: tipoSubida,
        nombreArchivo: archivo.name,
        contentType: archivo.type || 'application/octet-stream',
        storagePath: path,
        fecha: hoy(),
      })
    } catch (err) {
      console.error(err)
      setError('No se pudo subir el documento.')
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function verArchivo(d: Documento) {
    try {
      const url = await getDownloadURL(ref(storage, d.storagePath))
      window.open(url, '_blank', 'noreferrer')
    } catch (err) {
      console.error(err)
      setError('No se pudo abrir el documento.')
    }
  }

  async function eliminarArchivo(d: Documento) {
    if (!confirm(`¿Eliminar "${d.nombreArchivo}"? Esta accion no se puede deshacer.`)) return
    try {
      await deleteDoc(doc(db, 'documentos', d.id))
      await deleteObject(ref(storage, d.storagePath)).catch(() => {})
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el documento.')
    }
  }

  return (
    <div className={'doc-fila-card' + (expandido ? ' doc-fila-abierta' : '')}>
      <button className="doc-fila-head" onClick={onToggle}>
        <span className="doc-fila-nombre">{empleado.nombre}</span>
        <span className="doc-fila-info">
          {documentos.length} documento{documentos.length === 1 ? '' : 's'}
          {faltantes.length === 0 ? (
            <span className="doc-badge doc-badge-ok">Completo</span>
          ) : (
            <span className="doc-badge doc-badge-falta" title={faltantes.join(', ')}>
              Faltan {faltantes.length}
            </span>
          )}
        </span>
      </button>

      {expandido && (
        <div className="doc-fila-body">
          {faltantes.length > 0 && (
            <p className="doc-faltantes">Pendientes: {faltantes.join(', ')}</p>
          )}

          {documentos.length === 0 ? (
            <p className="doc-vacio">Todavia no hay documentos subidos.</p>
          ) : (
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Archivo</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((d) => (
                  <tr key={d.id}>
                    <td>{d.tipo}</td>
                    <td>
                      <button className="doc-link" onClick={() => verArchivo(d)}>
                        {d.nombreArchivo} ↗
                      </button>
                    </td>
                    <td>{d.fecha}</td>
                    <td>
                      {esAdmin && (
                        <button className="doc-del" onClick={() => eliminarArchivo(d)} title="Eliminar">
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="doc-subir">
            <select value={tipoSubida} onChange={(e) => setTipoSubida(e.target.value)}>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.value}
                  {t.requerido ? ' *' : ''}
                </option>
              ))}
            </select>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              disabled={subiendo}
              onChange={(e) => {
                const archivo = e.target.files?.[0]
                if (archivo) subirArchivo(archivo)
              }}
            />
            {subiendo && <span className="doc-subiendo">Subiendo...</span>}
          </div>
        </div>
      )}
    </div>
  )
}
