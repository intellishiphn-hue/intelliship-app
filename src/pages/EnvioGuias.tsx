import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
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
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../lib/firebase'
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
  const [mostrarPdf, setMostrarPdf] = useState(false)
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
        <div className="eg-head-botones">
          <button className="btn-secundario" onClick={() => setMostrarPdf((v) => !v)}>
            {mostrarPdf ? 'Cancelar' : '📄 Subir PDF de guias'}
          </button>
          <button className="btn-primary" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? 'Cancelar' : '+ Nueva guia'}
          </button>
        </div>
      </div>

      {error && <div className="eg-error">{error}</div>}

      {mostrarPdf && <SubirPdfGuias onListo={() => setMostrarPdf(false)} />}

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

type FilaPdf = {
  nombre: string
  telefono: string
  guia: string
  fecha: string | null
  telefonoValido: boolean
  incluir: boolean
}

function arrayBufferABase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  const tamanoChunk = 8192
  for (let i = 0; i < bytes.length; i += tamanoChunk) {
    const chunk = bytes.subarray(i, i + tamanoChunk)
    binario += String.fromCharCode(...chunk)
  }
  return btoa(binario)
}

// Sube un PDF de guias de Cargo Expreso (una etiqueta por pagina, el mismo
// PDF que se despacha con cada tanda de paquetes), lo manda a la Cloud
// Function que lo lee (procesarGuiasPdf), muestra una vista previa
// editable, y solo al confirmar crea los registros -- que disparan el
// WhatsApp automatico a cada cliente (notificarEnvioGuia). Nada se manda
// sin que el admin revise la vista previa primero.
function SubirPdfGuias({ onListo }: { onListo: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [empresa, setEmpresa] = useState('Cargo Expreso')
  const [leyendo, setLeyendo] = useState(false)
  const [filas, setFilas] = useState<FilaPdf[]>([])
  const [enviando, setEnviando] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  async function leerArchivo() {
    if (!archivo) return
    setLeyendo(true)
    setError(null)
    setFilas([])
    setLog([])
    try {
      const buffer = await archivo.arrayBuffer()
      const pdfBase64 = arrayBufferABase64(buffer)
      const procesarGuiasPdf = httpsCallable<{ pdfBase64: string }, { filas: Omit<FilaPdf, 'incluir'>[]; totalPaginas: number }>(
        functions,
        'procesarGuiasPdf'
      )
      const resultado = await procesarGuiasPdf({ pdfBase64 })
      const crudo = resultado.data.filas || []
      if (crudo.length === 0) {
        setError('No se detecto ninguna guia en el PDF. Verifica que sea el formato de etiquetas de Cargo Expreso.')
      }
      setFilas(crudo.map((f) => ({ ...f, incluir: f.telefonoValido })))
    } catch (err) {
      console.error(err)
      setError('No se pudo leer el PDF: ' + (err as Error).message)
    } finally {
      setLeyendo(false)
    }
  }

  function actualizarFila(i: number, cambios: Partial<FilaPdf>) {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...cambios } : f)))
  }

  async function confirmarEnvio() {
    const aEnviar = filas.filter((f) => f.incluir)
    if (aEnviar.length === 0) return
    if (
      !confirm(
        `Esto va a crear ${aEnviar.length} guia(s) y mandar un WhatsApp automatico a cada cliente con su numero de guia y link de rastreo. ¿Continuar?`
      )
    )
      return
    setEnviando(true)
    setLog([])
    let hechos = 0
    for (const f of aEnviar) {
      try {
        await addDoc(collection(db, 'cargoExpreso'), {
          nombre: f.nombre,
          telefono: f.telefono,
          empresa,
          guia: f.guia,
          link: '',
          fecha: f.fecha || hoy(),
          estado: 'En camino',
        })
        hechos += 1
        setLog((prev) => [...prev, `✓ ${f.nombre} — ${f.guia}`])
      } catch (err) {
        console.error(err)
        setLog((prev) => [...prev, `✗ ${f.nombre} — ${f.guia}: ${(err as Error).message}`])
      }
    }
    setEnviando(false)
    setLog((prev) => [...prev, `\nListo: ${hechos}/${aEnviar.length} guias creadas. El WhatsApp de cada una sale solo.`])
    setFilas([])
    if (hechos > 0) onListo()
  }

  return (
    <div className="eg-pdf-card">
      <p className="eg-pdf-nota">
        Sube el PDF de guias (una etiqueta por pagina). Se detecta el nombre, telefono, numero de guia y fecha de cada
        una para que las revises antes de confirmar. Al confirmar, cada guia manda su WhatsApp automatico.
      </p>
      <div className="eg-pdf-controles">
        <input
          type="file"
          accept="application/pdf"
          onChange={(e: ChangeEvent<HTMLInputElement>) => setArchivo(e.target.files?.[0] || null)}
        />
        <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
          <option value="Cargo Expreso">Cargo Expreso</option>
          <option value="FORZA">FORZA</option>
        </select>
        <button className="btn-primary" onClick={leerArchivo} disabled={!archivo || leyendo}>
          {leyendo ? 'Leyendo...' : 'Leer PDF'}
        </button>
      </div>

      {error && <div className="eg-error">{error}</div>}

      {filas.length > 0 && (
        <>
          <table className="eg-table eg-pdf-preview">
            <thead>
              <tr>
                <th></th>
                <th>Cliente</th>
                <th>Telefono</th>
                <th>Guia</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i} className={f.telefonoValido ? '' : 'eg-pdf-fila-alerta'}>
                  <td>
                    <input type="checkbox" checked={f.incluir} onChange={(e) => actualizarFila(i, { incluir: e.target.checked })} />
                  </td>
                  <td>
                    <input value={f.nombre} onChange={(e) => actualizarFila(i, { nombre: e.target.value })} />
                  </td>
                  <td>
                    <input
                      value={f.telefono}
                      onChange={(e) => actualizarFila(i, { telefono: e.target.value, telefonoValido: true })}
                    />
                  </td>
                  <td>
                    <input value={f.guia} onChange={(e) => actualizarFila(i, { guia: e.target.value })} />
                  </td>
                  <td>
                    <input
                      value={f.fecha || ''}
                      onChange={(e) => actualizarFila(i, { fecha: e.target.value })}
                      placeholder="AAAA-MM-DD"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="eg-pdf-nota">
            {filas.filter((f) => f.incluir).length} de {filas.length} seleccionadas para enviar. Las marcadas en rojo
            tienen un telefono que no parece valido -- revisalas antes de confirmar.
          </p>
          <button className="btn-primary" onClick={confirmarEnvio} disabled={enviando || filas.every((f) => !f.incluir)}>
            {enviando ? 'Enviando...' : `Confirmar y enviar (${filas.filter((f) => f.incluir).length})`}
          </button>
        </>
      )}

      {log.length > 0 && <pre className="eg-pdf-log">{log.join('\n')}</pre>}
    </div>
  )
}
