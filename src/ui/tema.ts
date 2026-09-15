/**
 * Tokens visuales.
 *
 * La app se abre de a ratos, muchas veces al día, casi siempre para mirar
 * una cifra y cerrar. Así que el fondo es oscuro y profundo, y lo único
 * que brilla son los montos. Todo lo demás —bordes, etiquetas, iconos—
 * se mantiene callado.
 *
 * El acento rosa viene del nombre: una alcancía. Es el único color cálido
 * en una paleta fría, así que el ojo va directo a donde está el dinero.
 */

export const colores = {
  fondo: '#0E1B1F',
  superficie: '#16272C',
  superficieAlta: '#1D333A',
  borde: '#22383F',

  texto: '#EAF2F1',
  textoSuave: '#9FB6BC',
  textoTenue: '#6B8992',

  acento: '#F2A0B5',
  acentoProfundo: '#C4687F',

  ingreso: '#6FD0A8',
  atencion: '#E9B949',
  peligro: '#E8735F',
} as const;

export const espacio = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radio = {
  sm: 8,
  md: 14,
  lg: 20,
} as const;

/**
 * Escala tipográfica. Las cifras usan `tabular-nums` para que los dígitos
 * no bailen cuando el monto cambia: en una lista de gastos alineados a la
 * derecha, sin esto el ancho de cada número varía y la columna tiembla.
 */
export const tipografia = {
  cifraGrande: {
    fontSize: 40,
    fontWeight: '600' as const,
    letterSpacing: -1,
    fontVariant: ['tabular-nums' as const],
  },
  cifra: {
    fontSize: 17,
    fontWeight: '600' as const,
    fontVariant: ['tabular-nums' as const],
  },
  titulo: { fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.3 },
  cuerpo: { fontSize: 15, fontWeight: '400' as const },
  etiqueta: { fontSize: 13, fontWeight: '500' as const },
  menudo: { fontSize: 12, fontWeight: '400' as const },
} as const;

/** Fecha legible en español, sin depender de librerías externas. */
export function fechaLegible(ms: number): string {
  const fecha = new Date(ms);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy.getTime() - 86_400_000);

  const hora = fecha.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (fecha.getTime() >= hoy.getTime()) return `Hoy, ${hora}`;
  if (fecha.getTime() >= ayer.getTime()) return `Ayer, ${hora}`;

  return fecha.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: fecha.getFullYear() === hoy.getFullYear() ? undefined : 'numeric',
  });
}
