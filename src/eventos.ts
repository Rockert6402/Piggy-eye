/**
 * Aviso de "cambiaron los datos" entre partes de la app.
 *
 * El headless task corre en el mismo runtime de JavaScript que las
 * pantallas cuando la app está abierta. Sin este aviso, un gasto que entra
 * por notificación queda guardado en SQLite pero la lista que el usuario
 * está mirando no se entera hasta que cambie de pestaña (HU-01: "visible en
 * el listado sin intervención del usuario").
 *
 * Es un emisor mínimo a propósito: un Set de oyentes, O(1) para suscribir
 * y desuscribir, O(k) para avisar a k pantallas montadas.
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

type Oyente = () => void;

const oyentes = new Set<Oyente>();

/** Avisa a todas las pantallas montadas que deben recargar. */
export function avisarCambioDatos(): void {
  for (const oyente of oyentes) {
    try {
      oyente();
    } catch {
      // Un oyente roto no debe impedir que los demás se enteren.
    }
  }
}

export function suscribirCambioDatos(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/**
 * Ejecuta `recargar` cuando cambian los datos o cuando la app vuelve al
 * frente (por ejemplo, tras tocar una notificación con la app en segundo
 * plano). Complementa a useFocusEffect, que solo cubre cambios de pestaña.
 */
export function useAlCambiarDatos(recargar: () => void): void {
  // Ref para no re-suscribir en cada render si el callback cambia.
  const ref = useRef(recargar);
  ref.current = recargar;

  useEffect(() => {
    const quitar = suscribirCambioDatos(() => ref.current());
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') ref.current();
    });
    return () => {
      quitar();
      sub.remove();
    };
  }, []);
}
