/**
 * HU-06: conecta la cola con el servidor apenas carga la app.
 *
 * Se importa desde el headless task (src/notificaciones/headless.ts) y desde
 * app/_layout.tsx, así la sincronización queda configurada tanto con la app
 * abierta como cuando Android la despierta en segundo plano por una
 * notificación bancaria.
 */

import { configurarAdaptador, haySincronizacion } from './cola';
import { crearAdaptadorHttp, urlServidor } from './http';

export const URL_SERVIDOR = urlServidor();

if (URL_SERVIDOR && !haySincronizacion()) {
  configurarAdaptador(crearAdaptadorHttp(URL_SERVIDOR));
}
