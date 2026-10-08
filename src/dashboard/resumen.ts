/**
 * HU-05: cálculo del resumen por día, semana y mes.
 *
 * Código puro (sin base de datos): recibe los movimientos y devuelve lo que
 * pinta el dashboard. Así se puede probar que la suma de automáticos y
 * manuales es correcta sin un teléfono.
 *
 * El dashboard pide UNA sola vez los movimientos que cubren las tres
 * vistas y calcula las tres aquí. Cambiar de pestaña no consulta la base:
 * solo muestra otra vista ya calculada, por eso el cambio es inmediato.
 */

export type Vista = 'dia' | 'semana' | 'mes';

export const VISTAS: { id: Vista; etiqueta: string }[] = [
  { id: 'dia', etiqueta: 'Día' },
  { id: 'semana', etiqueta: 'Semana' },
  { id: 'mes', etiqueta: 'Mes' },
];

/** Lo mínimo que necesita el resumen de cada movimiento. */
export interface MovimientoResumen {
  fecha: number;
  monto: number;
  tipo: 'gasto' | 'ingreso';
  categoria: string;
}

interface Tramo {
  desde: number;
  hasta: number;
  etiqueta: string;
}

export interface RangoVista {
  vista: Vista;
  desde: number;
  hasta: number;
  /** Período anterior equivalente, para comparar. */
  anterior: { desde: number; hasta: number };
  titulo: string;
  /** "ayer", "la semana pasada"… */
  textoAnterior: string;
  /** Barras de la gráfica. En "día" son los últimos 7 días, como contexto. */
  barras: Tramo[];
}

const DIAS_CORTOS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Medianoche local del día de `base` desplazado `dias`. Con setDate, no ms: respeta cambios de hora. */
function dia(base: Date, dias = 0): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
}

export function rangoVista(vista: Vista, ahora = new Date()): RangoVista {
  const hoy = dia(ahora);

  if (vista === 'dia') {
    const barras: Tramo[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = dia(hoy, -i);
      barras.push({
        desde: d.getTime(),
        hasta: dia(d, 1).getTime(),
        etiqueta: i === 0 ? 'Hoy' : DIAS_CORTOS[d.getDay()]!,
      });
    }
    return {
      vista,
      desde: hoy.getTime(),
      hasta: dia(hoy, 1).getTime(),
      anterior: { desde: dia(hoy, -1).getTime(), hasta: hoy.getTime() },
      titulo: 'Hoy',
      textoAnterior: 'ayer',
      barras,
    };
  }

  if (vista === 'semana') {
    // En Colombia la semana arranca el lunes.
    const lunes = dia(hoy, -((hoy.getDay() + 6) % 7));
    const barras: Tramo[] = [];
    for (let i = 0; i < 7; i++) {
      const d = dia(lunes, i);
      barras.push({ desde: d.getTime(), hasta: dia(d, 1).getTime(), etiqueta: DIAS_CORTOS[d.getDay()]! });
    }
    return {
      vista,
      desde: lunes.getTime(),
      hasta: dia(lunes, 7).getTime(),
      anterior: { desde: dia(lunes, -7).getTime(), hasta: lunes.getTime() },
      titulo: 'Esta semana',
      textoAnterior: 'la semana pasada',
      barras,
    };
  }

  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  const barras: Tramo[] = [];
  for (let d = inicio; d < fin; d = dia(d, 1)) {
    const n = d.getDate();
    // Solo algunas etiquetas: 30 números no caben en la gráfica.
    barras.push({
      desde: d.getTime(),
      hasta: dia(d, 1).getTime(),
      etiqueta: n === 1 || n % 7 === 1 ? String(n) : '',
    });
  }
  return {
    vista,
    desde: inicio.getTime(),
    hasta: fin.getTime(),
    anterior: {
      desde: new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).getTime(),
      hasta: inicio.getTime(),
    },
    titulo: `${MESES[hoy.getMonth()]![0]!.toUpperCase()}${MESES[hoy.getMonth()]!.slice(1)} ${hoy.getFullYear()}`,
    textoAnterior: 'el mes pasado',
    barras,
  };
}

export interface Barra {
  etiqueta: string;
  gastos: number;
  ingresos: number;
  /** La barra que corresponde a hoy, para resaltarla. */
  esHoy: boolean;
}

export interface ResumenVista {
  rango: RangoVista;
  gastos: number;
  ingresos: number;
  balance: number;
  cantidadGastos: number;
  cantidadIngresos: number;
  gastosAnterior: number;
  /** Cambio frente al período anterior (0,25 = +25 %). null si antes fue 0. */
  variacion: number | null;
  categorias: { categoria: string; total: number; porcentaje: number }[];
  barras: Barra[];
  /** Mayor valor de las barras, para escalar la gráfica. */
  maximoBarra: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Índice del tramo que contiene `t` (los tramos son contiguos y ordenados). O(log b). */
function buscarTramo(tramos: Tramo[], t: number): number {
  let lo = 0;
  let hi = tramos.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const tr = tramos[mid]!;
    if (t < tr.desde) hi = mid - 1;
    else if (t >= tr.hasta) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/**
 * Resume una vista en una pasada: O(n log b), con n movimientos y b barras
 * (b ≤ 31). Todo tipo de origen (automático, manual, confirmado) cuenta
 * igual: el criterio de la HU-05 es que se sumen todos.
 */
export function resumirVista(
  movimientos: MovimientoResumen[],
  rango: RangoVista,
  ahora = Date.now()
): ResumenVista {
  let gastos = 0;
  let ingresos = 0;
  let cantidadGastos = 0;
  let cantidadIngresos = 0;
  let gastosAnterior = 0;
  const categorias = new Map<string, number>();
  const barras: Barra[] = rango.barras.map((b) => ({
    etiqueta: b.etiqueta,
    gastos: 0,
    ingresos: 0,
    esHoy: ahora >= b.desde && ahora < b.hasta,
  }));

  for (const m of movimientos) {
    const esGasto = m.tipo === 'gasto';

    if (m.fecha >= rango.desde && m.fecha < rango.hasta) {
      if (esGasto) {
        gastos += m.monto;
        cantidadGastos++;
        const cat = m.categoria || 'Sin categoría';
        categorias.set(cat, (categorias.get(cat) ?? 0) + m.monto);
      } else {
        ingresos += m.monto;
        cantidadIngresos++;
      }
    } else if (esGasto && m.fecha >= rango.anterior.desde && m.fecha < rango.anterior.hasta) {
      gastosAnterior += m.monto;
    }

    const i = buscarTramo(rango.barras, m.fecha);
    if (i >= 0) {
      if (esGasto) barras[i]!.gastos += m.monto;
      else barras[i]!.ingresos += m.monto;
    }
  }

  gastos = redondear(gastos);
  ingresos = redondear(ingresos);
  gastosAnterior = redondear(gastosAnterior);

  return {
    rango,
    gastos,
    ingresos,
    balance: redondear(ingresos - gastos),
    cantidadGastos,
    cantidadIngresos,
    gastosAnterior,
    variacion: gastosAnterior > 0 ? (gastos - gastosAnterior) / gastosAnterior : null,
    categorias: [...categorias.entries()]
      .map(([categoria, total]) => ({
        categoria,
        total: redondear(total),
        porcentaje: gastos > 0 ? total / gastos : 0,
      }))
      .sort((a, b) => b.total - a.total),
    barras: barras.map((b) => ({ ...b, gastos: redondear(b.gastos), ingresos: redondear(b.ingresos) })),
    maximoBarra: Math.max(1, ...barras.map((b) => Math.max(b.gastos, b.ingresos))),
  };
}

/** Rango de fechas que hay que leer de la base para calcular las tres vistas. */
export function rangoConsulta(ahora = new Date()): { desde: number; hasta: number } {
  const rangos = VISTAS.map((v) => rangoVista(v.id, ahora));
  return {
    desde: Math.min(...rangos.flatMap((r) => [r.anterior.desde, r.barras[0]?.desde ?? r.desde])),
    hasta: Math.max(...rangos.map((r) => r.hasta)),
  };
}

/** Las tres vistas a partir de una sola lista de movimientos. */
export function resumirTodo(
  movimientos: MovimientoResumen[],
  ahora = new Date()
): Record<Vista, ResumenVista> {
  return {
    dia: resumirVista(movimientos, rangoVista('dia', ahora), ahora.getTime()),
    semana: resumirVista(movimientos, rangoVista('semana', ahora), ahora.getTime()),
    mes: resumirVista(movimientos, rangoVista('mes', ahora), ahora.getTime()),
  };
}
