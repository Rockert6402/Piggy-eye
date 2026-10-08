/**
 * Exportar movimientos: arma el extracto del período, lo escribe como
 * archivo y abre el menú de Android para compartirlo o guardarlo
 * (Drive, WhatsApp, correo, Archivos…).
 *
 * Los módulos nativos (archivos, impresión, compartir) se cargan aquí
 * dentro y con try/catch: si la app instalada se compiló sin ellos, el
 * resto de la app sigue funcionando y el usuario recibe un mensaje claro.
 */

import { Platform } from 'react-native';

import { listarGastosEntre } from '../db/gastos';
import { construirExtracto, nombreArchivo, rangoDePeriodo, type Periodo } from './extracto';
import { extractoAXlsx } from './excel';
import { extractoAHtml, PAGINA_A4 } from './pdf';
import { extractoACsv } from './csv';

export { PERIODOS, type Periodo } from './extracto';

export type Formato = 'excel' | 'pdf' | 'csv';

export interface ResultadoExportar {
  ok: boolean;
  mensaje?: string;
}

const TIPOS: Record<Formato, { ext: string; mime: string; titulo: string }> = {
  excel: {
    ext: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    titulo: 'Compartir extracto en Excel',
  },
  pdf: { ext: 'pdf', mime: 'application/pdf', titulo: 'Compartir extracto en PDF' },
  csv: { ext: 'csv', mime: 'text/csv', titulo: 'Compartir movimientos en CSV' },
};

type Nativos = {
  FS: typeof import('expo-file-system');
  Sharing: typeof import('expo-sharing');
  Print: typeof import('expo-print');
};

/**
 * Se cargan al importar este archivo, no dentro de la función: Metro solo
 * deja que un try/catch atrape un require fallido si ocurre durante la
 * carga de módulos. Un require tardío que falla se reporta como fatal.
 */
const nativos: Nativos | null = (() => {
  try {
    return {
      FS: require('expo-file-system'),
      Sharing: require('expo-sharing'),
      Print: require('expo-print'),
    };
  } catch {
    return null;
  }
})();

const SIN_MODULO =
  'Esta versión de la app no incluye la exportación de archivos. Recompila la app con "npm run android".';

export async function exportarExtracto(
  formato: Formato,
  periodo: Periodo
): Promise<ResultadoExportar> {
  if (Platform.OS !== 'android') {
    return { ok: false, mensaje: 'Solo disponible en Android por ahora.' };
  }

  if (!nativos) return { ok: false, mensaje: SIN_MODULO };
  const { FS, Sharing, Print } = nativos;

  const rango = rangoDePeriodo(periodo);
  const movimientos = await listarGastosEntre(rango.desde, rango.hasta);
  if (movimientos.length === 0) {
    return { ok: false, mensaje: 'No hay movimientos en el período elegido.' };
  }

  const extracto = construirExtracto(movimientos, rango);
  const { ext, mime, titulo } = TIPOS[formato];
  const destino = new FS.File(FS.Paths.cache, `${nombreArchivo(extracto.generado)}.${ext}`);

  try {
    if (destino.exists) destino.delete();

    if (formato === 'pdf') {
      // expo-print deja el PDF con un nombre aleatorio; se copia con uno legible.
      const { uri } = await Print.printToFileAsync({
        html: extractoAHtml(extracto),
        ...PAGINA_A4,
      });
      const temporal = new FS.File(uri);
      temporal.copy(destino);
      temporal.delete();
    } else {
      destino.create();
      destino.write(formato === 'excel' ? extractoAXlsx(extracto) : extractoACsv(extracto));
    }

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, mensaje: 'Este dispositivo no permite compartir archivos.' };
    }
    await Sharing.shareAsync(destino.uri, { mimeType: mime, dialogTitle: titulo });
    return { ok: true };
  } catch (e) {
    return { ok: false, mensaje: `No se pudo generar el archivo. ${e instanceof Error ? e.message : ''}`.trim() };
  }
}
