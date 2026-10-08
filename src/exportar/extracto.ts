/**
 * Modelo del extracto: convierte la lista de movimientos en lo que muestran
 * los bancos (entradas, salidas, saldo, totales y resúmenes).
 *
 * Es código puro, sin base de datos ni archivos, para poder probarlo y
 * para que el Excel y el PDF salgan exactamente de los mismos números.
 */

import type { Gasto } from '../db/gastos';

export type Periodo = 'mes' | 'mes-anterior' | 'tres-meses' | 'anio' | 'todo';

export const PERIODOS: { id: Periodo; etiqueta: string }[] = [
  { id: 'mes', etiqueta: 'Este mes' },
  { id: 'mes-anterior', etiqueta: 'Mes anterior' },
  { id: 'tres-meses', etiqueta: 'Últimos 3 meses' },
  { id: 'anio', etiqueta: 'Este año' },
  { id: 'todo', etiqueta: 'Todo' },
];

export interface Rango {
  /** Inclusivo, ms epoch. */
  desde: number;
  /** Exclusivo, ms epoch. */
  hasta: number;
}

/** Límites del período en hora local. `todo` arranca en 0 (1970). */
export function rangoDePeriodo(periodo: Periodo, ahora = new Date()): Rango {
  const a = ahora.getFullYear();
  const m = ahora.getMonth();
  const hasta = ahora.getTime() + 1;
  switch (periodo) {
    case 'mes':
      return { desde: new Date(a, m, 1).getTime(), hasta };
    case 'mes-anterior':
      return { desde: new Date(a, m - 1, 1).getTime(), hasta: new Date(a, m, 1).getTime() };
    case 'tres-meses':
      // El mes actual y los dos anteriores completos.
      return { desde: new Date(a, m - 2, 1).getTime(), hasta };
    case 'anio':
      return { desde: new Date(a, 0, 1).getTime(), hasta };
    case 'todo':
      return { desde: 0, hasta };
  }
}

export interface FilaExtracto {
  fecha: number;
  descripcion: string;
  categoria: string;
  /** Banco, billetera o "Efectivo". */
  medio: string;
  /** Automático, manual o confirmado: cómo llegó el registro. */
  registro: string;
  entrada: number;
  salida: number;
  /** Entradas menos salidas acumuladas desde el inicio del período. */
  saldo: number;
}

export interface ResumenMes {
  /** "2026-10", sirve para ordenar. */
  clave: string;
  etiqueta: string;
  entradas: number;
  salidas: number;
  neto: number;
}

export interface ResumenCategoria {
  categoria: string;
  total: number;
  /** Fracción entre 0 y 1 del total de salidas. */
  porcentaje: number;
}

export interface ResumenMedio {
  medio: string;
  entradas: number;
  salidas: number;
}

export interface Extracto {
  rango: Rango;
  /** Fecha del primer y último movimiento, o del rango si no hay. */
  primerDia: number;
  ultimoDia: number;
  generado: number;
  filas: FilaExtracto[];
  totales: { entradas: number; salidas: number; neto: number; cantidad: number };
  porMes: ResumenMes[];
  porCategoria: ResumenCategoria[];
  porMedio: ResumenMedio[];
}

const REGISTRO: Record<string, string> = {
  automatico: 'Automático',
  manual: 'Manual',
  confirmado: 'Confirmado',
};

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Evita basura de coma flotante al sumar pesos con decimales (0,1 + 0,2). */
function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

function descripcionDe(g: Gasto): string {
  const texto = g.comercio?.trim() || g.nota?.trim();
  if (texto) return texto;
  if (g.categoria && g.categoria !== 'Sin categoría') return g.categoria;
  return g.tipo === 'ingreso' ? 'Ingreso' : 'Gasto';
}

function medioDe(g: Gasto): string {
  if (g.banco?.trim()) return g.banco.trim();
  // Un registro manual sin banco es, por diseño del formulario, efectivo.
  return g.origen === 'manual' ? 'Efectivo' : 'Sin especificar';
}

/**
 * Arma el extracto en una sola pasada sobre los movimientos: O(n) más el
 * orden de los resúmenes, O(k log k) con k = meses o categorías (pequeño).
 * Espera los movimientos ya ordenados por fecha ascendente, como los
 * devuelve `listarGastosEntre`; si no lo están, los ordena.
 */
export function construirExtracto(
  movimientos: Gasto[],
  rango: Rango,
  generado = Date.now()
): Extracto {
  const ordenados = [...movimientos].sort((x, y) => x.fecha - y.fecha || x.id - y.id);

  const filas: FilaExtracto[] = [];
  const meses = new Map<string, ResumenMes>();
  const categorias = new Map<string, number>();
  const medios = new Map<string, ResumenMedio>();

  let entradas = 0;
  let salidas = 0;
  let saldo = 0;

  for (const g of ordenados) {
    const esEntrada = g.tipo === 'ingreso';
    const entrada = esEntrada ? g.monto : 0;
    const salida = esEntrada ? 0 : g.monto;
    entradas += entrada;
    salidas += salida;
    saldo = redondear(saldo + entrada - salida);

    const medio = medioDe(g);
    filas.push({
      fecha: g.fecha,
      descripcion: descripcionDe(g),
      categoria: g.categoria || 'Sin categoría',
      medio,
      registro: REGISTRO[g.origen] ?? g.origen,
      entrada,
      salida,
      saldo,
    });

    const d = new Date(g.fecha);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mes = meses.get(clave) ?? {
      clave,
      etiqueta: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
      entradas: 0,
      salidas: 0,
      neto: 0,
    };
    mes.entradas = redondear(mes.entradas + entrada);
    mes.salidas = redondear(mes.salidas + salida);
    mes.neto = redondear(mes.entradas - mes.salidas);
    meses.set(clave, mes);

    if (!esEntrada) {
      const cat = g.categoria || 'Sin categoría';
      categorias.set(cat, redondear((categorias.get(cat) ?? 0) + salida));
    }

    const m = medios.get(medio) ?? { medio, entradas: 0, salidas: 0 };
    m.entradas = redondear(m.entradas + entrada);
    m.salidas = redondear(m.salidas + salida);
    medios.set(medio, m);
  }

  entradas = redondear(entradas);
  salidas = redondear(salidas);

  const porCategoria = [...categorias.entries()]
    .map(([categoria, total]) => ({
      categoria,
      total,
      porcentaje: salidas > 0 ? total / salidas : 0,
    }))
    .sort((x, y) => y.total - x.total);

  return {
    rango,
    // "Todo" no tiene inicio real: se usa la fecha del primer movimiento.
    primerDia: rango.desde > 0 ? rango.desde : ordenados[0]?.fecha ?? generado,
    ultimoDia: Math.min(rango.hasta - 1, generado),
    generado,
    filas,
    totales: { entradas, salidas, neto: redondear(entradas - salidas), cantidad: filas.length },
    porMes: [...meses.values()].sort((x, y) => x.clave.localeCompare(y.clave)),
    porCategoria,
    porMedio: [...medios.values()].sort(
      (x, y) => y.entradas + y.salidas - (x.entradas + x.salidas)
    ),
  };
}

/** "07/10/2026" en hora local, sin depender de Intl. */
export function fechaCorta(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** "07/10/2026 14:05" en hora local. */
export function fechaHora(ms: number): string {
  const d = new Date(ms);
  return `${fechaCorta(ms)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Nombre de archivo sin caracteres raros: piggy-eye-extracto-2026-10-07. */
export function nombreArchivo(generado: number): string {
  const d = new Date(generado);
  const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `piggy-eye-extracto-${f}`;
}
