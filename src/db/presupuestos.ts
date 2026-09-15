import { abrirBD } from './esquema';

export interface Presupuesto {
  categoria: string;
  limite: number;
  creado_en: number;
  editado_en: number | null;
}

export interface PresupuestoConGasto extends Presupuesto {
  gastado: number;
  porcentaje: number;
}

export async function listarPresupuestos(): Promise<Presupuesto[]> {
  const bd = await abrirBD();
  return bd.getAllAsync<Presupuesto>(
    'SELECT * FROM presupuestos ORDER BY categoria ASC'
  );
}

export async function guardarPresupuesto(
  categoria: string,
  limite: number
): Promise<void> {
  const bd = await abrirBD();
  const ahora = Date.now();
  await bd.runAsync(
    `INSERT INTO presupuestos (categoria, limite, creado_en)
     VALUES (?, ?, ?)
     ON CONFLICT(categoria) DO UPDATE SET limite = excluded.limite, editado_en = ?`,
    categoria,
    limite,
    ahora,
    ahora
  );
}

export async function eliminarPresupuesto(categoria: string): Promise<void> {
  const bd = await abrirBD();
  await bd.runAsync('DELETE FROM presupuestos WHERE categoria = ?', categoria);
}

/** Presupuestos con el gasto real del mes en curso. */
export async function presupuestosConGasto(
  inicioMes: number,
  fin: number
): Promise<PresupuestoConGasto[]> {
  const bd = await abrirBD();
  return bd.getAllAsync<PresupuestoConGasto>(
    `SELECT p.categoria,
            p.limite,
            p.creado_en,
            p.editado_en,
            COALESCE(SUM(g.monto), 0) AS gastado,
            ROUND(COALESCE(SUM(g.monto), 0) * 100.0 / p.limite, 1) AS porcentaje
       FROM presupuestos p
       LEFT JOIN gastos g
         ON g.categoria = p.categoria
        AND g.tipo      = 'gasto'
        AND g.fecha    >= ?
        AND g.fecha     < ?
      GROUP BY p.categoria
      ORDER BY porcentaje DESC`,
    inicioMes,
    fin
  );
}
