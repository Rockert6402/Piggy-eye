/**
 * HU-07 y riesgo #4 del acta: gestión del permiso de acceso a notificaciones.
 *
 * Este permiso no se pide con un diálogo normal de Android. Hay que mandar
 * al usuario a una pantalla de ajustes del sistema, y el usuario puede
 * revocarlo después sin avisarle a la app. Por eso hay que verificarlo cada
 * vez que la app vuelve al frente, no solo al instalar.
 */

import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import RNAndroidNotificationListener from 'react-native-android-notification-listener';

export type EstadoPermiso = 'authorized' | 'denied' | 'unknown';

export async function consultarPermiso(): Promise<EstadoPermiso> {
  if (Platform.OS !== 'android') return 'unknown';
  try {
    const estado = await RNAndroidNotificationListener.getPermissionStatus();
    return estado as EstadoPermiso;
  } catch {
    return 'unknown';
  }
}

/** Abre los ajustes del sistema. No devuelve el resultado: hay que re-consultar. */
export function abrirAjustesPermiso(): void {
  if (Platform.OS !== 'android') return;
  RNAndroidNotificationListener.requestPermission();
}

/**
 * Hook que mantiene el estado del permiso al día.
 *
 * La clave está en el listener de AppState: cuando el usuario vuelve de
 * ajustes, o de cualquier otra app, re-consultamos. Sin esto la app seguiría
 * mostrando "activo" después de que el usuario revocó el permiso, y el
 * usuario creería que sus gastos se están capturando cuando no es así.
 */
export function usePermisoNotificaciones() {
  const [estado, setEstado] = useState<EstadoPermiso>('unknown');
  const [cargando, setCargando] = useState(true);

  const revisar = useCallback(async () => {
    const actual = await consultarPermiso();
    setEstado(actual);
    setCargando(false);
  }, []);

  useEffect(() => {
    revisar();

    const suscripcion = AppState.addEventListener(
      'change',
      (siguiente: AppStateStatus) => {
        if (siguiente === 'active') revisar();
      }
    );

    return () => suscripcion.remove();
  }, [revisar]);

  return {
    estado,
    cargando,
    activo: estado === 'authorized',
    revisar,
    solicitar: abrirAjustesPermiso,
  };
}
