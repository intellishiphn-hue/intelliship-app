// Distancia en metros entre dos coordenadas GPS (formula haversine), usada
// para validar que una marcacion de asistencia se hizo cerca de la oficina.
export function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // radio de la Tierra en metros
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

// Fecha local (no UTC) en formato YYYY-MM-DD, para que la marcacion quede
// fechada segun el dia real del empleado y no se corra por diferencia de
// huso horario al convertir a UTC.
export function fechaLocal(fecha = new Date()): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
