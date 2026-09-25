import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import './Asistencia.css'

type Empleado = { id: string; nombre: string }

type Marca = {
  id: string
  eid: string
  tipo: string
  fecha: string
  ts: number
  lat?: number
  lng?: number
  distM?: number
  comentario?: string
}

// Coordenadas de la oficina, usadas por el reloj marcador para validar que
// la marcacion se hizo dentro del radio permitido.
const OFICINA = { lat: 14.115480711491383, lng: -87.17280670912903, radioM: 150 }

export default function Asistencia() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroEmpleado, setFiltroEmpleado] = useState('')

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, 'empleados'), orderBy('nombre')), (snap) => {
      setEmpleados(snap.docs.map((d) => ({ id: d.id, nombre: (d.data() as any).nombre })))
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

  const marcasFiltradas = filtroEmpleado ? marcas.filter((m) => m.eid === filtroEmpleado) : marcas

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
      </div>

      <p className="asis-nota-futuro">
        Este historial trae las marcaciones del sistema anterior (sin las fotos viejas, según
        confirmaste). El reloj marcador de autoservicio para marcar entrada/salida con foto (y su
        borrado automático a los 15 días) se agrega en la siguiente iteración — la oficina de
        referencia para validar ubicación es {OFICINA.lat.toFixed(6)}, {OFICINA.lng.toFixed(6)}, radio{' '}
        {OFICINA.radioM}m.
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
                  <td className="asis-nombre">{nombrePorId[m.eid] || m.eid}</td>
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
    </div>
  )
}
