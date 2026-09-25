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
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import './GuiasNacionales.css'

type Guia = {
  id: string
  nombre: string
  telefono: string
  email: string
  direccion: string
  municipio: string
  codigo: string
  piezas: number
  referencia1: string
  referencia2: string
  fechaPedido: string
  exportado: boolean
  fechaExportacion: string | null
}

const hoy = () => new Date().toISOString().slice(0, 10)

const VACIO = {
  nombre: '',
  telefono: '',
  email: '',
  direccion: '',
  municipio: '',
  codigo: '',
  piezas: '1',
  referencia1: '',
  referencia2: '',
  fechaPedido: hoy(),
}

function descargarCsv(filas: Guia[]) {
  const columnas = [
    'nombre',
    'telefono',
    'email',
    'direccion',
    'municipio',
    'codigo',
    'piezas',
    'referencia1',
    'referencia2',
    'fechaPedido',
  ] as const
  const escapar = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const encabezado = columnas.join(',')
  const lineas = filas.map((f) => columnas.map((c) => escapar(f[c])).join(','))
  const csv = [encabezado, ...lineas].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `guias-nacionales-${hoy()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function GuiasNacionales() {
  const { rol } = useAuth()
  const esAdmin = rol === 'admin'
  const [guias, setGuias] = useState<Guia[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [filtro, setFiltro] = useState<'pendientes' | 'exportadas' | 'todas'>('pendientes')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'guiasNacionales'), orderBy('fechaPedido', 'desc')),
      (snap) => {
        setGuias(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Guia, 'id'>) })))
        setCargando(false)
      },
      (err) => {
        console.error(err)
        setError('No se pudo cargar las guias nacionales.')
        setCargando(false)
      }
    )
    return unsub
  }, [])

  async function guardarGuia(e: FormEvent) {
    e.preventDefault()
    if (!form.nombre || !form.telefono || !form.direccion) return
    setGuardando(true)
    try {
      await addDoc(collection(db, 'guiasNacionales'), {
        nombre: form.nombre,
        telefono: form.telefono,
        email: form.email,
        direccion: form.direccion,
        municipio: form.municipio,
        codigo: form.codigo,
        piezas: Number(form.piezas) || 1,
        referencia1: form.referencia1,
        referencia2: form.referencia2,
        fechaPedido: form.fechaPedido,
        exportado: false,
        fechaExportacion: null,
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

  async function eliminarGuia(id: string) {
    if (!confirm('¿Eliminar este pedido? Esta accion no se puede deshacer.')) return
    try {
      await deleteDoc(doc(db, 'guiasNacionales', id))
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el pedido.')
    }
  }

  const pendientes = useMemo(() => guias.filter((g) => !g.exportado), [guias])
  const exportadas = useMemo(() => guias.filter((g) => g.exportado), [guias])
  const visibles = filtro === 'pendientes' ? pendientes : filtro === 'exportadas' ? exportadas : guias

  function toggleSeleccion(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function seleccionarTodasVisibles() {
    setSeleccion((prev) => {
      const todasMarcadas = visibles.every((v) => prev.has(v.id))
      if (todasMarcadas) return new Set()
      return new Set(visibles.map((v) => v.id))
    })
  }

  async function exportarSeleccionadas() {
    const filas = guias.filter((g) => seleccion.has(g.id))
    if (filas.length === 0) return
    descargarCsv(filas)
    try {
      const batch = writeBatch(db)
      const fecha = hoy()
      filas.forEach((f) => {
        batch.update(doc(db, 'guiasNacionales', f.id), { exportado: true, fechaExportacion: fecha })
      })
      await batch.commit()
      setSeleccion(new Set())
    } catch (err) {
      console.error(err)
      setError('El archivo se descargo, pero no se pudo marcar como exportado en el sistema.')
    }
  }

  async function reabrirGuia(id: string) {
    try {
      await updateDoc(doc(db, 'guiasNacionales', id), { exportado: false, fechaExportacion: null })
    } catch (err) {
      console.error(err)
      setError('No se pudo actualizar el pedido.')
    }
  }

  return (
    <div className="gn-page">
      <div className="gn-head">
        <div>
          <h1>Guias nacionales</h1>
          <p>
            {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'} de exportar ·{' '}
            {exportadas.length} ya exportada{exportadas.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="gn-head-acciones">
          {seleccion.size > 0 && (
            <button className="btn-primary" onClick={exportarSeleccionadas}>
              Exportar {seleccion.size} seleccionada{seleccion.size === 1 ? '' : 's'} (.csv)
            </button>
          )}
          <button className="btn-primary" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? 'Cancelar' : '+ Nuevo pedido'}
          </button>
        </div>
      </div>

      {error && <div className="gn-error">{error}</div>}

      {mostrarForm && (
        <form className="gn-form" onSubmit={guardarGuia}>
          <div className="gn-form-grid">
            <div>
              <label>Nombre *</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required autoFocus />
            </div>
            <div>
              <label>Telefono *</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} required />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="gn-form-direccion">
              <label>Direccion *</label>
              <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} required />
            </div>
            <div>
              <label>Municipio</label>
              <input value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} />
            </div>
            <div>
              <label>Codigo</label>
              <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </div>
            <div>
              <label>Piezas</label>
              <input type="number" min={1} value={form.piezas} onChange={(e) => setForm({ ...form, piezas: e.target.value })} />
            </div>
            <div>
              <label>Referencia 1</label>
              <input value={form.referencia1} onChange={(e) => setForm({ ...form, referencia1: e.target.value })} />
            </div>
            <div>
              <label>Referencia 2</label>
              <input value={form.referencia2} onChange={(e) => setForm({ ...form, referencia2: e.target.value })} />
            </div>
            <div>
              <label>Fecha del pedido</label>
              <input type="date" value={form.fechaPedido} onChange={(e) => setForm({ ...form, fechaPedido: e.target.value })} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar pedido'}
          </button>
        </form>
      )}

      <div className="gn-tabs">
        <button className={filtro === 'pendientes' ? 'gn-tab gn-tab-activo' : 'gn-tab'} onClick={() => setFiltro('pendientes')}>
          Pendientes ({pendientes.length})
        </button>
        <button className={filtro === 'exportadas' ? 'gn-tab gn-tab-activo' : 'gn-tab'} onClick={() => setFiltro('exportadas')}>
          Exportadas ({exportadas.length})
        </button>
        <button className={filtro === 'todas' ? 'gn-tab gn-tab-activo' : 'gn-tab'} onClick={() => setFiltro('todas')}>
          Todas ({guias.length})
        </button>
      </div>

      <div className="gn-card">
        {cargando ? (
          <div className="empty-state">Cargando...</div>
        ) : visibles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">📄</div>
            <div>No hay pedidos en esta vista</div>
          </div>
        ) : (
          <table className="gn-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={visibles.length > 0 && visibles.every((v) => seleccion.has(v.id))} onChange={seleccionarTodasVisibles} />
                </th>
                <th>Nombre</th>
                <th>Telefono</th>
                <th>Direccion</th>
                <th>Municipio</th>
                <th>Piezas</th>
                <th>Fecha pedido</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((g) => (
                <tr key={g.id}>
                  <td>
                    <input type="checkbox" checked={seleccion.has(g.id)} onChange={() => toggleSeleccion(g.id)} />
                  </td>
                  <td className="gn-nombre">{g.nombre}</td>
                  <td>{g.telefono}</td>
                  <td className="gn-direccion">{g.direccion}</td>
                  <td>{g.municipio || '—'}</td>
                  <td>{g.piezas}</td>
                  <td>{g.fechaPedido}</td>
                  <td>
                    {g.exportado ? (
                      <span className="gn-tag gn-tag-exportado" title={g.fechaExportacion || ''}>
                        Exportada
                      </span>
                    ) : (
                      <span className="gn-tag gn-tag-pendiente">Pendiente</span>
                    )}
                  </td>
                  <td className="gn-acciones">
                    {g.exportado && (
                      <button className="gn-btn-secundario" onClick={() => reabrirGuia(g.id)}>
                        Reabrir
                      </button>
                    )}
                    {esAdmin && (
                      <button className="gn-del" onClick={() => eliminarGuia(g.id)} title="Eliminar">
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
