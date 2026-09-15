/**
 * HU-02: Filtrado de notificaciones para evitar falsos positivos.
 *
 * Tres barreras en cascada, de la más barata a la más costosa:
 *   1. ¿El paquete es de un banco conocido?         → O(1)
 *   2. ¿El texto contiene ruido publicitario?       → O(n)
 *   3. ¿El texto contiene una palabra de operación? → O(n)
 *
 * Una notificación tiene que pasar las tres para llegar al parser.
 */

import { INDICE_PAQUETES, type PatronBanco } from './bancos';

/**
 * Palabras que marcan una notificación como NO transaccional.
 * Los bancos usan el mismo canal para promociones, alertas de seguridad
 * y recordatorios: sin esto, la app registraría "gastos" que no existen.
 */
const RUIDO = [
  'promoción',
  'promocion',
  'descuento',
  'aprovecha',
  'felicitaciones',
  'gana ',
  'sorteo',
  'premio',
  'actualiza tu app',
  'nueva versión',
  'nueva version',
  'encuesta',
  'califica',
  'no compartas',
  'nunca te pediremos',
  'intento de acceso',
  'clave dinámica',
  'clave dinamica',
  'token',
  'código de verificación',
  'codigo de verificacion',
  'saldo disponible',
  'tu extracto',
  'fecha límite de pago',
  'fecha limite de pago',
  'cuota',
  'seguro',
  'crédito preaprobado',
  'credito preaprobado',
];

/**
 * Palabras que indican que sí hubo movimiento de dinero.
 * Sin al menos una de estas, no procesamos.
 */
const OPERACION = [
  // Español
  'compra',
  'compraste',
  'pagaste',
  'pago',
  'transferencia',
  'transferiste',
  'enviaste',
  'mandaste',
  'retiro',
  'retiraste',
  'cargo',
  'débito',
  'debito',
  'recibiste',
  'te enviaron',
  'avance',
  // Inglés (PayPal y apps internacionales)
  'you sent',
  'you received',
  'payment of',
  'charged',
  'sent',
];

export interface ResultadoFiltro {
  aceptada: boolean;
  /** Presente solo si `aceptada` es true. */
  banco?: PatronBanco;
  /** Por qué se descartó. Se guarda en el log de diagnóstico. */
  motivo?: 'paquete-desconocido' | 'sin-texto' | 'ruido' | 'sin-operacion';
  /** Término que activó el descarte, útil para afinar las listas. */
  coincidencia?: string;
}

/**
 * Decide si una notificación merece pasar al parser.
 * Complejidad: O(n·k) donde n es el largo del texto y k el número de
 * términos en las listas. Ambas son pequeñas y constantes en la práctica.
 */
export function filtrar(
  paquete: string,
  titulo: string,
  texto: string
): ResultadoFiltro {
  const banco = INDICE_PAQUETES.get((paquete || '').toLowerCase());
  if (!banco) {
    return { aceptada: false, motivo: 'paquete-desconocido' };
  }

  const contenido = `${titulo || ''} ${texto || ''}`.trim().toLowerCase();
  if (!contenido) {
    return { aceptada: false, motivo: 'sin-texto' };
  }

  const ruido = RUIDO.find((termino) => contenido.includes(termino));
  if (ruido) {
    return { aceptada: false, motivo: 'ruido', coincidencia: ruido };
  }

  const operacion = OPERACION.find((termino) => contenido.includes(termino));
  if (!operacion) {
    return { aceptada: false, motivo: 'sin-operacion' };
  }

  return { aceptada: true, banco, coincidencia: operacion };
}

/** Expuesto para la pantalla de diagnóstico y para los tests. */
export const LISTAS = { RUIDO, OPERACION };
