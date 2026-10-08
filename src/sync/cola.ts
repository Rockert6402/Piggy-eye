/**
 * HU-06: cola de sincronización.
 *
 * Todo gasto se escribe primero en SQLite con `sincronizado = 0`. Esta cola
 * lo sube después, por lotes, y solo marca `sincronizado = 1` lo que el
 * servidor confirmó. De ahí salen los criterios de la historia:
 *
 *   - Sin red, o si la conexión se corta a mitad: el lote en curso no se
 *     marca, queda pendiente y se reintenta completo. Los lotes anteriores
 *     ya confirmados no se repiten.
 *   - Si el servidor responde con error: nada se borra ni se marca; los
 *     datos siguen intactos en el teléfono.
 *   - Sin duplicados: cada gasto viaja con su huella y el servidor guarda
 *     por esa clave, así que reenviar el mismo gasto lo reemplaza.
 *
 * El acceso a la base está detrás de `Almacen` para poder probar la cola
 * sin un teléfono (ver cola.test.ts).
 */

import { abrirBD } from '../db/esquema';
import type { Gasto } from '../db/gastos';

export interface AdaptadorRemoto {
  /** Sube un lote. Debe devolver los ids que quedaron guardados allá. */
  subir(gastos: Gasto[]): Promise<number[]>;
}

/** Operaciones de base de datos que necesita la cola. */
export interface Almacen {
  pendientes(limite: number, excluir: number[]): Promise<Gasto[]>;
  /**
   * Marca como subidos los ids dados, salvo los editados después de
   * `inicio`: esa edición todavía no viajó y debe subirse otra vez.
   */
  marcarSubidos(ids: number[], inicio: number): Promise<void>;
  contarPendientes(): Promise<number>;
}

const almacenSQLite: Almacen = {
  async pendientes(limite, excluir) {
    const bd = await abrirBD();
    const filtro = excluir.length ? `AND id NOT IN (${excluir.map(() => '?').join(',')})` : '';
    return bd.getAllAsync<Gasto>(
      `SELECT * FROM gastos WHERE sincronizado = 0 ${filtro} ORDER BY fecha ASC, id ASC LIMIT ?`,
      ...excluir,
      limite
    );
  },
  async marcarSubidos(ids, inicio) {
    if (!ids.length) return;
    const bd = await abrirBD();
    await bd.runAsync(
      `UPDATE gastos SET sincronizado = 1
        WHERE id IN (${ids.map(() => '?').join(',')})
          AND (editado_en IS NULL OR editado_en < ?)`,
      ...ids,
      inicio
    );
  },
  async contarPendientes() {
    const bd = await abrirBD();
    const fila = await bd.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM gastos WHERE sincronizado = 0'
    );
    return fila?.n ?? 0;
  },
};

let adaptador: AdaptadorRemoto | null = null;
let almacen: Almacen = almacenSQLite;
let sincronizando = false;

/** Lo que muestra Ajustes sobre la sincronización. */
export interface EstadoSync {
  ultimaExitosa: number | null;
  ultimoError: { mensaje: string; fecha: number } | null;
}

const estado: EstadoSync = { ultimaExitosa: null, ultimoError: null };

export function obtenerEstadoSync(): EstadoSync {
  return { ...estado };
}

export function configurarAdaptador(nuevo: AdaptadorRemoto | null): void {
  adaptador = nuevo;
}

/** Solo para pruebas: reemplaza SQLite por un almacén en memoria. */
export function configurarAlmacen(nuevo: Almacen | null): void {
  almacen = nuevo ?? almacenSQLite;
  sincronizando = false;
  estado.ultimaExitosa = null;
  estado.ultimoError = null;
}

export function haySincronizacion(): boolean {
  return adaptador !== null;
}

/**
 * Se llama justo después de guardar un gasto. Sin adaptador no hace nada:
 * el gasto ya está en SQLite, que es lo que importa.
 */
export async function encolarSincronizacion(_idGasto: number): Promise<void> {
  if (!adaptador) return;
  // El gasto ya nace con sincronizado = 0: basta con intentar vaciar la
  // cola. Si no hay red, falla callado y el monitor reintenta después.
  await vaciarCola().catch(() => undefined);
}

export function contarSinSincronizar(): Promise<number> {
  return almacen.contarPendientes();
}

/**
 * Sube todo lo pendiente en lotes. Devuelve cuántos quedaron confirmados.
 * Si un lote falla, lanza el error después de dejar marcados los lotes
 * anteriores que sí se confirmaron.
 *
 * El candado `sincronizando` evita que dos llamadas concurrentes suban lo
 * mismo, que es fácil que pase: una desde el headless task cuando llega una
 * notificación y otra desde el monitor al reconectar.
 */
export async function vaciarCola(tamanoLote = 50): Promise<number> {
  if (!adaptador || sincronizando) return 0;

  sincronizando = true;
  let subidos = 0;
  // Ids que el servidor recibió pero no confirmó (los rechazó): no se
  // vuelven a pedir en esta pasada, para no quedar en un ciclo infinito.
  const sinConfirmar: number[] = [];

  try {
    for (;;) {
      const inicio = Date.now();
      const lote = await almacen.pendientes(tamanoLote, sinConfirmar);
      if (lote.length === 0) break;

      const confirmados = await adaptador.subir(lote);
      await almacen.marcarSubidos(confirmados, inicio);
      subidos += confirmados.length;

      const ok = new Set(confirmados);
      for (const g of lote) if (!ok.has(g.id)) sinConfirmar.push(g.id);

      if (lote.length < tamanoLote) break;
    }
    estado.ultimaExitosa = Date.now();
    estado.ultimoError = null;
  } catch (e) {
    estado.ultimoError = {
      mensaje: e instanceof Error ? e.message : String(e),
      fecha: Date.now(),
    };
    throw e;
  } finally {
    sincronizando = false;
  }

  return subidos;
}
