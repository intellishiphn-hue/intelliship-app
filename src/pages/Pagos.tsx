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

type Desglose = {
  salarioBase: number
  horasExtra: number
  bono: number
  otrosIngresos: number
  ihss: number
  rap: number
  adelanto: number
  descuentoMercan: number
  descuentoMercanNota: string
  totalIngresos: number
  totalDescuentos: number
}

type Pago = {
  id: string
  empleadoId: string
  periodo: string
  mes: string
  montoNeto: number
  notas: string
  fechaRegistro: string
  desglose?: Desglose
}

const PERIODOS = ['1ra Quincena', '2da Quincena']

const VACIO_RAPIDO = { empleadoId: '', periodo: '1ra Quincena', mes: '', montoNeto: '', notas: '' }

const VACIO_MANUAL = {
  empleadoId: '',
  periodo: '1ra Quincena',
  mes: '',
  salarioBase: '',
  horasExtra: '',
  bono: '',
  otrosIngresos: '',
  ihss: '',
  rap: '',
  adelanto: '',
  descuentoMercan: '',
  descuentoMercanNota: '',
  nota: '',
}

function mesActual() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}

function num(v: string) {
  return Number(v) || 0
}

export default function Pagos() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modoForm, setModoForm] = useState<'rapido' | 'manual' | null>(null)
  const [formRapido, setFormRapido] = useState({ ...VACIO_RAPIDO, mes: mesActual() })
  const [formManual, setFormManual] = useState({ ...VACIO_MANUAL, mes: mesActual() })
  const [guardando, setGuardando] = useState(false)
  const [filtroEmpleado, setFiltroEmpleado] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)

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

  function cerrarForm() {
    setModoForm(null)
  }

  function abrirModo(modo: 'rapido' | 'manual') {
    setModoForm((actual) => (actual === modo ? null : modo))
  }

  async function guardarPagoRapido(e: FormEvent) {
    e.preventDefault()
    if (!formRapido.empleadoId || !formRapido.mes || !formRapido.montoNeto) return
    setGuardando(true)
    try {
      await addDoc(collection(db, 'pagos'), {
        empleadoId: formRapido.empleadoId,
        periodo: formRapido.periodo,
        mes: formRapido.mes,
        montoNeto: num(formRapido.montoNeto),
        notas: formRapido.notas,
        fechaRegistro: new Date().toISOString().slice(0, 10),
      })
      setFormRapido({ ...VACIO_RAPIDO, mes: formRapido.mes })
      cerrarForm()
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar el pago.')
    } finally {
      setGuardando(false)
    }
  }

  const totalIngresosManual =
    num(formManual.salarioBase) + num(formManual.horasExtra) + num(formManual.bono) + num(formManual.otrosIngresos)
  const totalDescuentosManual =
    num(formManual.ihss) + num(formManual.rap) + num(formManual.adelanto) + num(formManual.descuentoMercan)
  const netoManual = totalIngresosManual - totalDescuentosManual

  async function guardarPagoManual(e: FormEvent) {
    e.preventDefault()
    if (!formManual.empleadoId || !formManual.mes) return
    setGuardando(true)
    try {
      const desglose: Desglose = {
        salarioBase: num(formManual.salarioBase),
        horasExtra: num(formManual.horasExtra),
        bono: num(formManual.bono),
        otrosIngresos: num(formManual.otrosIngresos),
        ihss: num(formManual.ihss),
        rap: num(formManual.rap),
        adelanto: num(formManual.adelanto),
        descuentoMercan: num(formManual.descuentoMercan),
        descuentoMercanNota: formManual.descuentoMercanNota,
        totalIngresos: totalIngresosManual,
        totalDescuentos: totalDescuentosManual,
      }
      await addDoc(collection(db, 'pagos'), {
        empleadoId: formManual.empleadoId,
        periodo: formManual.periodo,
        mes: formManual.mes,
        montoNeto: netoManual,
        notas: formManual.nota,
        fechaRegistro: new Date().toISOString().slice(0, 10),
        desglose,
      })
      setFormManual({ ...VACIO_MANUAL, mes: formManual.mes })
      cerrarForm()
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar el pago con desglose.')
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

  function fmt(n: number) {
    return `L. ${n.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`
  }

  return (
    <div className="pag-page">
      <div className="pag-head">
        <div>
          <h1>Nómina / Pagos</h1>
          <p>
            {pagos.length} {pagos.length === 1 ? 'pago registrado' : 'pagos registrados'}
          </p>
        </div>
        <div className="pag-head-botones">
          <button className="btn-secundario" onClick={() => abrirModo('manual')}>
            {modoForm === 'manual' ? 'Cancelar' : '+ Pago Manual'}
          </button>
          <button className="btn-primary" onClick={() => abrirModo('rapido')}>
            {modoForm === 'rapido' ? 'Cancelar' : '+ Registrar pago'}
          </button>
        </div>
      </div>

      {error && <div className="pag-error">{error}</div>}

      <p className="pag-nota-futuro">
        Subir comprobante del banco (lectura automática) y la carga masiva por Excel de Planilla se
        agregan más adelante.
      </p>

      {modoForm === 'rapido' && (
        <form className="pag-form" onSubmit={guardarPagoRapido}>
          <div className="pag-form-grid">
            <div>
              <label>Empleado *</label>
              <select
                value={formRapido.empleadoId}
                onChange={(e) => setFormRapido({ ...formRapido, empleadoId: e.target.value })}
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
              <select value={formRapido.periodo} onChange={(e) => setFormRapido({ ...formRapido, periodo: e.target.value })}>
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
                value={formRapido.mes}
                onChange={(e) => setFormRapido({ ...formRapido, mes: e.target.value })}
                required
              />
            </div>
            <div>
              <label>Monto neto (Lps) *</label>
              <input
                type="number"
                step="0.01"
                value={formRapido.montoNeto}
                onChange={(e) => setFormRapido({ ...formRapido, montoNeto: e.target.value })}
                required
              />
            </div>
            <div className="pag-form-notas">
              <label>Notas</label>
              <input value={formRapido.notas} onChange={(e) => setFormRapido({ ...formRapido, notas: e.target.value })} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar pago'}
          </button>
        </form>
      )}

      {modoForm === 'manual' && (
        <form className="pag-form" onSubmit={guardarPagoManual}>
          <div className="pag-form-grid">
            <div>
              <label>Empleado *</label>
              <select
                value={formManual.empleadoId}
                onChange={(e) => setFormManual({ ...formManual, empleadoId: e.target.value })}
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
              <select value={formManual.periodo} onChange={(e) => setFormManual({ ...formManual, periodo: e.target.value })}>
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
                value={formManual.mes}
                onChange={(e) => setFormManual({ ...formManual, mes: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="pag-desglose-titulo">Ingresos (Lps)</div>
          <div className="pag-form-grid">
            <div>
              <label>Salario base</label>
              <input type="number" step="0.01" value={formManual.salarioBase} onChange={(e) => setFormManual({ ...formManual, salarioBase: e.target.value })} />
            </div>
            <div>
              <label>Horas extra</label>
              <input type="number" step="0.01" value={formManual.horasExtra} onChange={(e) => setFormManual({ ...formManual, horasExtra: e.target.value })} />
            </div>
            <div>
              <label>Bono / Comisión</label>
              <input type="number" step="0.01" value={formManual.bono} onChange={(e) => setFormManual({ ...formManual, bono: e.target.value })} />
            </div>
            <div>
              <label>Otros ingresos</label>
              <input type="number" step="0.01" value={formManual.otrosIngresos} onChange={(e) => setFormManual({ ...formManual, otrosIngresos: e.target.value })} />
            </div>
          </div>

          <div className="pag-desglose-titulo">Descuentos (Lps)</div>
          <div className="pag-form-grid">
            <div>
              <label>IHSS empleado</label>
              <input type="number" step="0.01" value={formManual.ihss} onChange={(e) => setFormManual({ ...formManual, ihss: e.target.value })} />
            </div>
            <div>
              <label>RAP</label>
              <input type="number" step="0.01" value={formManual.rap} onChange={(e) => setFormManual({ ...formManual, rap: e.target.value })} />
            </div>
            <div>
              <label>Adelanto / Préstamo</label>
              <input type="number" step="0.01" value={formManual.adelanto} onChange={(e) => setFormManual({ ...formManual, adelanto: e.target.value })} />
            </div>
            <div>
              <label>Descuento por Mercan.</label>
              <input type="number" step="0.01" value={formManual.descuentoMercan} onChange={(e) => setFormManual({ ...formManual, descuentoMercan: e.target.value })} />
            </div>
            <div className="pag-form-notas">
              <label>Nota del descuento</label>
              <input value={formManual.descuentoMercanNota} onChange={(e) => setFormManual({ ...formManual, descuentoMercanNota: e.target.value })} />
            </div>
          </div>

          <div className="pag-totales">
            <div><span>Total ingresos</span><strong>{fmt(totalIngresosManual)}</strong></div>
            <div><span>Total descuentos</span><strong>{fmt(totalDescuentosManual)}</strong></div>
            <div className="pag-totales-neto"><span>Neto a recibir</span><strong>{fmt(netoManual)}</strong></div>
          </div>

          <div className="pag-form-grid">
            <div className="pag-form-notas">
              <label>Nota adicional</label>
              <input value={formManual.nota} onChange={(e) => setFormManual({ ...formManual, nota: e.target.value })} />
            </div>
          </div>

          <p className="pag-nota-futuro">
            Generar el PDF y enviarlo por correo se agrega cuando definamos las automatizaciones de email —
            por ahora el desglose queda guardado y visible en el historial.
          </p>

          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar pago con desglose'}
          </button>
        </form>
      )}

      <div className="pag-card">
        <div className="pag-card-titulo-row">
          <div className="pag-card-titulo">
            Historial{filtroEmpleado ? ` — Total: ${fmt(totalFiltrado)}` : ''}
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
                <th></th>
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
                <>
                  <tr key={p.id}>
                    <td>
                      {p.desglose && (
                        <button
                          className="pag-expand-btn"
                          onClick={() => setExpandido(expandido === p.id ? null : p.id)}
                          title="Ver desglose"
                        >
                          {expandido === p.id ? '▾' : '▸'}
                        </button>
                      )}
                    </td>
                    <td className="pag-nombre">{nombrePorId[p.empleadoId] || p.empleadoId}</td>
                    <td>{p.mes}</td>
                    <td>{p.periodo}</td>
                    <td className="pag-monto">{fmt(p.montoNeto || 0)}</td>
                    <td>{p.notas || '—'}</td>
                    <td>
                      <button className="pag-del" onClick={() => eliminarPago(p.id)} title="Eliminar">
                        ✕
                      </button>
                    </td>
                  </tr>
                  {expandido === p.id && p.desglose && (
                    <tr className="pag-detalle-row" key={p.id + '-detalle'}>
                      <td colSpan={7}>
                        <div className="pag-detalle-grid">
                          <div><strong>Salario base:</strong> {fmt(p.desglose.salarioBase)}</div>
                          <div><strong>Horas extra:</strong> {fmt(p.desglose.horasExtra)}</div>
                          <div><strong>Bono/Comisión:</strong> {fmt(p.desglose.bono)}</div>
                          <div><strong>Otros ingresos:</strong> {fmt(p.desglose.otrosIngresos)}</div>
                          <div><strong>IHSS:</strong> {fmt(p.desglose.ihss)}</div>
                          <div><strong>RAP:</strong> {fmt(p.desglose.rap)}</div>
                          <div><strong>Adelanto:</strong> {fmt(p.desglose.adelanto)}</div>
                          <div><strong>Desc. Mercan.:</strong> {fmt(p.desglose.descuentoMercan)}{p.desglose.descuentoMercanNota ? ` (${p.desglose.descuentoMercanNota})` : ''}</div>
                          <div><strong>Total ingresos:</strong> {fmt(p.desglose.totalIngresos)}</div>
                          <div><strong>Total descuentos:</strong> {fmt(p.desglose.totalDescuentos)}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
