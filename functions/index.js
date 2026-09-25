/**
 * Cloud Functions de intelliship-prod: automatizaciones de WhatsApp.
 *
 * Todo lo sensible (token de acceso, ID del numero de WhatsApp) vive en
 * Secret Manager, nunca en este archivo ni en el repo. Sergio los configura
 * el mismo, una sola vez, desde su Terminal (nunca compartir el valor por
 * chat):
 *
 *   firebase functions:secrets:set WHATSAPP_TOKEN --project intelliship-prod
 *   firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID --project intelliship-prod
 *
 * Los nombres de las plantillas (deben existir YA APROBADAS en Meta
 * Business Manager -> WhatsApp Manager -> Plantillas de mensajes, porque
 * WhatsApp no permite mandar texto libre de forma proactiva, solo
 * plantillas pre-aprobadas) se configuran igual si los nombres por defecto
 * de abajo no coinciden con los reales:
 *
 *   firebase functions:secrets:set WHATSAPP_TEMPLATE_PAGO --project intelliship-prod
 *   firebase functions:secrets:set WHATSAPP_TEMPLATE_ESTADO --project intelliship-prod
 *
 * Cada plantilla debe tener exactamente las variables de cuerpo en el
 * mismo orden que se manda aqui abajo (ver comentarios en cada funcion).
 *
 * WHATSAPP_TEMPLATE_ESTADO se usa dos veces: cuando cambia el estado de un
 * envio de Carga China (notificarCambioEstadoEnvio) Y cuando se recibe un
 * paquete nuevo (notificarRecibidoChina, manda el estado inicial). Es el
 * mismo comportamiento que tenia el panel viejo (avisar en cada paso del
 * seguimiento), solo que ahi usaba dos plantillas distintas para el primer
 * aviso y los siguientes -- aca se unifico en una sola para no pedir una
 * tercera plantilla en Meta.
 */

const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const pdfParse = require('pdf-parse')
const { defineSecret } = require('firebase-functions/params')
const logger = require('firebase-functions/logger')

initializeApp()
const db = getFirestore()

const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN')
const WHATSAPP_PHONE_NUMBER_ID = defineSecret('WHATSAPP_PHONE_NUMBER_ID')
const WHATSAPP_TEMPLATE_PAGO = defineSecret('WHATSAPP_TEMPLATE_PAGO')
const WHATSAPP_TEMPLATE_ESTADO = defineSecret('WHATSAPP_TEMPLATE_ESTADO')
const WHATSAPP_TEMPLATE_GUIA = defineSecret('WHATSAPP_TEMPLATE_GUIA')

const IDIOMA_PLANTILLA = 'es'

// Numeros en Firestore se guardan como el empleado/cliente los escribio
// (normalmente 8 digitos, formato Honduras). WhatsApp Cloud API necesita
// el numero completo en formato internacional sin "+" (ej. 50499999999).
function normalizarTelefonoHN(telefono) {
  const soloDigitos = String(telefono || '').replace(/\D/g, '')
  if (!soloDigitos) return null
  if (soloDigitos.startsWith('504') && soloDigitos.length === 11) return soloDigitos
  if (soloDigitos.length === 8) return '504' + soloDigitos
  // Numero con otro formato (ya trae codigo de pais distinto, o esta mal
  // capturado) -- se manda tal cual y que la API de Meta decida.
  return soloDigitos
}

// Cada courier tiene su propio formato de link de rastreo. El "aid" de
// Cargo Expreso es fijo para la cuenta de INTELLISHIP (se confirmo en los
// 981 envios historicos que todos lo comparten). Si Cargo Expreso cambia
// ese id algun dia, se actualiza aqui.
const CARGO_EXPRESO_AID = '3d0aea44-9cb5-424a-9b80-3b44b7a62b29'

function construirLinkRastreo(empresa, guia) {
  const empresaNorm = String(empresa || '').toUpperCase()
  if (empresaNorm.includes('FORZA')) {
    // Forza usa el numero de guia SIN el sufijo "-N" que se le agrega en
    // el sistema (ej. "FD40707137-1" -> "FD40707137").
    const base = String(guia || '').split('-')[0]
    return `https://rastreo.forzadelivery.com/${base}`
  }
  // Por defecto, Cargo Expreso (el courier mas usado).
  return `https://tracking.caexlogistics.com/componentes/siscaexhn/Tracking?aid=${CARGO_EXPRESO_AID}&ordno=${guia}`
}

function formatearLempiras(monto) {
  const n = Number(monto) || 0
  return 'L ' + n.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function enviarPlantillaWhatsapp({ telefono, plantilla, parametros }) {
  const to = normalizarTelefonoHN(telefono)
  if (!to) {
    return { exito: false, error: 'Sin numero de telefono valido' }
  }

  const token = WHATSAPP_TOKEN.value()
  const phoneNumberId = WHATSAPP_PHONE_NUMBER_ID.value()

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: plantilla,
      language: { code: IDIOMA_PLANTILLA },
      components: [
        {
          type: 'body',
          parameters: parametros.map((texto) => ({ type: 'text', text: String(texto) })),
        },
      ],
    },
  }

  try {
    const resp = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      logger.error('WhatsApp API respondio con error', { status: resp.status, data })
      return { exito: false, error: data?.error?.message || `HTTP ${resp.status}` }
    }
    return { exito: true }
  } catch (err) {
    logger.error('Fallo la llamada a la API de WhatsApp', err)
    return { exito: false, error: String(err) }
  }
}

async function registrarLog(entrada) {
  try {
    await db.collection('waLogs').add({ ...entrada, creadoEn: FieldValue.serverTimestamp() })
  } catch (err) {
    logger.error('No se pudo guardar el log de WhatsApp', err)
  }
}

// Se dispara al crear un pago en Nomina (pagos/{id}). Plantilla esperada
// (WHATSAPP_TEMPLATE_PAGO, por defecto "recibo_pago") con 3 variables de
// cuerpo en este orden: {{1}} nombre del empleado, {{2}} periodo + mes
// (ej. "1ra Quincena de Septiembre"), {{3}} monto neto formateado (ej.
// "L 8,500.00").
exports.notificarPagoPorWhatsapp = onDocumentCreated(
  { document: 'pagos/{pagoId}', secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_PAGO] },
  async (event) => {
    const pago = event.data?.data()
    if (!pago?.empleadoId) return

    const empleadoSnap = await db.collection('empleados').doc(pago.empleadoId).get()
    const empleado = empleadoSnap.data()
    if (!empleado) {
      await registrarLog({
        tipo: 'pago',
        empleadoId: pago.empleadoId,
        exito: false,
        error: 'Empleado no encontrado',
      })
      return
    }

    const resultado = await enviarPlantillaWhatsapp({
      telefono: empleado.telefono,
      plantilla: WHATSAPP_TEMPLATE_PAGO.value() || 'recibo_pago',
      parametros: [
        empleado.nombre || 'empleado/a',
        `${pago.periodo || ''} de ${pago.mes || ''}`.trim(),
        formatearLempiras(pago.montoNeto),
      ],
    })

    await registrarLog({
      tipo: 'pago',
      empleadoId: pago.empleadoId,
      telefono: empleado.telefono || null,
      destinatario: empleado.nombre || null,
      ...resultado,
    })
  }
)

// Se dispara cuando cambia el campo "estado" de un recibo de Carga China
// (chinaRecibos/{id}). Plantilla esperada (WHATSAPP_TEMPLATE_ESTADO, por
// defecto "cambio_estado_envio") con 3 variables de cuerpo en este orden:
// {{1}} nombre del cliente, {{2}} contenido/casillero del envio, {{3}}
// nuevo estado.
exports.notificarCambioEstadoEnvio = onDocumentUpdated(
  { document: 'chinaRecibos/{reciboId}', secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_ESTADO] },
  async (event) => {
    const antes = event.data?.before?.data()
    const despues = event.data?.after?.data()
    if (!despues || !antes) return
    if (antes.estado === despues.estado) return

    const clienteSnap = await db.collection('chinaClientes').doc(despues.clienteId).get()
    const cliente = clienteSnap.data()
    if (!cliente) {
      await registrarLog({
        tipo: 'estado_envio',
        reciboId: event.params.reciboId,
        exito: false,
        error: 'Cliente no encontrado',
      })
      return
    }

    const resultado = await enviarPlantillaWhatsapp({
      telefono: cliente.telefono,
      plantilla: WHATSAPP_TEMPLATE_ESTADO.value() || 'cambio_estado_envio',
      parametros: [cliente.nombre || 'cliente', despues.contenido || cliente.casillero || 'su envio', despues.estado],
    })

    await registrarLog({
      tipo: 'estado_envio',
      reciboId: event.params.reciboId,
      clienteId: despues.clienteId,
      telefono: cliente.telefono || null,
      destinatario: cliente.nombre || null,
      estadoNuevo: despues.estado,
      ...resultado,
    })
  }
)


// Se dispara cuando se crea un recibo nuevo de Carga China (paquete
// recibido en la bodega de China). Usa la MISMA plantilla que los cambios
// de estado (WHATSAPP_TEMPLATE_ESTADO) mandando el estado inicial como
// "nuevo estado" -- asi el cliente recibe WhatsApp desde el primer momento
// que su paquete entra al sistema, no solo en cambios posteriores. (El
// panel viejo usaba una plantilla separada para este primer aviso; se opto
// por reusar la misma para no pedirle a Sergio que configure una tercera
// plantilla en Meta -- si se prefiere un mensaje distinto para este primer
// aviso, se puede separar despues con su propio WHATSAPP_TEMPLATE_RECIBIDO.)
exports.notificarRecibidoChina = onDocumentCreated(
  { document: 'chinaRecibos/{reciboId}', secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_ESTADO] },
  async (event) => {
    const recibo = event.data?.data()
    if (!recibo?.clienteId) return

    const clienteSnap = await db.collection('chinaClientes').doc(recibo.clienteId).get()
    const cliente = clienteSnap.data()
    if (!cliente) {
      await registrarLog({
        tipo: 'recibido_china',
        reciboId: event.params.reciboId,
        exito: false,
        error: 'Cliente no encontrado',
      })
      return
    }

    const resultado = await enviarPlantillaWhatsapp({
      telefono: cliente.telefono,
      plantilla: WHATSAPP_TEMPLATE_ESTADO.value() || 'cambio_estado_envio',
      parametros: [cliente.nombre || 'cliente', recibo.contenido || cliente.casillero || 'su envio', recibo.estado],
    })

    await registrarLog({
      tipo: 'recibido_china',
      reciboId: event.params.reciboId,
      clienteId: recibo.clienteId,
      telefono: cliente.telefono || null,
      destinatario: cliente.nombre || null,
      estadoNuevo: recibo.estado,
      ...resultado,
    })
  }
)


// Se dispara cuando se crea una guia nueva en Envio de guias
// (cargoExpreso/{id}) -- ya sea desde el formulario manual, o desde la
// carga masiva de PDF que arma este mismo registro. Plantilla esperada
// (WHATSAPP_TEMPLATE_GUIA, por defecto "envio_confirmado") con 3
// variables de cuerpo en este orden: {{1}} nombre del cliente, {{2}}
// numero de guia, {{3}} link de rastreo (se arma solo segun la empresa --
// Cargo Expreso o Forza).
exports.notificarEnvioGuia = onDocumentCreated(
  { document: 'cargoExpreso/{envioId}', secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_GUIA] },
  async (event) => {
    const envio = event.data?.data()
    if (!envio?.guia) return

    const link = envio.link || construirLinkRastreo(envio.empresa, envio.guia)
    if (!envio.link) {
      await event.data.ref.update({ link }).catch(() => {})
    }

    const resultado = await enviarPlantillaWhatsapp({
      telefono: envio.telefono,
      plantilla: WHATSAPP_TEMPLATE_GUIA.value() || 'envio_confirmado',
      parametros: [envio.nombre || 'cliente', envio.guia, link],
    })

    await registrarLog({
      tipo: 'envio_guia',
      envioId: event.params.envioId,
      telefono: envio.telefono || null,
      destinatario: envio.nombre || null,
      guia: envio.guia,
      ...resultado,
    })
  }
)


// Lee un PDF de guias (Cargo Expreso o Forza, una etiqueta por pagina, el
// mismo formato que exporta cada courier al despachar varios paquetes) y
// devuelve los datos de cada paquete (nombre, telefono, guia, fecha) para
// que el panel los muestre en una vista previa ANTES de crear nada -- no
// escribe en Firestore, eso lo hace el navegador despues de que el admin
// confirma la vista previa, con su propia sesion. No necesita secretos.
//
// Formato esperado por etiqueta de Cargo Expreso (confirmado contra un PDF
// real de 19 guias): cada bloque empieza con "GRUPO LOGISTICO SACA S. DE
// R.L.", trae "Nombre Destinatario" seguido del nombre en la siguiente
// linea, "Telefono" seguido del telefono, un numero de guia suelto
// (formato 123456789-1) y una fecha suelta (formato D-M-AAAA).
function parseGuiasCargoExpreso(texto) {
  const bloques = texto.split(/GRUPO LOGISTICO SACA S\. DE R\.L\./).slice(1)
  const resultados = []
  for (const bloque of bloques) {
    const lineas = bloque
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const idxNombre = lineas.indexOf('Nombre Destinatario')
    const idxTelefono = lineas.indexOf('Teléfono')
    const idxGuia = lineas.findIndex((l) => /^\d{6,12}-\d+$/.test(l))
    const idxFecha = lineas.findIndex((l) => /^\d{1,2}-\d{1,2}-\d{4}$/.test(l))
    if (idxNombre === -1 || idxTelefono === -1 || idxGuia === -1) continue
    const nombre = lineas[idxNombre + 1] || ''
    const telefono = lineas[idxTelefono + 1] || ''
    const guia = lineas[idxGuia]
    let fecha = null
    if (idxFecha !== -1) {
      const [d, m, y] = lineas[idxFecha].split('-')
      fecha = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
    resultados.push({
      nombre,
      telefono,
      guia,
      fecha,
      telefonoValido: /^\d{3,4}-\d{4}$/.test(telefono),
    })
  }
  return resultados
}

// Deja un telefono en el mismo formato local que usa el resto del panel
// (8 digitos con guion, ej. "9999-9999"), venga como venga en la etiqueta
// (Forza lo imprime en formato internacional, ej. "+50488164497").
function formatearTelefonoLocalHN(crudo) {
  const soloDigitos = String(crudo || '').replace(/\D/g, '')
  let ocho = soloDigitos
  if (soloDigitos.startsWith('504') && soloDigitos.length === 11) ocho = soloDigitos.slice(3)
  if (ocho.length !== 8) return String(crudo || '').trim()
  return `${ocho.slice(0, 4)}-${ocho.slice(4)}`
}

// Formato esperado por etiqueta de Forza (confirmado contra un PDF real de
// 1 guia -- si al usarlo con mas guias aparecen casos que no calcen,
// revisar aqui primero). Cada bloque empieza con "INTELLISHIP HONDURAS"
// (el remitente, siempre el mismo). Dentro del bloque hay dos lineas
// "Tel.: ..." -- la primera es el telefono de INTELLISHIP (remitente, se
// ignora), la segunda es el telefono del destinatario, y el nombre del
// destinatario es la linea justo antes de esa segunda "Tel.:". El numero
// de guia es la unica linea suelta de puros digitos (6 a 10). La fecha
// sale de la linea "Usuario: ... DD/MM/AAAA HH:MM".
function parseGuiasForza(texto) {
  const bloques = texto.split(/INTELLISHIP HONDURAS/).slice(1)
  const resultados = []
  for (const bloque of bloques) {
    const lineas = bloque
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const idxsTel = []
    lineas.forEach((l, i) => {
      if (/^Tel\.:/.test(l)) idxsTel.push(i)
    })
    if (idxsTel.length < 2) continue
    const idxTelDestinatario = idxsTel[1]
    const nombre = lineas[idxTelDestinatario - 1] || ''
    const telefono = formatearTelefonoLocalHN(lineas[idxTelDestinatario].replace(/^Tel\.:\s*/, ''))
    const idxGuia = lineas.findIndex((l) => /^\d{6,10}$/.test(l))
    if (idxGuia === -1) continue
    const guia = lineas[idxGuia]
    const idxUsuario = lineas.findIndex((l) => /^Usuario:/.test(l))
    let fecha = null
    if (idxUsuario !== -1) {
      const m = lineas[idxUsuario].match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
      if (m) fecha = `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
    }
    resultados.push({
      nombre,
      telefono,
      guia,
      fecha,
      telefonoValido: /^\d{3,4}-\d{4}$/.test(telefono),
    })
  }
  return resultados
}

exports.procesarGuiasPdf = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Hace falta iniciar sesion.')
  }
  const base64 = request.data?.pdfBase64
  if (!base64) {
    throw new HttpsError('invalid-argument', 'Falta el PDF (pdfBase64).')
  }
  const empresa = String(request.data?.empresa || 'Cargo Expreso')
  const buffer = Buffer.from(base64, 'base64')
  let data
  try {
    data = await pdfParse(buffer)
  } catch (err) {
    logger.error('No se pudo leer el PDF', err)
    throw new HttpsError('invalid-argument', 'No se pudo leer el PDF. Verifica que sea un PDF de guias.')
  }
  const filas = empresa.toUpperCase().includes('FORZA') ? parseGuiasForza(data.text) : parseGuiasCargoExpreso(data.text)
  return { filas, totalPaginas: data.numpages }
})
