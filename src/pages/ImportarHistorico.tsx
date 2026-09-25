import { useState, type ChangeEvent } from 'react'
import { addDoc, collection, doc, updateDoc, writeBatch } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import './ImportarHistorico.css'

// Pagina de un solo uso (no esta en el menu, se abre por URL directa) para
// meter al panel nuevo el historico del panel viejo (rrhh-intelliship) que
// ya se dejo preparado en la carpeta _migracion-rrhh/import de la Mac de
// Sergio. Corre enteramente en el navegador, con la sesion de admin ya
// logueada -- no usa ninguna credencial de servicio ni token manual.
//
// Uso: Sergio selecciona cada archivo *_import.json con los botones de
// abajo y aprieta "Importar". Se puede correr cada seccion por separado.

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function leerJson(file: File): Promise<any> {
  const texto = await file.text()
  return JSON.parse(texto)
}

async function subirBase64(path: string, dataUri: string, contentType?: string) {
  const blob = await fetch(dataUri).then((r) => r.blob())
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob, { contentType: contentType || blob.type || 'application/octet-stream' })
  return getDownloadURL(storageRef)
}

function SeccionSimple({
  titulo,
  coleccion,
  nota,
}: {
  titulo: string
  coleccion: string
  nota?: string
}) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [corriendo, setCorriendo] = useState(false)

  function agregarLog(linea: string) {
    setLog((prev) => [...prev, linea])
  }

  async function importar() {
    if (!archivo) return
    setCorriendo(true)
    setLog([])
    try {
      const datos: any[] = await leerJson(archivo)
      agregarLog(`${datos.length} documentos leidos del archivo.`)
      let hechos = 0
      for (const lote of chunk(datos, 450)) {
        const batch = writeBatch(db)
        for (const item of lote) {
          const nuevoRef = doc(collection(db, coleccion))
          batch.set(nuevoRef, item)
        }
        await batch.commit()
        hechos += lote.length
        agregarLog(`  ${hechos}/${datos.length} escritos en "${coleccion}"`)
      }
      agregarLog('Listo.')
    } catch (err) {
      console.error(err)
      agregarLog(`ERROR: ${(err as Error).message}`)
    } finally {
      setCorriendo(false)
    }
  }

  return (
    <div className="ih-card">
      <h3>{titulo}</h3>
      {nota && <p className="ih-nota">{nota}</p>}
      <input
        type="file"
        accept="application/json"
        onChange={(e: ChangeEvent<HTMLInputElement>) => setArchivo(e.target.files?.[0] || null)}
      />
      <button className="btn-primary" onClick={importar} disabled={!archivo || corriendo}>
        {corriendo ? 'Importando...' : `Importar a "${coleccion}"`}
      </button>
      {log.length > 0 && (
        <pre className="ih-log">{log.join('\n')}</pre>
      )}
    </div>
  )
}

function SeccionChina() {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [corriendo, setCorriendo] = useState(false)

  function agregarLog(linea: string) {
    setLog((prev) => [...prev, linea])
  }

  async function importar() {
    if (!archivo) return
    setCorriendo(true)
    setLog([])
    try {
      const datos = await leerJson(archivo)
      const clientes = datos.clientes || {}
      const contenedores = datos.contenedores || {}
      const recibos = datos.recibos || {}

      agregarLog(`chinaClientes: ${Object.keys(clientes).length}`)
      const clienteIdMap: Record<string, string> = {}
      for (const [oldId, data] of Object.entries<any>(clientes)) {
        const { etiquetaB64, etiquetaNombreArchivo, ...resto } = data
        const nuevoRef = await addDoc(collection(db, 'chinaClientes'), resto)
        clienteIdMap[oldId] = nuevoRef.id
        if (etiquetaB64) {
          const url = await subirBase64(`china/clientes/${nuevoRef.id}/${Date.now()}_${etiquetaNombreArchivo || 'etiqueta.pdf'}`, etiquetaB64)
          await updateDoc(doc(db, 'chinaClientes', nuevoRef.id), { etiquetaUrl: url, etiquetaNombreArchivo: etiquetaNombreArchivo || '' })
        }
        agregarLog(`  ${oldId} -> ${nuevoRef.id} (${resto.nombre})`)
      }

      agregarLog(`\nchinaContenedores: ${Object.keys(contenedores).length}`)
      const contenedorIdMap: Record<string, string> = {}
      for (const [oldId, data] of Object.entries<any>(contenedores)) {
        const nuevoRef = await addDoc(collection(db, 'chinaContenedores'), data)
        contenedorIdMap[oldId] = nuevoRef.id
        agregarLog(`  ${oldId} -> ${nuevoRef.id} (${data.nombre})`)
      }

      agregarLog(`\nchinaRecibos: ${Object.keys(recibos).length}`)
      for (const [oldId, data] of Object.entries<any>(recibos)) {
        const {
          clienteId_old,
          contenedorId_old,
          facturaB64,
          facturaNombreArchivo,
          packingB64,
          packingNombreArchivo,
          fotoB64,
          fotoNombreArchivo,
          ...resto
        } = data
        const doc0 = {
          ...resto,
          clienteId: clienteIdMap[clienteId_old] || '',
          contenedorId: contenedorId_old ? contenedorIdMap[contenedorId_old] || '' : '',
        }
        const nuevoRef = await addDoc(collection(db, 'chinaRecibos'), doc0)
        const extra: Record<string, string> = {}
        if (facturaB64) {
          extra.facturaUrl = await subirBase64(`china/recibos/${nuevoRef.id}/factura_${Date.now()}_${facturaNombreArchivo || 'factura.pdf'}`, facturaB64)
          extra.facturaNombreArchivo = facturaNombreArchivo || ''
        }
        if (packingB64) {
          extra.packingUrl = await subirBase64(`china/recibos/${nuevoRef.id}/packing_${Date.now()}_${packingNombreArchivo || 'packing.pdf'}`, packingB64)
          extra.packingNombreArchivo = packingNombreArchivo || ''
        }
        if (fotoB64) {
          extra.fotoUrl = await subirBase64(`china/recibos/${nuevoRef.id}/foto_${Date.now()}_${fotoNombreArchivo || 'foto.jpg'}`, fotoB64)
          extra.fotoNombreArchivo = fotoNombreArchivo || ''
        }
        if (Object.keys(extra).length > 0) {
          await updateDoc(doc(db, 'chinaRecibos', nuevoRef.id), extra)
        }
        agregarLog(`  ${oldId} -> ${nuevoRef.id}`)
      }

      agregarLog('\nListo.')
    } catch (err) {
      console.error(err)
      agregarLog(`ERROR: ${(err as Error).message}`)
    } finally {
      setCorriendo(false)
    }
  }

  return (
    <div className="ih-card">
      <h3>Carga China (clientes + contenedores + recibos, con adjuntos)</h3>
      <p className="ih-nota">
        Un solo archivo combinado (china_import.json) con las 3 colecciones y los adjuntos en base64. Los clientes y
        contenedores se importan primero para poder enlazar los recibos con sus IDs nuevos.
      </p>
      <input
        type="file"
        accept="application/json"
        onChange={(e: ChangeEvent<HTMLInputElement>) => setArchivo(e.target.files?.[0] || null)}
      />
      <button className="btn-primary" onClick={importar} disabled={!archivo || corriendo}>
        {corriendo ? 'Importando...' : 'Importar Carga China'}
      </button>
      {log.length > 0 && <pre className="ih-log">{log.join('\n')}</pre>}
    </div>
  )
}

export default function ImportarHistorico() {
  const { rol } = useAuth()

  if (rol !== 'admin') {
    return (
      <div className="ih-page">
        <h1>Importar historico</h1>
        <p>Esta pagina es solo para el administrador.</p>
      </div>
    )
  }

  return (
    <div className="ih-page">
      <h1>Importar historico del panel viejo</h1>
      <p className="ih-nota">
        Pagina de un solo uso. Selecciona cada archivo *_import.json (ya preparados en la carpeta _migracion-rrhh/import
        de tu Mac) y apreta el boton correspondiente. Se puede correr cada seccion por separado, en cualquier orden,
        pero corre Carga China en un solo archivo combinado.
      </p>
      <SeccionSimple titulo="Bodega" coleccion="bodega" nota="Archivo: bodega_import.json" />
      <SeccionSimple titulo="Guias Nacionales" coleccion="guiasNacionales" nota="Archivo: guiasNacionales_import.json" />
      <SeccionSimple titulo="Envio de guias (Cargo Expreso)" coleccion="cargoExpreso" nota="Archivo: cargoExpreso_import.json" />
      <SeccionChina />
    </div>
  )
}
