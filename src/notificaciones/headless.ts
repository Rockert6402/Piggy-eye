/**
 * Puente entre el NotificationListenerService de Android y la app.
 *
 * Esto corre en un Headless JS Task: un contexto de JavaScript separado,
 * sin interfaz, que Android despierta cuando llega una notificación. Tres
 * consecuencias que hay que tener presentes al tocar este archivo:
 *
 *   1. No hay acceso al estado de React ni a los componentes.
 *   2. Una excepción no atrapada mata la tarea en silencio y el gasto se
 *      pierde sin rastro. Por eso todo va dentro de try/catch.
 *   3. La tarea debe devolver una promesa. Si retorna antes de que las
 *      escrituras terminen, Android puede matar el proceso a mitad.
 */

import { parsearNotificacion, type NotificacionCruda } from '../parser';
import { crearGasto } from '../db/gastos';
import { crearPendiente, registrarDiagnostico } from '../db/pendientes';
import { encolarSincronizacion } from '../sync/cola';

/**
 * El módulo nativo entrega la notificación como un string JSON dentro de
 * `notification`. Si el formato cambia en una versión futura del módulo,
 * este es el primer lugar donde mirar.
 */
export async function manejarNotificacion({
  notification,
}: {
  notification?: string;
}): Promise<void> {
  if (!notification) return;

  let cruda: NotificacionCruda;
  try {
    cruda = JSON.parse(notification);
  } catch {
    return;
  }

  try {
    const resultado = parsearNotificacion(cruda);
    const titulo = cruda.titleBig || cruda.title || '';
    const texto = cruda.bigText || cruda.text || '';

    if (resultado.estado === 'descartada') {
      // Solo registramos descartes de apps bancarias conocidas; si no,
      // la bitácora se llenaría con WhatsApp y el sistema operativo.
      if (resultado.motivo !== 'paquete-desconocido') {
        await registrarDiagnostico({
          paquete: cruda.app,
          titulo,
          texto,
          veredicto: 'descartada',
          motivo: resultado.motivo,
        });
      }
      return;
    }

    if (resultado.estado === 'pendiente') {
      await crearPendiente({
        montoSugerido: resultado.montoSugerido,
        banco: resultado.banco,
        razon: resultado.razon,
        textoOriginal: resultado.textoOriginal,
        fecha: resultado.fecha,
      });
      await registrarDiagnostico({
        paquete: cruda.app,
        titulo,
        texto,
        veredicto: 'pendiente',
        motivo: resultado.razon,
      });
      return;
    }

    const id = await crearGasto({
      monto: resultado.monto,
      comercio: resultado.comercio,
      tipo: resultado.tipo,
      origen: 'automatico',
      banco: resultado.banco,
      fecha: resultado.fecha,
      reglaId: resultado.reglaId,
      textoOriginal: resultado.textoOriginal,
    });

    await registrarDiagnostico({
      paquete: cruda.app,
      titulo,
      texto,
      veredicto: id === null ? 'duplicada' : 'registrada',
      motivo: resultado.reglaId,
    });

    // El gasto ya está a salvo en disco. La subida es mejor-esfuerzo.
    if (id !== null) {
      await encolarSincronizacion(id);
    }
  } catch (error) {
    // Último recurso: dejar constancia de que algo llegó y falló, para que
    // el usuario al menos sepa que hubo un movimiento sin registrar.
    try {
      await registrarDiagnostico({
        paquete: cruda.app ?? 'desconocido',
        titulo: cruda.title ?? '',
        texto: cruda.text ?? '',
        veredicto: 'error',
        motivo: String(error),
      });
    } catch {
      // Si ni siquiera la bitácora funciona, no hay nada más que hacer.
    }
  }
}
