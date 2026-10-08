/**
 * Extracto en CSV, para importarlo en otras apps.
 *
 * Usa punto y coma como separador y BOM UTF-8: es lo que espera Excel con
 * configuración regional de Colombia (donde la coma es el decimal), y el
 * BOM hace que las tildes se vean bien al abrirlo con doble clic.
 */

import { fechaHora, type Extracto } from './extracto';

const SEP = ';';

function campo(valor: string | number): string {
  const s = String(valor);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Montos sin separador de miles y con coma decimal: 52900 o 12,5 */
function monto(n: number): string {
  return n ? String(n).replace('.', ',') : '';
}

export function extractoACsv(x: Extracto): string {
  const cabecera = ['Fecha', 'Descripción', 'Categoría', 'Banco / medio', 'Registro', 'Entradas', 'Salidas', 'Saldo'];
  const filas = x.filas.map((f) =>
    [
      fechaHora(f.fecha),
      f.descripcion,
      f.categoria,
      f.medio,
      f.registro,
      monto(f.entrada),
      monto(f.salida),
      monto(f.saldo) || '0',
    ]
      .map(campo)
      .join(SEP)
  );
  return '﻿' + [cabecera.map(campo).join(SEP), ...filas].join('\r\n') + '\r\n';
}
