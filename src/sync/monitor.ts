/**
 * HU-06: sincronización automática en segundo plano.
 *
 * Reintenta subir lo pendiente:
 *   - al recuperar la conexión (de modo avión o sin señal a conectado),
 *   - cuando la app vuelve al frente,
 *   - cada 30 s mientras haya pendientes, por si el servidor estaba caído
 *     aunque el teléfono sí tuviera red.
 *
 * Cuando un reintento logra enviar datos pendientes, muestra un aviso breve
 * (criterio de confirmación de la HU-06).
 */

import { AppState } from 'react-native';

import { avisarCambioDatos } from '../eventos';
import { mostrarToast } from '../ui/toast';
import { contarSinSincronizar, haySincronizacion, vaciarCola } from './cola';

type ModuloRed = typeof import('expo-network');

/**
 * expo-network se carga al importar este archivo y dentro de try: si la app
 * se compiló sin el módulo nativo, se pierde solo la detección inmediata de
 * reconexión; el reintento periódico sigue funcionando.
 */
const Red: ModuloRed | null = (() => {
  try {
    return require('expo-network') as ModuloRed;
  } catch {
    return null;
  }
})();

const INTERVALO_MS = 30_000;

export type Motivo = 'inicio' | 'reconexion' | 'frente' | 'periodico' | 'manual';

/** Texto del aviso. Exportado para probarlo. */
export function textoSincronizados(n: number): string {
  return n === 1
    ? 'Conexión recuperada: se sincronizó 1 movimiento'
    : `Conexión recuperada: se sincronizaron ${n} movimientos`;
}

/**
 * Un intento de sincronizar. Devuelve cuántos movimientos subió, o lanza el
 * error del servidor (el estado queda registrado en la cola para Ajustes).
 */
export async function sincronizarAhora(motivo: Motivo): Promise<number> {
  if (!haySincronizacion()) return 0;
  const n = await vaciarCola();
  if (n > 0) {
    avisarCambioDatos(); // refresca el contador de Ajustes
    if (motivo === 'manual') mostrarToast(n === 1 ? 'Se sincronizó 1 movimiento' : `Se sincronizaron ${n} movimientos`);
    else mostrarToast(textoSincronizados(n));
  }
  return n;
}

/**
 * Arranca la sincronización automática. Devuelve la función para detenerla.
 * Se llama una vez desde app/_layout.tsx.
 */
export function iniciarSincronizacionAutomatica(): () => void {
  if (!haySincronizacion()) return () => undefined;

  const intentar = (motivo: Motivo) => {
    sincronizarAhora(motivo).catch(() => {
      // Sin red o servidor caído: los datos siguen en SQLite y se reintenta.
    });
  };

  intentar('inicio');

  let conectado: boolean | null = null;
  const subRed = Red?.addNetworkStateListener((e) => {
    // isInternetReachable puede venir undefined mientras Android lo evalúa.
    const ahora = e.isConnected === true && e.isInternetReachable !== false;
    if (ahora && conectado === false) intentar('reconexion');
    conectado = ahora;
  });

  const subApp = AppState.addEventListener('change', (s) => {
    if (s === 'active') intentar('frente');
  });

  const intervalo = setInterval(() => {
    contarSinSincronizar()
      .then((n) => {
        if (n > 0 && conectado !== false) intentar('periodico');
      })
      .catch(() => undefined);
  }, INTERVALO_MS);

  return () => {
    subRed?.remove();
    subApp.remove();
    clearInterval(intervalo);
  };
}
