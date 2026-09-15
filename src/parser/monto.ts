/**
 * Normalización de montos en pesos colombianos.
 *
 * En Colombia el punto separa miles y la coma los decimales: $1.234.567,89
 * Los bancos casi nunca envían decimales en notificaciones push, pero
 * Nequi y algunas pasarelas sí lo hacen, así que hay que soportarlo.
 */

/**
 * Convierte el texto de un monto a número.
 * Acepta: "1.234.567", "$1.234.567,89", "COP 52.900", "52900", "1'234.567"
 * Devuelve null si el texto no representa un monto válido.
 *
 * O(n) sobre la longitud del texto.
 */
export function normalizarMonto(texto: string): number | null {
  if (!texto) return null;

  // Quitar símbolo de moneda, espacios (incluido el no-rompible) y apóstrofes.
  // El apóstrofe aparece en documentos colombianos como separador de millones.
  let limpio = texto
    .replace(/COP|\$|\u00A0/gi, '')
    .replace(/['\s]/g, '')
    .trim();

  if (!limpio) return null;

  const tienePunto = limpio.includes('.');
  const tieneComa = limpio.includes(',');

  if (tienePunto && tieneComa) {
    // Formato completo: 1.234.567,89 → el último separador manda como decimal.
    if (limpio.lastIndexOf(',') > limpio.lastIndexOf('.')) {
      limpio = limpio.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglosajón colado: 1,234,567.89
      limpio = limpio.replace(/,/g, '');
    }
  } else if (tieneComa) {
    // Una sola coma: decimal si deja 1 o 2 dígitos, si no es separador de miles.
    const despues = limpio.length - limpio.lastIndexOf(',') - 1;
    limpio = despues <= 2 ? limpio.replace(',', '.') : limpio.replace(/,/g, '');
  } else if (tienePunto) {
    // Una sola secuencia de puntos. "52.900" son miles, "52.90" son decimales.
    const despues = limpio.length - limpio.lastIndexOf('.') - 1;
    const puntos = (limpio.match(/\./g) || []).length;
    if (puntos > 1 || despues === 3) {
      limpio = limpio.replace(/\./g, '');
    }
    // Si despues es 1 o 2 lo dejamos: ya es decimal válido.
  }

  const valor = Number(limpio);
  if (!Number.isFinite(valor) || valor <= 0) return null;

  return Math.round(valor * 100) / 100;
}

/** Formatea un número como moneda colombiana para mostrar en pantalla. */
export function formatearCOP(valor: number, conDecimales = false): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: conDecimales ? 2 : 0,
    maximumFractionDigits: conDecimales ? 2 : 0,
  }).format(valor);
}
