/**
 * Diccionario de patrones por entidad bancaria colombiana.
 *
 * ────────────────────────────────────────────────────────────────────────
 *  AVISO IMPORTANTE PARA EL EQUIPO
 *
 *  Los `paquete` (package name de Android) y las expresiones regulares de
 *  abajo son un PUNTO DE PARTIDA, no una verdad verificada. No existe
 *  documentación pública de los formatos de notificación de estos bancos,
 *  y cada entidad los cambia sin avisar (es el riesgo #1 del acta).
 *
 *  Antes de confiar en cualquiera de estos patrones, el equipo debe:
 *   1. Instalar la app en un teléfono real con la app del banco.
 *   2. Usar la pantalla "Notificaciones capturadas" (modo diagnóstico) para
 *      ver el texto crudo y el package name exactos de cada notificación.
 *   3. Corregir aquí el patrón y agregar el caso a `parser.test.ts`.
 *
 *  Verificar el package name real es especialmente crítico: si está mal,
 *  el filtro de la HU-02 descarta la notificación y nunca llega al parser.
 * ────────────────────────────────────────────────────────────────────────
 */

export type TipoMovimiento = 'gasto' | 'ingreso';

export interface PatronBanco {
  /** Nombre visible de la entidad. */
  nombre: string;
  /** Package names de Android desde los que llegan sus notificaciones. */
  paquetes: string[];
  /** Reglas de extracción, evaluadas en orden hasta que una acierte. */
  reglas: ReglaExtraccion[];
}

export interface ReglaExtraccion {
  /** Etiqueta interna para depurar cuál regla disparó. */
  id: string;
  tipo: TipoMovimiento;
  /**
   * Debe exponer los grupos nombrados `monto` y, opcionalmente, `comercio`.
   * Se aplica sobre título + texto concatenados.
   */
  patron: RegExp;
}

/**
 * Fragmento reutilizable: un monto en pesos colombianos.
 * Acepta separadores de miles con punto, apóstrofe o nada, y decimales con coma.
 */
const MONTO = String.raw`\$?\s*(?<monto>\d{1,3}(?:[.'\s]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)`;

/** Fragmento reutilizable: nombre de comercio o destinatario. */
const COMERCIO = String.raw`(?<comercio>[A-Za-zÁÉÍÓÚÑáéíóúñ0-9&.\-\s*]{2,60}?)`;

/**
 * Dónde termina el nombre del comercio. Corta ante una fecha (14/09), una
 * hora (10:30) o una referencia, pero NO ante un número suelto: hay comercios
 * que legítimamente terminan en cifra, como "LA REBAJA CALLE 50".
 */
const FIN = String.raw`(?:\s+\d{1,2}[/:-]|\s+(?:ref|aut|apr)\b|[.;]|$)`;

export const BANCOS: PatronBanco[] = [
  {
    nombre: 'Bancolombia',
    paquetes: ['com.todo1.mobile', 'com.bancolombia.app'],
    reglas: [
      {
        id: 'bancolombia-compra',
        tipo: 'gasto',
        patron: new RegExp(
          String.raw`compra\s+(?:aprobada\s+)?por\s+${MONTO}\s+en\s+${COMERCIO}${FIN}`,
          'i'
        ),
      },
      {
        id: 'bancolombia-transferencia',
        tipo: 'gasto',
        patron: new RegExp(
          String.raw`transferencia\s+(?:por\s+)?${MONTO}\s+a\s+${COMERCIO}${FIN}`,
          'i'
        ),
      },
      {
        id: 'bancolombia-retiro',
        tipo: 'gasto',
        patron: new RegExp(String.raw`retiro\s+(?:por\s+)?${MONTO}`, 'i'),
      },
      {
        id: 'bancolombia-recepcion',
        tipo: 'ingreso',
        patron: new RegExp(
          String.raw`(?:recibiste|recepción\s+de)\s+(?:transferencia\s+)?(?:por\s+)?${MONTO}`,
          'i'
        ),
      },
    ],
  },
  {
    nombre: 'Nequi',
    paquetes: ['com.nequi.MobileApp', 'com.nequi.mobileapp'],
    reglas: [
      {
        id: 'nequi-envio',
        tipo: 'gasto',
        patron: new RegExp(
          String.raw`(?:enviaste|mandaste)\s+${MONTO}\s+a\s+${COMERCIO}${FIN}`,
          'i'
        ),
      },
      {
        id: 'nequi-pago',
        tipo: 'gasto',
        patron: new RegExp(
          String.raw`pagaste\s+${MONTO}\s+(?:en|a)\s+${COMERCIO}${FIN}`,
          'i'
        ),
      },
      {
        id: 'nequi-recibo',
        tipo: 'ingreso',
        patron: new RegExp(String.raw`(?:recibiste|te\s+enviaron)\s+${MONTO}`, 'i'),
      },
    ],
  },
  {
    nombre: 'DaviPlata',
    paquetes: ['com.davivienda.daviplataapp'],
    reglas: [
      {
        id: 'daviplata-pago',
        tipo: 'gasto',
        patron: new RegExp(
          String.raw`(?:pagaste|pago\s+por)\s+${MONTO}\s+(?:a|en)\s+${COMERCIO}${FIN}`,
          'i'
        ),
      },
      {
        id: 'daviplata-envio',
        tipo: 'gasto',
        patron: new RegExp(String.raw`enviaste\s+${MONTO}`, 'i'),
      },
    ],
  },
  {
    nombre: 'Davivienda',
    paquetes: ['com.davivienda.mobile', 'com.davivienda.appdavivienda'],
    reglas: [
      {
        id: 'davivienda-compra',
        tipo: 'gasto',
        patron: new RegExp(
          String.raw`compra\s+(?:aprobada\s+)?(?:por\s+)?${MONTO}\s+(?:en|comercio)\s+${COMERCIO}${FIN}`,
          'i'
        ),
      },
    ],
  },
  {
    nombre: 'Banco de Bogotá',
    paquetes: ['com.bancodebogota.bancamovil'],
    reglas: [
      {
        id: 'bogota-compra',
        tipo: 'gasto',
        patron: new RegExp(
          String.raw`compra\s+(?:por\s+)?${MONTO}\s+en\s+${COMERCIO}${FIN}`,
          'i'
        ),
      },
    ],
  },
  {
    nombre: 'BBVA Colombia',
    paquetes: ['com.bbva.nxt_co'],
    reglas: [
      {
        id: 'bbva-compra',
        tipo: 'gasto',
        patron: new RegExp(
          String.raw`(?:compra|cargo)\s+(?:por\s+)?${MONTO}\s+en\s+${COMERCIO}${FIN}`,
          'i'
        ),
      },
    ],
  },
];

/**
 * Regla de último recurso: si el paquete es de un banco conocido pero
 * ninguna regla específica acertó, intentamos sacar solo el monto.
 * El resultado entra como PENDIENTE de confirmación (HU-04), nunca
 * se registra directo, porque no sabemos si es gasto o ingreso.
 */
export const REGLA_GENERICA = new RegExp(MONTO, 'i');

/** Índice paquete → banco. Se construye una vez: consultas en O(1). */
export const INDICE_PAQUETES: ReadonlyMap<string, PatronBanco> = (() => {
  const mapa = new Map<string, PatronBanco>();
  for (const banco of BANCOS) {
    for (const paquete of banco.paquetes) {
      mapa.set(paquete.toLowerCase(), banco);
    }
  }
  return mapa;
})();
