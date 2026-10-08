/**
 * HU-06: adaptador que sube los movimientos a un servidor por HTTP.
 *
 * Hoy apunta al servidor simulado (servidor/index.js). Cambiar a un backend
 * real es reemplazar este archivo, o apuntar EXPO_PUBLIC_SYNC_URL a un
 * servidor que hable el mismo contrato:
 *
 *   POST {url}/api/movimientos  { movimientos: [...] }
 *   → 200 { guardados: ["clave", ...] }
 *
 * La `clave` es la huella del gasto: única y estable. El servidor guarda por
 * clave (upsert), así que reenviar el mismo gasto —por un corte a mitad de
 * la sincronización o por una edición— nunca crea duplicados.
 */

import Constants from 'expo-constants';

import type { Gasto } from '../db/gastos';
import type { AdaptadorRemoto } from './cola';

/** Más que esto sin respuesta se trata como conexión caída. */
const TIEMPO_MAXIMO_MS = 15_000;
const PUERTO_SIMULADO = 3001;

/**
 * Dirección del servidor:
 *   1. EXPO_PUBLIC_SYNC_URL, si está definida (para un backend real).
 *   2. En desarrollo, el mismo PC que sirve el código (Metro), puerto 3001:
 *      ahí corre `npm run servidor`.
 */
export function urlServidor(): string | null {
  const explicita = process.env.EXPO_PUBLIC_SYNC_URL?.trim();
  if (explicita) return explicita.replace(/\/+$/, '');

  // hostUri llega como "192.168.101.12:8081" en un development build.
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:${PUERTO_SIMULADO}` : null;
}

/** Lo que viaja al servidor por cada movimiento. */
export function aPayload(g: Gasto) {
  return {
    clave: g.huella,
    monto: g.monto,
    tipo: g.tipo,
    fecha: g.fecha,
    comercio: g.comercio,
    categoria: g.categoria,
    banco: g.banco,
    nota: g.nota,
    origen: g.origen,
    editado_en: g.editado_en,
  };
}

export class ErrorServidor extends Error {
  constructor(
    mensaje: string,
    /** null si ni siquiera hubo respuesta (sin red, corte, tiempo agotado). */
    readonly estado: number | null
  ) {
    super(mensaje);
    this.name = 'ErrorServidor';
  }
}

export function crearAdaptadorHttp(
  url: string,
  hacerFetch: typeof fetch = (...a) => fetch(...a),
  tiempoMaximoMs = TIEMPO_MAXIMO_MS
): AdaptadorRemoto {
  return {
    async subir(gastos) {
      const control = new AbortController();
      const temporizador = setTimeout(() => control.abort(), tiempoMaximoMs);

      let respuesta: Response;
      try {
        respuesta = await hacerFetch(`${url}/api/movimientos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ movimientos: gastos.map(aPayload) }),
          signal: control.signal,
        });
      } catch {
        // Sin red, conexión cortada a mitad o tiempo agotado: nada se marca
        // como subido y el lote se reintenta completo después.
        const motivo = control.signal.aborted ? 'el servidor no respondió a tiempo' : 'sin conexión con el servidor';
        throw new ErrorServidor(motivo, null);
      } finally {
        clearTimeout(temporizador);
      }

      if (!respuesta.ok) {
        throw new ErrorServidor(`el servidor respondió ${respuesta.status}`, respuesta.status);
      }

      let cuerpo: { guardados?: unknown };
      try {
        cuerpo = await respuesta.json();
      } catch {
        throw new ErrorServidor('respuesta ilegible del servidor', respuesta.status);
      }

      // Solo se marcan los que el servidor confirmó con su clave.
      const confirmadas = new Set(Array.isArray(cuerpo.guardados) ? cuerpo.guardados : []);
      return gastos.filter((g) => confirmadas.has(g.huella)).map((g) => g.id);
    },
  };
}
