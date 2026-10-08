/**
 * HU-01: notificaciones locales hacia el usuario.
 *
 *   - Éxito: "Se registró un gasto de $25.000 en Éxito"
 *   - Fallo: "Detectamos un pago en Bancolombia. Toca aquí para registrarlo
 *            manualmente." → abre la pestaña "Por confirmar" (HU-04).
 *
 * Todo va envuelto en try/catch: estas funciones se llaman desde el
 * headless task, y un aviso que falla nunca debe tumbar el registro del
 * gasto, que ya está guardado en SQLite cuando se llega aquí.
 */

import { Platform } from 'react-native';
import type * as ExpoNotifications from 'expo-notifications';

import { formatearCOP } from '../parser/monto';

const CANAL = 'movimientos';

type Modulo = typeof ExpoNotifications;
let modulo: Modulo | null | undefined;

/**
 * Carga expo-notifications de forma perezosa. Si la app instalada se
 * compiló sin el módulo nativo, el `import` normal revienta al arrancar y
 * se lleva por delante el headless task: se dejaría de capturar gastos
 * por culpa de un aviso. Así, sin módulo nativo, solo se apagan los avisos.
 */
function cargar(): Modulo | null {
  if (modulo !== undefined) return modulo;
  try {
    modulo = require('expo-notifications') as Modulo;
  } catch {
    modulo = null;
    console.warn('[avisos] expo-notifications no disponible: recompila la app.');
  }
  return modulo;
}

// Se intenta al importar este archivo, no después. Metro solo deja que el
// try/catch de arriba atrape el error si el require ocurre durante la carga
// inicial de módulos; un require tardío que falla se reporta como fatal.
cargar();

/** Ruta que abre la app al tocar el aviso. Se lee en app/_layout.tsx. */
export interface DatosAviso {
  url: string;
  [clave: string]: unknown;
}

let canalListo: Promise<unknown> | null = null;

/**
 * Crea el canal de Android una sola vez por proceso. Es idempotente del
 * lado de Android, pero cachear la promesa evita la llamada nativa en cada
 * notificación bancaria.
 */
function asegurarCanal(): Promise<unknown> {
  const Notifications = cargar();
  if (Platform.OS !== 'android' || !Notifications) return Promise.resolve();
  if (!canalListo) {
    canalListo = Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Movimientos registrados',
      description: 'Avisos de gastos registrados o por confirmar',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {
      canalListo = null; // reintentar en la próxima
    });
  }
  return canalListo;
}

/**
 * Llamar una vez al arrancar la interfaz. Define cómo se muestran los
 * avisos con la app abierta (sin esto, en primer plano no aparecen).
 */
export function configurarAvisos(): void {
  const Notifications = cargar();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  void asegurarCanal();
}

/**
 * Android 13+ exige el permiso POST_NOTIFICATIONS en tiempo de ejecución.
 * Solo se pregunta si el sistema todavía lo permite.
 */
export async function pedirPermisoAvisos(): Promise<boolean> {
  const Notifications = cargar();
  if (!Notifications) return false;
  try {
    await asegurarCanal(); // en Android 13+ el diálogo requiere un canal creado
    const actual = await Notifications.getPermissionsAsync();
    if (actual.granted) return true;
    if (!actual.canAskAgain) return false;
    const nuevo = await Notifications.requestPermissionsAsync();
    return nuevo.granted;
  } catch {
    return false;
  }
}

async function enviar(titulo: string, cuerpo: string, datos: DatosAviso): Promise<void> {
  const Notifications = cargar();
  if (!Notifications) return;
  try {
    await asegurarCanal();
    await Notifications.scheduleNotificationAsync({
      content: { title: titulo, body: cuerpo, data: datos },
      trigger: Platform.OS === 'android' ? { channelId: CANAL } : null,
    });
  } catch {
    // Sin permiso o sin módulo nativo: el gasto ya está a salvo, seguimos.
  }
}

/** Texto del aviso de éxito. Exportado para probarlo sin el módulo nativo. */
export function textoGastoRegistrado(datos: {
  monto: number;
  comercio: string | null;
  banco: string;
  tipo: 'gasto' | 'ingreso';
}): string {
  const monto = formatearCOP(datos.monto);
  const lugar = datos.comercio ? `en ${datos.comercio}` : `con ${datos.banco}`;
  return datos.tipo === 'ingreso'
    ? `Se registró un ingreso de ${monto} ${datos.comercio ? `de ${datos.comercio}` : `en ${datos.banco}`}`
    : `Se registró un gasto de ${monto} ${lugar}`;
}

export function textoPagoSinProcesar(banco: string): string {
  return `Detectamos un pago en ${banco}. Toca aquí para registrarlo manualmente.`;
}

export function avisarGastoRegistrado(datos: {
  id: number;
  monto: number;
  comercio: string | null;
  banco: string;
  tipo: 'gasto' | 'ingreso';
}): Promise<void> {
  return enviar(
    datos.tipo === 'ingreso' ? 'Ingreso registrado' : 'Gasto registrado',
    textoGastoRegistrado(datos),
    { url: `/gasto/${datos.id}` }
  );
}

export function avisarPagoSinProcesar(banco: string): Promise<void> {
  return enviar('Movimiento por confirmar', textoPagoSinProcesar(banco), {
    url: '/pendientes',
  });
}

type Respuesta = ExpoNotifications.NotificationResponse;

/** Ruta guardada en `data.url` del aviso que tocó el usuario, si la hay. */
function rutaDeRespuesta(r: Respuesta | null, Notifications: Modulo): string | null {
  if (!r || r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return null;
  const url = r.notification.request.content.data?.url;
  return typeof url === 'string' && url.startsWith('/') ? url : null;
}

/**
 * Llama a `abrir(ruta)` cuando el usuario toca un aviso: tanto con la app
 * abierta como cuando el toque fue lo que la arrancó. Devuelve la función
 * para dejar de escuchar.
 */
export function escucharToquesAvisos(abrir: (ruta: string) => void): () => void {
  const Notifications = cargar();
  if (!Notifications) return () => undefined;

  const manejar = (r: Respuesta | null) => {
    const ruta = rutaDeRespuesta(r, Notifications);
    if (!ruta) return;
    abrir(ruta);
    // Para que no se vuelva a abrir la misma ruta en el próximo arranque.
    Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  };

  Notifications.getLastNotificationResponseAsync().then(manejar).catch(() => undefined);
  const sub = Notifications.addNotificationResponseReceivedListener(manejar);
  return () => sub.remove();
}
