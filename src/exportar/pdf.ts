/**
 * Extracto en PDF. Se arma como HTML y expo-print lo convierte con el motor
 * de impresión de Android, así que las tablas, los saltos de página y el
 * encabezado que se repite en cada hoja los resuelve el sistema.
 *
 * Tamaño A4 (595 × 842 puntos), que es el estándar en Colombia.
 */

import { formatearCOP } from '../parser/monto';
import { fechaCorta, fechaHora, type Extracto } from './extracto';

export const PAGINA_A4 = { width: 595, height: 842 };

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const pesos = (n: number) => esc(formatearCOP(n));
const vacio = (n: number, clase: string) => (n ? `<td class="num ${clase}">${pesos(n)}</td>` : '<td class="num"></td>');

const CSS = `
  @page { size: A4; margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, "Segoe UI", Arial, sans-serif; color: #16272C; font-size: 9.5pt; margin: 0; }
  .cab { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #16272C; padding-bottom: 8px; margin-bottom: 12px; }
  .marca { font-size: 17pt; font-weight: 700; letter-spacing: -0.3px; }
  .marca span { color: #C4687F; }
  .meta { text-align: right; color: #5F7A80; font-size: 8.5pt; line-height: 1.5; }
  .meta b { color: #16272C; }
  .cajas { display: flex; gap: 8px; margin-bottom: 14px; }
  .caja { flex: 1; border: 1px solid #D5DEE0; border-radius: 6px; padding: 8px 10px; }
  .caja .et { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; color: #5F7A80; }
  .caja .v { font-size: 13pt; font-weight: 700; margin-top: 2px; }
  .in { color: #1E7F55; }
  .out { color: #B3261E; }
  h2 { font-size: 10.5pt; margin: 16px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: #16272C; color: #fff; font-weight: 600; font-size: 8pt; text-align: left; padding: 5px 6px; }
  th.num { text-align: right; }
  td { padding: 4px 6px; border-bottom: 1px solid #E3EAEB; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #F6F9F9; }
  td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  td.fecha { white-space: nowrap; color: #3D5359; }
  td.sub { color: #5F7A80; font-size: 8pt; }
  /* Los totales van en tbody: un <tfoot> se repetiría al pie de cada página. */
  tr.total td { font-weight: 700; background: #EEF3F3 !important; border-top: 1.5px solid #16272C; border-bottom: 3px double #16272C; }
  .dos { display: flex; gap: 14px; }
  .dos > div { flex: 1; }
  .vacio { color: #5F7A80; padding: 10px 6px; }
  .pie { margin-top: 18px; color: #5F7A80; font-size: 7.5pt; border-top: 1px solid #D5DEE0; padding-top: 6px; }
  .bloque { page-break-inside: avoid; }
`;

function tablaMovimientos(x: Extracto): string {
  if (!x.filas.length) return '<p class="vacio">No hay movimientos en este período.</p>';
  const filas = x.filas
    .map(
      (f) => `<tr>
<td class="fecha">${esc(fechaHora(f.fecha))}</td>
<td>${esc(f.descripcion)}<div class="sub">${esc(f.categoria)} · ${esc(f.registro)}</div></td>
<td>${esc(f.medio)}</td>
${vacio(f.entrada, 'in')}
${vacio(f.salida, 'out')}
<td class="num">${pesos(f.saldo)}</td>
</tr>`
    )
    .join('');
  return `<table>
<thead><tr><th style="width:17%">Fecha</th><th>Descripción</th><th style="width:15%">Banco / medio</th><th class="num" style="width:13%">Entradas</th><th class="num" style="width:13%">Salidas</th><th class="num" style="width:13%">Saldo</th></tr></thead>
<tbody>${filas}
<tr class="total"><td colspan="3">Totales (${x.totales.cantidad} movimientos)</td><td class="num in">${pesos(x.totales.entradas)}</td><td class="num out">${pesos(x.totales.salidas)}</td><td class="num">${pesos(x.totales.neto)}</td></tr></tbody>
</table>`;
}

function tablaMeses(x: Extracto): string {
  if (!x.porMes.length) return '<p class="vacio">Sin movimientos.</p>';
  return `<table>
<thead><tr><th>Mes</th><th class="num">Entradas</th><th class="num">Salidas</th><th class="num">Neto</th></tr></thead>
<tbody>${x.porMes
    .map(
      (m) =>
        `<tr><td>${esc(m.etiqueta)}</td><td class="num in">${pesos(m.entradas)}</td><td class="num out">${pesos(m.salidas)}</td><td class="num">${pesos(m.neto)}</td></tr>`
    )
    .join('')}
<tr class="total"><td>Total</td><td class="num in">${pesos(x.totales.entradas)}</td><td class="num out">${pesos(x.totales.salidas)}</td><td class="num">${pesos(x.totales.neto)}</td></tr></tbody>
</table>`;
}

function tablaCategorias(x: Extracto): string {
  if (!x.porCategoria.length) return '<p class="vacio">Sin gastos.</p>';
  return `<table>
<thead><tr><th>Categoría</th><th class="num">Total</th><th class="num">%</th></tr></thead>
<tbody>${x.porCategoria
    .map(
      (c) =>
        `<tr><td>${esc(c.categoria)}</td><td class="num out">${pesos(c.total)}</td><td class="num">${(c.porcentaje * 100).toFixed(1)}%</td></tr>`
    )
    .join('')}</tbody>
</table>`;
}

function tablaMedios(x: Extracto): string {
  if (!x.porMedio.length) return '<p class="vacio">Sin movimientos.</p>';
  return `<table>
<thead><tr><th>Banco / medio</th><th class="num">Entradas</th><th class="num">Salidas</th></tr></thead>
<tbody>${x.porMedio
    .map(
      (m) =>
        `<tr><td>${esc(m.medio)}</td>${vacio(m.entradas, 'in')}${vacio(m.salidas, 'out')}</tr>`
    )
    .join('')}</tbody>
</table>`;
}

export function extractoAHtml(x: Extracto): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Extracto Piggy Eye</title><style>${CSS}</style></head>
<body>
<div class="cab">
  <div><div class="marca">Piggy <span>Eye</span></div><div class="meta">Extracto de movimientos</div></div>
  <div class="meta">Período: <b>${esc(fechaCorta(x.primerDia))} – ${esc(fechaCorta(x.ultimoDia))}</b><br>Generado: ${esc(fechaHora(x.generado))}</div>
</div>

<div class="cajas">
  <div class="caja"><div class="et">Total entradas</div><div class="v in">${pesos(x.totales.entradas)}</div></div>
  <div class="caja"><div class="et">Total salidas</div><div class="v out">${pesos(x.totales.salidas)}</div></div>
  <div class="caja"><div class="et">Neto del período</div><div class="v">${pesos(x.totales.neto)}</div></div>
</div>

<h2>Movimientos</h2>
${tablaMovimientos(x)}

<div class="bloque">
<h2>Entradas y salidas por mes</h2>
${tablaMeses(x)}
</div>

<div class="dos bloque">
  <div><h2>Gastos por categoría</h2>${tablaCategorias(x)}</div>
  <div><h2>Por banco o medio de pago</h2>${tablaMedios(x)}</div>
</div>

<div class="pie">Documento generado por Piggy Eye a partir de tus registros. No es un extracto bancario oficial.</div>
</body></html>`;
}
