/**
 * Acceso a la tabla de gastos.
 * Cubre HU-01, HU-03, HU-05, HU-08, HU-09 y HU-10.
 */

import { abrirBD, calcularHuella } from './esquema';

export type Origen = 'automatico' | 'manual' | 'confirmado';
export type Tipo = 'gasto' | 'ingreso';

export interface Gasto {
  id: number;
  monto: number;
  comercio: string | null;
  categoria: string;
  tipo: Tipo;
  origen: Origen;
  banco: string | null;
  nota: string | null;
  fecha: number;
  creado_en: number;
  editado_en: number | null;
  regla_id: string | null;
  texto_original: string | null;
  sincronizado: number;
}

export interface NuevoGasto {
  monto: number;
  comercio?: string | null;
  categoria?: string;
  tipo?: Tipo;
  origen?: Origen;
  banco?: string | null;
  nota?: string | null;
  fecha?: number;
  reglaId?: string | null;
  textoOriginal?: string | null;
}

export const CATEGORIAS = [
  'Sin categoría',
  'Mercado',
  'Transporte',
  'Comida',
  'Servicios',
  'Salud',
  'Educación',
  'Ocio',
  'Otros',
] as const;

export const CATEGORIAS_INGRESO = [
  'Sin categoría',
  'Salario',
  'Freelance',
  'Venta',
  'Transferencia',
  'Reembolso',
  'Regalo',
  'Otros',
] as const;

/**
 * Inserta un gasto. Devuelve el id nuevo, o null si era duplicado.
 *
 * Usamos INSERT OR IGNORE contra la restricción UNIQUE de `huella`:
 * la deduplicación la resuelve SQLite en el índice, sin un SELECT previo.
 */
export async function crearGasto(datos: NuevoGasto): Promise<number | null> {
  const bd = await abrirBD();
  const ahora = Date.now();
  const fecha = datos.fecha ?? ahora;
  const comercio = datos.comercio ?? null;
  const origen = datos.origen ?? 'manual';

  // Los gastos que el usuario escribe a mano no se deduplican: si alguien
  // registra dos cafés de $4.000 seguidos, ambos son reales.
  const huella =
    origen === 'automatico'
      ? calcularHuella(datos.monto, comercio, fecha)
      : `manual-${ahora}-${Math.random().toString(36).slice(2, 8)}`;

  const r = await bd.runAsync(
    `INSERT OR IGNORE INTO gastos
       (monto, comercio, categoria, tipo, origen, banco, nota, fecha,
        creado_en, regla_id, texto_original, huella, sincronizado)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    datos.monto,
    comercio,
    datos.categoria ?? 'Sin categoría',
    datos.tipo ?? 'gasto',
    origen,
    datos.banco ?? null,
    datos.nota ?? null,
    fecha,
    ahora,
    datos.reglaId ?? null,
    datos.textoOriginal ?? null,
    huella
  );

  return r.changes > 0 ? r.lastInsertRowId : null;
}

/** HU-10: detalle de un gasto. */
export async function obtenerGasto(id: number): Promise<Gasto | null> {
  const bd = await abrirBD();
  return bd.getFirstAsync<Gasto>('SELECT * FROM gastos WHERE id = ?', id);
}

/** Lista paginada, más recientes primero. */
export async function listarGastos(
  limite = 50,
  desplazamiento = 0
): Promise<Gasto[]> {
  const bd = await abrirBD();
  return bd.getAllAsync<Gasto>(
    'SELECT * FROM gastos ORDER BY fecha DESC LIMIT ? OFFSET ?',
    limite,
    desplazamiento
  );
}

/** HU-08: editar. Solo toca los campos que vengan definidos. */
export async function editarGasto(
  id: number,
  cambios: Partial<Pick<Gasto, 'monto' | 'comercio' | 'categoria' | 'nota' | 'fecha' | 'tipo'>>
): Promise<boolean> {
  const campos = Object.entries(cambios).filter(([, v]) => v !== undefined);
  if (campos.length === 0) return false;

  const bd = await abrirBD();
  const asignaciones = campos.map(([k]) => `${k} = ?`).join(', ');
  const valores = campos.map(([, v]) => v as string | number | null);

  const r = await bd.runAsync(
    `UPDATE gastos SET ${asignaciones}, editado_en = ?, sincronizado = 0 WHERE id = ?`,
    ...valores,
    Date.now(),
    id
  );
  return r.changes > 0;
}

/** HU-09: eliminar. */
export async function eliminarGasto(id: number): Promise<boolean> {
  const bd = await abrirBD();
  const r = await bd.runAsync('DELETE FROM gastos WHERE id = ?', id);
  return r.changes > 0;
}

// ─── Consultas del dashboard (HU-05) ────────────────────────────────────

export interface Resumen {
  total: number;
  cantidad: number;
}

/** Total gastado entre dos instantes. Resuelto por SQLite con el índice de fecha. */
export async function totalEntre(desde: number, hasta: number): Promise<Resumen> {
  const bd = await abrirBD();
  const fila = await bd.getFirstAsync<Resumen>(
    `SELECT COALESCE(SUM(monto), 0) AS total, COUNT(*) AS cantidad
       FROM gastos
      WHERE tipo = 'gasto' AND fecha >= ? AND fecha < ?`,
    desde,
    hasta
  );
  return fila ?? { total: 0, cantidad: 0 };
}

export interface CorteTemporal {
  hoy: Resumen;
  semana: Resumen;
  mes: Resumen;
}

/** Los tres cortes que pide la HU-05, en una sola pasada por la app. */
export async function resumenDashboard(ahora = new Date()): Promise<CorteTemporal> {
  const inicioDia = new Date(ahora);
  inicioDia.setHours(0, 0, 0, 0);

  // Semana que arranca el lunes, como se entiende en Colombia.
  const inicioSemana = new Date(inicioDia);
  const diaSemana = (inicioSemana.getDay() + 6) % 7;
  inicioSemana.setDate(inicioSemana.getDate() - diaSemana);

  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const fin = ahora.getTime() + 1;

  const [hoy, semana, mes] = await Promise.all([
    totalEntre(inicioDia.getTime(), fin),
    totalEntre(inicioSemana.getTime(), fin),
    totalEntre(inicioMes.getTime(), fin),
  ]);

  return { hoy, semana, mes };
}

export interface GastoPorCategoria {
  categoria: string;
  total: number;
}

export async function totalesPorCategoria(
  desde: number,
  hasta: number
): Promise<GastoPorCategoria[]> {
  const bd = await abrirBD();
  return bd.getAllAsync<GastoPorCategoria>(
    `SELECT categoria, SUM(monto) AS total
       FROM gastos
      WHERE tipo = 'gasto' AND fecha >= ? AND fecha < ?
      GROUP BY categoria
      ORDER BY total DESC`,
    desde,
    hasta
  );
}

export interface PuntoDiario {
  dia: string;
  total: number;
}

/** Serie de los últimos N días, para la gráfica del dashboard. */
export async function serieDiaria(dias = 14): Promise<PuntoDiario[]> {
  const bd = await abrirBD();
  const desde = Date.now() - dias * 86_400_000;
  return bd.getAllAsync<PuntoDiario>(
    `SELECT date(fecha / 1000, 'unixepoch', 'localtime') AS dia,
            SUM(monto) AS total
       FROM gastos
      WHERE tipo = 'gasto' AND fecha >= ?
      GROUP BY dia
      ORDER BY dia ASC`,
    desde
  );
}
