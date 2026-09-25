// Calculo del saldo de vacaciones por empleado, segun como Sergio la aplica
// en la empresa (confirmado 2026-09-25):
// - El primer anio de trabajo NO acumula vacaciones (0 dias).
// - Al cumplir cada anio de servicio continuo le corresponden, por tabla
//   del Codigo del Trabajo de Honduras (Art. 346): 10 dias (anio 1),
//   12 (anio 2), 15 (anio 3), 20 (anio 4 o mas).
// - El saldo se calcula por "anio de aniversario" (desde la fecha de
//   ingreso): los dias correspondientes de ese periodo, menos los dias
//   habiles de vacaciones ya usados dentro de ese mismo periodo.

export function aniosCompletos(fechaIngreso: string, hoy = new Date()): number {
  if (!fechaIngreso) return 0
  const ingreso = new Date(fechaIngreso + 'T00:00:00')
  if (isNaN(ingreso.getTime())) return 0
  let anios = hoy.getFullYear() - ingreso.getFullYear()
  const aniversarioEsteAnio = new Date(ingreso)
  aniversarioEsteAnio.setFullYear(hoy.getFullYear())
  if (hoy < aniversarioEsteAnio) anios--
  return Math.max(0, anios)
}

export function diasPorAntiguedad(anios: number): number {
  if (anios <= 0) return 0
  if (anios === 1) return 10
  if (anios === 2) return 12
  if (anios === 3) return 15
  return 20
}

// Fecha del aniversario mas reciente (inicio del "anio de vacaciones" actual)
// y la del siguiente aniversario (fin de ese periodo).
export function periodoAniversarioActual(fechaIngreso: string, hoy = new Date()) {
  const ingreso = new Date(fechaIngreso + 'T00:00:00')
  const inicio = new Date(ingreso)
  inicio.setFullYear(hoy.getFullYear())
  if (inicio > hoy) inicio.setFullYear(inicio.getFullYear() - 1)
  const fin = new Date(inicio)
  fin.setFullYear(fin.getFullYear() + 1)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { inicio: fmt(inicio), fin: fmt(fin) }
}

export type RegistroVacacion = {
  empleadoId: string
  tipo: string
  fechaInicio: string
  diasHabiles: number
}

export function calcularSaldo(
  fechaIngreso: string,
  registros: RegistroVacacion[],
  hoy = new Date()
) {
  const anios = aniosCompletos(fechaIngreso, hoy)
  const correspondientes = diasPorAntiguedad(anios)
  const { inicio, fin } = periodoAniversarioActual(fechaIngreso, hoy)
  const usados = registros
    .filter((r) => r.tipo === 'vacaciones')
    .filter((r) => r.fechaInicio >= inicio && r.fechaInicio < fin)
    .reduce((sum, r) => sum + (r.diasHabiles || 0), 0)
  const pendientes = Math.max(0, correspondientes - usados)
  return { anios, correspondientes, usados, pendientes, periodoInicio: inicio, periodoFin: fin }
}
