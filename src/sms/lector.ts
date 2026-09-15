/**
 * Lector de SMS bancarios.
 *
 * Complementa el listener de notificaciones push: algunos bancos colombianos
 * (especialmente para pagos con datáfono y transferencias entre bancos)
 * envían alertas por SMS además de, o en vez de, notificación push.
 *
 * Diferencia clave con las notificaciones:
 *   - Las notificaciones se capturan en tiempo real (headless task).
 *   - Los SMS se leen de forma activa cuando la app pasa a primer plano.
 *   - La deduplicación por huella evita registrar dos veces el mismo SMS
 *     si la app lo lee en múltiples ocasiones.
 *
 * IMPORTANTE: requiere el permiso READ_SMS y que el usuario haya aceptado
 * el diálogo en tiempo de ejecución. Si no tiene permiso, esta función
 * retorna inmediatamente sin error.
 */

import { Platform } from 'react-native';
import { BANCOS } from '../parser/bancos';
import { normalizarMonto } from '../parser/monto';
import { crearGasto } from '../db/gastos';
import { crearPendiente, registrarDiagnostico } from '../db/pendientes';
import { encolarSincronizacion } from '../sync/cola';

/**
 * Remitentes (sender) conocidos de SMS bancarios en Colombia.
 * Estos son los nombres alfanuméricos o palabras clave que aparecen
 * en el campo "De:" de un SMS bancario, no package names de Android.
 *
 * ⚠️ Igual que los package names, estos deben verificarse con un teléfono
 * real porque cada banco y operador los define distinto.
 */
const REMITENTES: { patron: RegExp; banco: string }[] = [
  { patron: /bancolombia/i, banco: 'Bancolombia' },
  { patron: /nequi/i, banco: 'Nequi' },
  { patron: /daviplata/i, banco: 'DaviPlata' },
  { patron: /davivienda/i, banco: 'Davivienda' },
  { patron: /b\.bogota|bancobogota|bbogota/i, banco: 'Banco de Bogotá' },
  { patron: /bbva/i, banco: 'BBVA Colombia' },
  { patron: /\bnu\b|nubank/i, banco: 'Nu (Nubank)' },
  { patron: /paypal/i, banco: 'PayPal' },
  { patron: /rappi/i, banco: 'Rappi Pay' },
  { patron: /colpatria|scotiabank/i, banco: 'Scotiabank Colpatria' },
  { patron: /b\.popular|bancopopular/i, banco: 'Banco Popular' },
  { patron: /occidente/i, banco: 'Banco de Occidente' },
];

/** Palabras que indican operación transaccional en un SMS. */
const PALABRAS_OPERACION = [
  'compra', 'pago', 'pagaste', 'transferencia', 'enviaste',
  'retiro', 'cargo', 'débito', 'debito', 'recibiste',
  'you sent', 'you received', 'payment',
];

interface SMSRaw {
  _id: string;
  address: string;
  body: string;
  date: string;
  date_sent?: string;
}

/** Identifica qué banco envió el SMS, o null si no es bancario. */
function detectarBanco(remitente: string): string | null {
  const r = remitente.toLowerCase();
  const match = REMITENTES.find((e) => e.patron.test(r));
  return match?.banco ?? null;
}

/** Comprueba si el texto parece transaccional. */
function esTransaccional(texto: string): boolean {
  const t = texto.toLowerCase();
  return PALABRAS_OPERACION.some((p) => t.includes(p));
}

/** Limpia el nombre de comercio extraído por la regex. */
function limpiarComercio(valor: string | undefined): string | null {
  if (!valor) return null;
  const limpio = valor.replace(/\s+/g, ' ').replace(/[.,;:*\-\s]+$/, '').trim();
  if (limpio.length < 2 || /^\d+$/.test(limpio)) return null;
  return limpio;
}

/**
 * Lee y procesa los SMS del inbox de los últimos `diasAtras` días.
 * Retorna la cantidad de movimientos nuevos registrados.
 */
export async function leerSMSBancarios(diasAtras = 30): Promise<number> {
  if (Platform.OS !== 'android') return 0;

  let SmsAndroid: any;
  try {
    SmsAndroid = require('react-native-get-sms-android').default;
  } catch {
    return 0;
  }

  const desde = Date.now() - diasAtras * 86_400_000;

  const mensajes = await new Promise<SMSRaw[]>((resolve) => {
    SmsAndroid.list(
      JSON.stringify({ box: 'inbox', minDate: desde }),
      () => resolve([]),
      (_count: number, smsList: string) => {
        try {
          resolve(JSON.parse(smsList));
        } catch {
          resolve([]);
        }
      }
    );
  });

  let registrados = 0;

  for (const sms of mensajes) {
    const nombreBanco = detectarBanco(sms.address ?? '');
    if (!nombreBanco) continue;
    if (!esTransaccional(sms.body ?? '')) continue;

    const texto = (sms.body ?? '').trim();
    // sms.date puede ser ms como string ("1718000000000") o una fecha formateada.
    // Intentamos parseo numérico directo; si falla o es una fecha ISO la convertimos.
    const fechaRaw = Number(sms.date);
    const fecha =
      Number.isFinite(fechaRaw) && fechaRaw > 1_000_000_000_000
        ? fechaRaw
        : sms.date
        ? new Date(sms.date).getTime() || Date.now()
        : Date.now();

    // Buscar el banco en BANCOS para usar sus reglas
    const banco = BANCOS.find((b) => b.nombre === nombreBanco);

    let registrado = false;

    if (banco) {
      for (const regla of banco.reglas) {
        const coincidencia = texto.match(regla.patron);
        if (!coincidencia?.groups) continue;

        const monto = normalizarMonto(coincidencia.groups.monto);
        if (monto === null) {
          await crearPendiente({
            montoSugerido: null,
            banco: banco.nombre,
            razon: 'monto-invalido',
            textoOriginal: texto,
            fecha,
          });
          await registrarDiagnostico({
            paquete: `sms:${sms.address}`,
            titulo: `SMS ${banco.nombre}`,
            texto,
            veredicto: 'pendiente',
            motivo: 'monto-invalido',
          });
          registrado = true;
          break;
        }

        const id = await crearGasto({
          monto,
          comercio: limpiarComercio(coincidencia.groups.comercio),
          tipo: regla.tipo,
          origen: 'automatico',
          banco: banco.nombre,
          fecha,
          reglaId: `sms:${regla.id}`,
          textoOriginal: texto,
        });

        await registrarDiagnostico({
          paquete: `sms:${sms.address}`,
          titulo: `SMS ${banco.nombre}`,
          texto,
          veredicto: id === null ? 'duplicada' : 'registrada',
          motivo: `sms:${regla.id}`,
        });

        if (id !== null) {
          await encolarSincronizacion(id);
          registrados++;
        }
        registrado = true;
        break;
      }
    }

    // Si el banco es conocido pero ninguna regla encajó → pendiente
    if (!registrado) {
      const MONTO_GENERICO = /\$?\s*(?<monto>\d{1,3}(?:[.'\s]\d{3})*(?:,\d{1,2})?|\d+)/;
      const gen = texto.match(MONTO_GENERICO);
      await crearPendiente({
        montoSugerido: gen?.groups?.monto ? normalizarMonto(gen.groups.monto) : null,
        banco: nombreBanco,
        razon: 'sin-regla',
        textoOriginal: texto,
        fecha,
      });
      await registrarDiagnostico({
        paquete: `sms:${sms.address}`,
        titulo: `SMS ${nombreBanco}`,
        texto,
        veredicto: 'pendiente',
        motivo: 'sin-regla',
      });
    }
  }

  return registrados;
}
