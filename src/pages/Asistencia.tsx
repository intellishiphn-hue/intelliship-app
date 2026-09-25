import { useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { distanciaMetros, fechaLocal } from '../lib/geo'
import './Asistencia.css'

type Empleado = { id: string; nombre: string; activo?: boolean }

type Marca = {
  id: string
  empleadoId: string
  tipo: string
  fecha: string
  ts: number
  lat?: number
  lng?: number
  distM?: number
  comentario?: string
  fotoUrl?: string
}

// Coordenadas de la oficina, usadas por el reloj marcador para validar que
// la marcacion se hizo dentro del radio permitido.
const OFICINA = { lat: 14.115480711491383, lng: -87.17280670912903, radioM: 150 }

type EstadoGps = 'cargando' | 'ok' | 'error'

function ModalMarcar({ empleados, onClose }: { empleados: Empleado[]; onClose: () => void }) {
  const { user, empleadoId: miEmpleadoId } = useAuth()
  const [empleadoId, setEmpleadoId] = useState(miEmpleadoId || '')
  const [tipo, setTipo] = useState<'entrada' | 'salida'>('entrada')
  const [comentario, setComentario] = useState('')

  const [gpsEstado, setGpsEstado] = useState<EstadoGps>('cargando')
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [distM, setDistM] = useState<number | null>(null)

  const [camaraActiva, setCamaraActiva] = useState(false)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsEstado('error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords.latitude
        const lng = p.coords.longitude
        setPos({ lat, lng })
        setDistM(distanciaMetros(lat, lng, OFICINA.lat, OFICINA.lng))
        setGpsEstado('ok')
      },
      () => setGpsEstado('error'),
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }, [])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function activarCamara() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      setCamaraActiva(true)
      // el video se monta en este mismo render; el stream se asigna en el effect de abajo
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream
      }, 0)
    } catch (err) {
      console.error(err)
      setError('No se pudo acceder a la camara. Revisa los permisos del navegador.')
    }
  }

  function capturarFoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth || 480
    canvas.height = video.videoHeight || 360
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setFotoBlob(blob)
        setFotoUrl(URL.createObjectURL(blob))
      },
      'image/jpeg',
      0.85
    )
  }

  function repetirFoto() {
    setFotoUrl(null)
    setFotoBlob(null)
  }

  function cerrarCamara() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamaraActiva(false)
  }

  const listaEmpleados = [...empleados].sort((a, b) => a.nombre.localeCompare(b.nombre))
  const puedeConfirmar = !!empleadoId && !!fotoBlob && !guardando

  async function confirmar() {
    if (!puedeConfirmar || !fotoBlob) return
    setGuardando(true)
    setError(null)
    try {
      const ahora = new Date()
      const archivo = `${empleadoId}_${ahora.getTime()}.jpg`
      const storageRef = ref(storage, `asistencia/${empleadoId}/${archivo}`)
      await uploadBytes(storageRef, fotoBlob, { contentType: 'image/jpeg' })
      const fotoDescargaUrl = await getDownloadURL(storageRef)

      await addDoc(collection(db, 'asistencia'), {
        empleadoId,
        tipo,
        fecha: fechaLocal(ahora),
        ts: ahora.getTime(),
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
        distM: distM ?? null,
        comentario: comentario.trim(),
        fotoUrl: fotoDescargaUrl,
        marcadoPor: user?.email ?? null,
        creadoEl: serverTimestamp(),
      })

      cerrarCamara()
      onClose()
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar la marcacion. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  function cerrar() {
    cerrarCamara()
    onClose()
  }

  return (
    <div className="asis-modal-overlay" onClick={cerrar}>
      <div className="asis-modal" onClick={(e) => e.stopPropagation()}>
        <div className="asis-modal-head">
          <h2>Marcar entrada / salida</h2>
          <button className="asis-modal-cerrar" onClick={cerrar}>✕</button>
        </div>

        {error && <div className="asis-error">{error}</div>}

        <div className="asis-modal-seccion">
          <label>{miEmpleadoId ? 'Marcando para' : 'Selecciona tu nombre *'}</label>
          {miEmpleadoId ? (
            <div className="asis-nombre-fijo">
              {listaEmpleados.find((e) => e.id === miEmpleadoId)?.nombre || 'Tu cuenta'}
            </div>
          ) : (
            <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} autoFocus>
              <option value="">Selecciona...</option>
              {listaEmpleados.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          )}
        </div>

        <div className="asis-modal-seccion">
          <label>Tipo de marcacion</label>
          <div className="asis-tipo-botones">
            <button
              type="button"
              className={'asis-tipo-btn' + (tipo === 'entrada' ? ' activo' : '')}
              onClick={() => setTipo('entrada')}
            >
              🟢 Entrada
            </button>
            <button
              type="button"
              className={'asis-tipo-btn' + (tipo === 'salida' ? ' activo' : '')}
              onClick={() => setTipo('salida')}
            >
              🔴 Salida
            </button>
          </div>
        </div>

        <div className="asis-modal-seccion">
          <label>Ubicacion</label>
          {gpsEstado === 'cargando' && <div className="asis-gps-estado">Obteniendo tu ubicacion...</div>}
          {gpsEstado === 'error' && (
            <div className="asis-gps-estado asis-gps-error">
              No se pudo obtener tu ubicacion (revisa permisos de GPS). Puedes continuar sin ella.
            </div>
          )}
          {gpsEstado === 'ok' && distM != null && (
            <div className={'asis-gps-estado ' + (distM <= OFICINA.radioM ? 'asis-gps-ok' : 'asis-gps-lejos')}>
              {distM <= OFICINA.radioM
                ? `✅ Dentro del rango de la oficina (${distM} m)`
                : `⚠️ Estas a ${distM} m de la oficina (fuera del radio de ${OFICINA.radioM} m) — igual puedes continuar`}
            </div>
          )}
        </div>

        <div className="asis-modal-seccion">
          <label>Foto para confirmar tu marcacion *</label>
          {!camaraActiva && !fotoUrl && (
            <button type="button" className="btn-secundario" onClick={activarCamara}>
              📷 Activar camara
            </button>
          )}
          {camaraActiva && !fotoUrl && (
            <div className="asis-camara-box">
              <video ref={videoRef} autoPlay playsInline muted className="asis-video" />
              <button type="button" className="btn-primary" onClick={capturarFoto}>Capturar</button>
            </div>
          )}
          {fotoUrl && (
            <div className="asis-camara-box">
              <img src={fotoUrl} alt="Foto de marcacion" className="asis-foto-preview" />
              <button type="button" className="btn-secundario" onClick={repetirFoto}>Repetir</button>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <div className="asis-modal-seccion">
          <label>Comentario (opcional, ej: cita medica, trafico, permiso)</label>
          <input value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </div>

        <button className="btn-primary asis-confirmar-btn" onClick={confirmar} disabled={!puedeConfirmar}>
          {guardando ? 'Guardando...' : 'Confirmar marcacion'}
        </button>
      </div>
    </div>
  )
}

export default function Asistencia() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroEmpleado, setFiltroEmpleado] = useState('')
  const [mostrarModal, setMostrarModal] = useState(false)

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, 'empleados'), orderBy('nombre')), (snap) => {
      setEmpleados(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Empleado, 'id'>) })))
    })
    const unsub2 = onSnapshot(
      query(collection(db, 'asistencia'), orderBy('ts', 'desc')),
      (snap) => {
        setMarcas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Marca, 'id'>) })))
        setCargando(false)
      },
      (err) => {
        console.error(err)
        setError('No se pudo cargar el historial de asistencia.')
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

  const empleadosActivos = useMemo(() => empleados.filter((e) => e.activo !== false), [empleados])

  const marcasFiltradas = filtroEmpleado ? marcas.filter((m) => m.empleadoId === filtroEmpleado) : marcas

  return (
    <div className="asis-page">
      <div className="asis-head">
        <div>
          <h1>Asistencia</h1>
          <p>
            {marcas.length} {marcas.length === 1 ? 'marcacion registrada' : 'marcaciones registradas'} ·
            entradas, salidas y horas extra
          </p>
        </div>
        <button className="btn-primary" onClick={() => setMostrarModal(true)}>
          🕐 Marcar entrada / salida
        </button>
      </div>

      <p className="asis-nota-futuro">
        Las marcaciones del sistema anterior (1197) siguen aqui sin foto, tal como confirmaste. Las
        marcaciones nuevas (desde el boton de arriba) ya llevan foto de confirmacion, la cual se borra
        automaticamente a los 15 dias — la oficina de referencia para validar ubicacion es{' '}
        {OFICINA.lat.toFixed(6)}, {OFICINA.lng.toFixed(6)}, radio {OFICINA.radioM}m.
      </p>

      {error && <div className="asis-error">{error}</div>}

      <div className="asis-card">
        <div className="asis-card-titulo-row">
          <div className="asis-card-titulo">Historial</div>
          <select
            className="asis-filtro"
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
        ) : marcasFiltradas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">⏱️</div>
            <div>Todavia no hay marcaciones</div>
          </div>
        ) : (
          <table className="asis-table">
            <thead>
              <tr>
                <th></th>
                <th>Empleado</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Distancia a oficina</th>
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              {marcasFiltradas.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.fotoUrl && (
                      <a href={m.fotoUrl} target="_blank" rel="noreferrer" title="Ver foto">
                        📷
                      </a>
                    )}
                  </td>
                  <td className="asis-nombre">{nombrePorId[m.empleadoId] || m.empleadoId}</td>
                  <td>{m.fecha}</td>
                  <td>{m.ts ? new Date(m.ts).toLocaleTimeString('es-HN') : '—'}</td>
                  <td>
                    <span className={'asis-tipo-tag asis-tipo-' + m.tipo}>
                      {m.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Salida'}
                    </span>
                  </td>
                  <td>{m.distM != null ? `${m.distM} m` : '—'}</td>
                  <td>{m.comentario || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {mostrarModal && (
        <ModalMarcar empleados={empleadosActivos} onClose={() => setMostrarModal(false)} />
      )}
    </div>
  )
}
