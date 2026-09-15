import { Platform, Share } from 'react-native';
import { listarGastos } from '../db/gastos';

function escaparCSV(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  const s = String(valor);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatearFecha(ms: number): string {
  return new Date(ms).toLocaleDateString('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export async function exportarCSV(): Promise<{ ok: boolean; mensaje?: string }> {
  if (Platform.OS !== 'android') {
    return { ok: false, mensaje: 'Solo disponible en Android por ahora.' };
  }

  const todos = await listarGastos(10_000, 0);
  if (todos.length === 0) {
    return { ok: false, mensaje: 'No hay movimientos para exportar.' };
  }

  const cabecera = ['Fecha', 'Tipo', 'Monto', 'Comercio', 'Categoría', 'Banco', 'Origen', 'Nota'].join(',');
  const filas = todos.map((g) =>
    [
      escaparCSV(formatearFecha(g.fecha)),
      escaparCSV(g.tipo),
      escaparCSV(g.monto),
      escaparCSV(g.comercio),
      escaparCSV(g.categoria),
      escaparCSV(g.banco),
      escaparCSV(g.origen),
      escaparCSV(g.nota),
    ].join(',')
  );

  const contenido = [cabecera, ...filas].join('\n');

  await Share.share({
    title: `piggy-eye-${new Date().toISOString().slice(0, 10)}.csv`,
    message: contenido,
  });

  return { ok: true };
}
