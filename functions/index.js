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
 */

const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { defineSecret } = require('firebase-functions/params')
const logger = require('firebase-functions/logger')

initializeApp()
const db = getFirestore()

const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN')
const WHATSAPP_PHONE_NUMBER_ID = defineSecret('WHATSAPP_PHONE_NUMBER_ID')
const WHATSAPP_TEMPLATE_PAGO = defineSecret('WHATSAPP_TEMPLATE_PAGO')
const WHATSAPP_TEMPLATE_ESTADO = defineSecret('WHATSAPP_TEMPLATE_ESTADO')

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
