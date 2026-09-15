/**
 * Gestión del permiso READ_SMS.
 *
 * A diferencia del permiso de notificaciones, READ_SMS es un "dangerous
 * permission" estándar de Android: se puede solicitar con un diálogo normal
 * sin mandar al usuario a ajustes del sistema.
 *
 * El flujo es:
 *   1. La app verifica si ya tiene el permiso.
 *   2. Si no, muestra la tarjeta en Ajustes con un botón "Activar".
 *   3. Al presionar, Android muestra el diálogo "¿Permitir acceso a SMS?".
 *   4. Si el usuario acepta, el lector de SMS puede arrancar inmediatamente.
 */

import { useCallback, useEffect, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

export type EstadoPermisoSMS = 'authorized' | 'denied' | 'never_ask_again' | 'unknown';

export async function consultarPermisoSMS(): Promise<EstadoPermisoSMS> {
  if (Platform.OS !== 'android') return 'unknown';
  try {
    const resultado = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_SMS
    );
    return resultado ? 'authorized' : 'denied';
  } catch {
    return 'unknown';
  }
}

export async function solicitarPermisoSMS(): Promise<EstadoPermisoSMS> {
  if (Platform.OS !== 'android') return 'unknown';
  try {
    const resultado = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'Leer SMS bancarios',
        message:
          'Piggy Eye puede detectar gastos en los mensajes de texto que envían tu banco o billetera. ' +
          'Solo lee mensajes de remitentes bancarios conocidos, nunca mensajes personales.',
        buttonPositive: 'Permitir',
        buttonNegative: 'No gracias',
      }
    );
    switch (resultado) {
      case PermissionsAndroid.RESULTS.GRANTED:
        return 'authorized';
      case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
        return 'never_ask_again';
      default:
        return 'denied';
    }
  } catch {
    return 'unknown';
  }
}

export function usePermisoSMS() {
  const [estado, setEstado] = useState<EstadoPermisoSMS>('unknown');
  const [cargando, setCargando] = useState(true);

  const revisar = useCallback(async () => {
    const actual = await consultarPermisoSMS();
    setEstado(actual);
    setCargando(false);
  }, []);

  useEffect(() => {
    revisar();
    const suscripcion = AppState.addEventListener('change', (sig) => {
      if (sig === 'active') revisar();
    });
    return () => suscripcion.remove();
  }, [revisar]);

  return {
    estado,
    cargando,
    activo: estado === 'authorized',
    solicitar: solicitarPermisoSMS,
  };
}
