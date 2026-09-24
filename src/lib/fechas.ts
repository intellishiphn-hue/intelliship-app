// Calcula dias habiles entre dos fechas (inclusive), contando de lunes a
// sabado. Solo el domingo se excluye. Esta es la correccion que hicimos en
// el sistema anterior: antes tambien se excluia el sabado por error, lo que
// hacia que unas vacaciones que incluian un sabado mostraran "0 dias habiles".
export function diasHabiles(fechaInicio: string, fechaFin: string): number {
  const inicio = new Date(fechaInicio + 'T00:00:00')
  const fin = new Date(fechaFin + 'T00:00:00')
  let contador = 0
  const cursor = new Date(inicio)
  while (cursor <= fin) {
    const diaSemana = cursor.getDay() // 0 = domingo
    if (diaSemana !== 0) contador++
    cursor.setDate(cursor.getDate() + 1)
  }
  return contador
}
