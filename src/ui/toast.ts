/**
 * Mensajes breves de confirmación (HU-03 y HU-04).
 *
 * Android trae ToastAndroid de serie, así que no hace falta una librería.
 * En otras plataformas no hace nada: la app es Android-only por alcance.
 */

import { Platform, ToastAndroid } from 'react-native';

export function mostrarToast(mensaje: string): void {
  if (Platform.OS !== 'android') return;
  ToastAndroid.show(mensaje, ToastAndroid.SHORT);
}
