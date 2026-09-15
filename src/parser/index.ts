/**
 * Parser de notificaciones bancarias.
 *
 * Entrada: la notificación cruda que entrega el listener de Android.
 * Salida: un gasto listo para registrar, un pendiente de confirmación,
 *         o un descarte con su motivo.
 *
 * Nunca lanza excepciones: una notificación malformada devuelve un
 * descarte, porque este código corre en un headless task donde un throw
 * mata el proceso en silencio y se pierde el gasto.
 */

import { BANCOS, REGLA_GENERICA, type TipoMovimiento } from './bancos';
import { filtrar } from './filtros';
import { normalizarMonto } from './monto';

export interface NotificacionCruda {
  /** Package name de Android. Campo `app` del módulo nativo. */
  app: string;
  title?: string;
  titleBig?: string;
  text?: string;
  bigText?: string;
  subText?: string;
  /** Milisegundos epoch, como string, según entrega el módulo. */
  time?: string;
}

export type ResultadoParser =
  | {
      estado: 'gasto';
      monto: number;
      comercio: string | null;
      tipo: TipoMovimiento;
      banco: string;
      reglaId: string;
      fecha: number;
      textoOriginal: string;
    }
  | {
      estado: 'pendiente';
      /** Puede venir null si ni siquiera se encontró un monto. */
      montoSugerido: number | null;
      banco: string;
      razon: 'sin-regla' | 'monto-invalido';
      fecha: number;
      textoOriginal: string;
    }
  | {
      estado: 'descartada';
      motivo: string;
      coincidencia?: string;
    };

/** Une los campos de texto de la notificación, sin duplicar contenido. */
function componerTexto(n: NotificacionCruda): { titulo: string; cuerpo: string } {
  const titulo = (n.titleBig || n.title || '').trim();
  // bigText suele ser la versión expandida de text: si uno contiene al
  // otro, quedarse con el más largo evita duplicar palabras clave.
  const corto = (n.text || '').trim();
  const largo = (n.bigText || '').trim();
  let cuerpo = largo.length > corto.length ? largo : corto;
  if (corto && largo && !largo.includes(corto) && !corto.includes(largo)) {
    cuerpo = `${corto} ${largo}`;
  }
  const extra = (n.subText || '').trim();
  return { titulo, cuerpo: extra ? `${cuerpo} ${extra}` : cuerpo };
}

/** Limpia el nombre de comercio que capturó la regex. */
function limpiarComercio(valor: string | undefined): string | null {
  if (!valor) return null;
  const limpio = valor
    .replace(/\s+/g, ' ')
    .replace(/[.,;:*\-\s]+$/, '')
    .trim();
  if (limpio.length < 2) return null;
  // Evitar que se cuele una fecha o un número de referencia como comercio.
  if (/^\d+$/.test(limpio)) return null;
  return limpio;
}

function resolverFecha(time?: string): number {
  const valor = Number(time);
  return Number.isFinite(valor) && valor > 0 ? valor : Date.now();
}

/**
 * Procesa una notificación. Complejidad O(r·n): r reglas del banco por el
 * largo del texto. r es a lo sumo 4 y n unos 200 caracteres, así que en la
 * práctica es tiempo constante.
 */
export function parsearNotificacion(n: NotificacionCruda): ResultadoParser {
  const { titulo, cuerpo } = componerTexto(n);
  const revision = filtrar(n.app, titulo, cuerpo);

  if (!revision.aceptada || !revision.banco) {
    return {
      estado: 'descartada',
      motivo: revision.motivo ?? 'desconocido',
      coincidencia: revision.coincidencia,
    };
  }

  const banco = revision.banco;
  const contenido = `${titulo} ${cuerpo}`.trim();
  const fecha = resolverFecha(n.time);

  for (const regla of banco.reglas) {
    const coincidencia = contenido.match(regla.patron);
    if (!coincidencia?.groups) continue;

    const monto = normalizarMonto(coincidencia.groups.monto);
    if (monto === null) {
      // La regla acertó pero el monto no se pudo leer: no adivinamos.
      return {
        estado: 'pendiente',
        montoSugerido: null,
        banco: banco.nombre,
        razon: 'monto-invalido',
        fecha,
        textoOriginal: contenido,
      };
    }

    return {
      estado: 'gasto',
      monto,
      comercio: limpiarComercio(coincidencia.groups.comercio),
      tipo: regla.tipo,
      banco: banco.nombre,
      reglaId: regla.id,
      fecha,
      textoOriginal: contenido,
    };
  }

  // HU-04: el banco es conocido y el texto parece transaccional, pero
  // ninguna regla encajó. Sacamos el monto si podemos y se lo mostramos
  // al usuario para que confirme, en vez de perder el registro.
  const generica = contenido.match(REGLA_GENERICA);
  return {
    estado: 'pendiente',
    montoSugerido: generica?.groups?.monto
      ? normalizarMonto(generica.groups.monto)
      : null,
    banco: banco.nombre,
    razon: 'sin-regla',
    fecha,
    textoOriginal: contenido,
  };
}

export { normalizarMonto, formatearCOP } from './monto';
export { filtrar } from './filtros';
export { BANCOS } from './bancos';
