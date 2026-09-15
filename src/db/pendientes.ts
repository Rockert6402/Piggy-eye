/**
 * HU-04: notificaciones que llegaron de un banco conocido pero que el
 * parser no logró interpretar. En vez de perderlas, quedan en cola para
 * que el usuario confirme el monto.
 *
 * También vive aquí la bitácora de diagnóstico, que es la herramienta con
 * la que el equipo va a construir los patrones reales de cada banco.
 */

import { abrirBD } from './esquema';
import { crearGasto } from './gastos';

export interface Pendiente {
  id: number;
  monto_sugerido: number | null;
  banco: string | null;
  razon: string | null;
  texto_original: string;
  fecha: number;
  resuelto: number;
}

export async function crearPendiente(datos: {
  montoSugerido: number | null;
  banco: string | null;
  razon: string;
  textoOriginal: string;
  fecha: number;
}): Promise<number> {
  const bd = await abrirBD();
  const r = await bd.runAsync(
    `INSERT INTO pendientes (monto_sugerido, banco, razon, texto_original, fecha)
     VALUES (?,?,?,?,?)`,
    datos.montoSugerido,
    datos.banco,
    datos.razon,
    datos.textoOriginal,
    datos.fecha
  );
  return r.lastInsertRowId;
}

export async function listarPendientes(): Promise<Pendiente[]> {
  const bd = await abrirBD();
  return bd.getAllAsync<Pendiente>(
    'SELECT * FROM pendientes WHERE resuelto = 0 ORDER BY fecha DESC'
  );
}

export async function contarPendientes(): Promise<number> {
  const bd = await abrirBD();
  const fila = await bd.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM pendientes WHERE resuelto = 0'
  );
  return fila?.n ?? 0;
}

/**
 * El usuario confirma el monto: se crea el gasto y el pendiente se cierra.
 * Va en una transacción para que no quede un pendiente resuelto sin gasto
 * asociado si algo falla a mitad de camino.
 */
export async function confirmarPendiente(
  id: number,
  datos: { monto: number; comercio: string | null; categoria: string }
): Promise<number | null> {
  const bd = await abrirBD();
  const pendiente = await bd.getFirstAsync<Pendiente>(
    'SELECT * FROM pendientes WHERE id = ?',
    id
  );
  if (!pendiente) return null;

  let idGasto: number | null = null;
  await bd.withTransactionAsync(async () => {
    idGasto = await crearGasto({
      monto: datos.monto,
      comercio: datos.comercio,
      categoria: datos.categoria,
      origen: 'confirmado',
      banco: pendiente.banco,
      fecha: pendiente.fecha,
      textoOriginal: pendiente.texto_original,
    });
    await bd.runAsync('UPDATE pendientes SET resuelto = 1 WHERE id = ?', id);
  });

  return idGasto;
}

/** El usuario decide que la notificación no era un gasto. */
export async function descartarPendiente(id: number): Promise<void> {
  const bd = await abrirBD();
  await bd.runAsync('UPDATE pendientes SET resuelto = 1 WHERE id = ?', id);
}

// ─── Bitácora de diagnóstico ────────────────────────────────────────────

const MAX_DIAGNOSTICO = 300;

/**
 * Registra toda notificación que pasó por el listener, incluidas las
 * descartadas. Es la materia prima para escribir los patrones reales:
 * el equipo abre esta pantalla, ve el texto exacto que manda cada banco
 * y lo lleva a `bancos.ts`.
 */
export async function registrarDiagnostico(datos: {
  paquete: string;
  titulo: string;
  texto: string;
  veredicto: string;
  motivo?: string;
}): Promise<void> {
  const bd = await abrirBD();
  await bd.runAsync(
    `INSERT INTO diagnostico (paquete, titulo, texto, veredicto, motivo, fecha)
     VALUES (?,?,?,?,?,?)`,
    datos.paquete,
    datos.titulo,
    datos.texto,
    datos.veredicto,
    datos.motivo ?? null,
    Date.now()
  );

  // Poda: conservamos solo las más recientes.
  await bd.runAsync(
    `DELETE FROM diagnostico WHERE id NOT IN (
       SELECT id FROM diagnostico ORDER BY fecha DESC LIMIT ?
     )`,
    MAX_DIAGNOSTICO
  );
}

export interface EntradaDiagnostico {
  id: number;
  paquete: string;
  titulo: string;
  texto: string;
  veredicto: string;
  motivo: string | null;
  fecha: number;
}

export async function listarDiagnostico(
  limite = 100
): Promise<EntradaDiagnostico[]> {
  const bd = await abrirBD();
  return bd.getAllAsync<EntradaDiagnostico>(
    'SELECT * FROM diagnostico ORDER BY fecha DESC LIMIT ?',
    limite
  );
}

export async function limpiarDiagnostico(): Promise<void> {
  const bd = await abrirBD();
  await bd.runAsync('DELETE FROM diagnostico');
}
