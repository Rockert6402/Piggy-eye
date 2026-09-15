/**
 * HU-06: sincronización. Apagada por defecto.
 *
 * El acta dice que no hay presupuesto para servicios de pago y que la
 * sincronización multi-dispositivo está fuera de alcance. Así que la app
 * funciona entera contra SQLite y esto queda como una capa opcional.
 *
 * Para activarla: implementar `AdaptadorRemoto` contra el backend que
 * elijan (Supabase y Firebase tienen capa gratuita suficiente) y llamar a
 * `configurarAdaptador()` una vez al arrancar la app. Nada más cambia:
 * ni el parser, ni la base de datos, ni las pantallas.
 */

import { abrirBD } from '../db/esquema';
import type { Gasto } from '../db/gastos';

export interface AdaptadorRemoto {
  /** Sube un lote. Debe devolver los ids que quedaron guardados allá. */
  subir(gastos: Gasto[]): Promise<number[]>;
}

let adaptador: AdaptadorRemoto | null = null;
let sincronizando = false;

export function configurarAdaptador(nuevo: AdaptadorRemoto | null): void {
  adaptador = nuevo;
}

export function haySincronizacion(): boolean {
  return adaptador !== null;
}

/**
 * Marca un gasto como pendiente de subir. Sin adaptador configurado no
 * hace nada: el gasto ya está en SQLite, que es lo que importa.
 */
export async function encolarSincronizacion(idGasto: number): Promise<void> {
  if (!adaptador) return;
  // El gasto ya nace con sincronizado = 0, así que basta con intentar
  // vaciar la cola. Si no hay red, falla callado y se reintenta después.
  await vaciarCola().catch(() => undefined);
}

export async function contarSinSincronizar(): Promise<number> {
  const bd = await abrirBD();
  const fila = await bd.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM gastos WHERE sincronizado = 0'
  );
  return fila?.n ?? 0;
}

/**
 * Sube todo lo pendiente en lotes.
 *
 * El candado `sincronizando` evita que dos llamadas concurrentes suban el
 * mismo gasto dos veces, que es fácil que pase: una desde el headless task
 * cuando llega una notificación y otra desde la pantalla al refrescar.
 */
export async function vaciarCola(tamanoLote = 50): Promise<number> {
  if (!adaptador || sincronizando) return 0;

  sincronizando = true;
  let subidos = 0;

  try {
    const bd = await abrirBD();

    for (;;) {
      const lote = await bd.getAllAsync<Gasto>(
        'SELECT * FROM gastos WHERE sincronizado = 0 ORDER BY fecha ASC LIMIT ?',
        tamanoLote
      );
      if (lote.length === 0) break;

      const confirmados = await adaptador.subir(lote);
      if (confirmados.length === 0) break;

      const marcadores = confirmados.map(() => '?').join(',');
      await bd.runAsync(
        `UPDATE gastos SET sincronizado = 1 WHERE id IN (${marcadores})`,
        ...confirmados
      );
      subidos += confirmados.length;

      if (lote.length < tamanoLote) break;
    }
  } finally {
    sincronizando = false;
  }

  return subidos;
}
