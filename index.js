/**
 * Punto de entrada.
 *
 * El registro del headless task tiene que pasar ACÁ, antes de que cargue
 * cualquier otra cosa: Android puede despertar la tarea con la app cerrada,
 * y si el registro vive dentro de un componente nunca llega a ejecutarse.
 */
import { AppRegistry } from 'react-native';
import { RNAndroidNotificationListenerHeadlessJsName } from 'react-native-android-notification-listener';

import { manejarNotificacion } from './src/notificaciones/headless';

AppRegistry.registerHeadlessTask(
  RNAndroidNotificationListenerHeadlessJsName,
  () => manejarNotificacion
);

import 'expo-router/entry';
