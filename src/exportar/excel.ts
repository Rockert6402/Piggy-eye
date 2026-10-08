/**
 * Extracto en Excel, con la estructura de un extracto bancario:
 *
 *   Hoja "Extracto": encabezado, resumen (entradas, salidas, neto) y la
 *   tabla de movimientos con columnas separadas de entradas y salidas, saldo
 *   acumulado, filtros y encabezado fijo.
 *
 *   Hoja "Resumen": totales por mes, gastos por categoría y por banco/medio.
 *
 * Los totales van como fórmulas (=SUMA) con su valor ya calculado: se ven
 * bien al abrir y siguen funcionando si el usuario edita o filtra.
 */

import { crearXlsx, ref, type Celda, type Hoja } from './xlsx';
import { fechaCorta, fechaHora, type Extracto } from './extracto';

function hojaExtracto(x: Extracto): Hoja {
  const COLS = ['Fecha', 'Descripción', 'Categoría', 'Banco / medio', 'Registro', 'Entradas', 'Salidas', 'Saldo'];
  const filas: Celda[][] = [];

  filas.push([{ texto: 'Piggy Eye · Extracto de movimientos', estilo: 'titulo' }]);
  filas.push([
    {
      texto: `Período: ${fechaCorta(x.primerDia)} – ${fechaCorta(x.ultimoDia)}   ·   Generado: ${fechaHora(x.generado)}`,
      estilo: 'subtitulo',
    },
  ]);
  filas.push([]);

  // Resumen arriba, como la caja de saldos de un extracto. Las fórmulas
  // apuntan a la fila de totales, que se conoce cuando se arma la tabla.
  const filaEncabezado = 7; // 0-based → fila 8 en Excel
  const primeraDato = filaEncabezado + 1;
  const ultimaDato = primeraDato + Math.max(x.filas.length, 1) - 1;
  const filaTotales = ultimaDato + 1;
  const rangoEntradas = `${ref(primeraDato, 5)}:${ref(ultimaDato, 5)}`;
  const rangoSalidas = `${ref(primeraDato, 6)}:${ref(ultimaDato, 6)}`;

  filas.push([
    { texto: 'Total entradas', estilo: 'etiqueta' },
    { formula: `SUM(${rangoEntradas})`, valor: x.totales.entradas, estilo: 'entrada' },
  ]);
  filas.push([
    { texto: 'Total salidas', estilo: 'etiqueta' },
    { formula: `SUM(${rangoSalidas})`, valor: x.totales.salidas, estilo: 'salida' },
  ]);
  filas.push([
    { texto: 'Neto del período', estilo: 'etiqueta' },
    { formula: `${ref(3, 1)}-${ref(4, 1)}`, valor: x.totales.neto, estilo: 'moneda' },
    { texto: `${x.totales.cantidad} movimientos`, estilo: 'subtitulo' },
  ]);
  filas.push([]);

  filas.push(COLS.map((c) => ({ texto: c, estilo: 'encabezado' as const })));

  if (x.filas.length === 0) {
    filas.push([{ texto: 'No hay movimientos en este período.', estilo: 'textoTenue' }]);
  }

  for (const f of x.filas) {
    filas.push([
      { fecha: f.fecha, estilo: 'fecha' },
      { texto: f.descripcion, estilo: 'texto' },
      { texto: f.categoria, estilo: 'texto' },
      { texto: f.medio, estilo: 'texto' },
      { texto: f.registro, estilo: 'textoTenue' },
      // Celda vacía en vez de $0: así se lee como en un extracto real.
      f.entrada ? { numero: f.entrada, estilo: 'entrada' } : { texto: '', estilo: 'texto' },
      f.salida ? { numero: f.salida, estilo: 'salida' } : { texto: '', estilo: 'texto' },
      { numero: f.saldo, estilo: 'moneda' },
    ]);
  }

  filas.push([
    { texto: 'Totales', estilo: 'totalEtiqueta' },
    { texto: '', estilo: 'totalEtiqueta' },
    { texto: '', estilo: 'totalEtiqueta' },
    { texto: '', estilo: 'totalEtiqueta' },
    { texto: '', estilo: 'totalEtiqueta' },
    { formula: `SUM(${rangoEntradas})`, valor: x.totales.entradas, estilo: 'totalMoneda' },
    { formula: `SUM(${rangoSalidas})`, valor: x.totales.salidas, estilo: 'totalMoneda' },
    {
      formula: `${ref(filaTotales, 5)}-${ref(filaTotales, 6)}`,
      valor: x.totales.neto,
      estilo: 'totalMoneda',
    },
  ]);

  filas.push([]);
  filas.push([
    {
      texto: 'Documento generado por Piggy Eye a partir de tus registros. No es un extracto bancario oficial.',
      estilo: 'subtitulo',
    },
  ]);

  return {
    nombre: 'Extracto',
    filas,
    anchos: [17, 34, 16, 18, 13, 15, 15, 16],
    combinadas: ['A1:H1', 'A2:H2'],
    filasFijas: filaEncabezado + 1,
    filtro: x.filas.length ? `${ref(filaEncabezado, 0)}:${ref(ultimaDato, COLS.length - 1)}` : undefined,
    altos: { 0: 24, [filaEncabezado]: 22 },
  };
}

function hojaResumen(x: Extracto): Hoja {
  const filas: Celda[][] = [];
  const combinadas: string[] = ['A1:D1'];

  filas.push([{ texto: 'Resumen del período', estilo: 'titulo' }]);
  filas.push([
    { texto: `${fechaCorta(x.primerDia)} – ${fechaCorta(x.ultimoDia)}`, estilo: 'subtitulo' },
  ]);
  filas.push([]);

  // Por mes
  filas.push([{ texto: 'Entradas y salidas por mes', estilo: 'seccion' }]);
  filas.push(['Mes', 'Entradas', 'Salidas', 'Neto'].map((c) => ({ texto: c, estilo: 'encabezado' as const })));
  const iniMes = filas.length;
  for (const m of x.porMes) {
    const r = filas.length;
    filas.push([
      { texto: m.etiqueta, estilo: 'texto' },
      { numero: m.entradas, estilo: 'entrada' },
      { numero: m.salidas, estilo: 'salida' },
      { formula: `${ref(r, 1)}-${ref(r, 2)}`, valor: m.neto, estilo: 'moneda' },
    ]);
  }
  if (x.porMes.length) {
    const fin = filas.length - 1;
    const r = filas.length;
    filas.push([
      { texto: 'Total', estilo: 'totalEtiqueta' },
      { formula: `SUM(${ref(iniMes, 1)}:${ref(fin, 1)})`, valor: x.totales.entradas, estilo: 'totalMoneda' },
      { formula: `SUM(${ref(iniMes, 2)}:${ref(fin, 2)})`, valor: x.totales.salidas, estilo: 'totalMoneda' },
      { formula: `${ref(r, 1)}-${ref(r, 2)}`, valor: x.totales.neto, estilo: 'totalMoneda' },
    ]);
  } else {
    filas.push([{ texto: 'Sin movimientos.', estilo: 'textoTenue' }]);
  }
  filas.push([]);

  // Por categoría (solo salidas)
  filas.push([{ texto: 'Gastos por categoría', estilo: 'seccion' }]);
  filas.push(['Categoría', 'Total', '% de las salidas'].map((c) => ({ texto: c, estilo: 'encabezado' as const })));
  const iniCat = filas.length;
  for (const c of x.porCategoria) {
    filas.push([
      { texto: c.categoria, estilo: 'texto' },
      { numero: c.total, estilo: 'salida' },
      { numero: c.porcentaje, estilo: 'porcentaje' },
    ]);
  }
  if (x.porCategoria.length) {
    filas.push([
      { texto: 'Total', estilo: 'totalEtiqueta' },
      {
        formula: `SUM(${ref(iniCat, 1)}:${ref(filas.length - 1, 1)})`,
        valor: x.totales.salidas,
        estilo: 'totalMoneda',
      },
    ]);
  } else {
    filas.push([{ texto: 'Sin gastos.', estilo: 'textoTenue' }]);
  }
  filas.push([]);

  // Por banco o medio
  filas.push([{ texto: 'Por banco o medio de pago', estilo: 'seccion' }]);
  filas.push(['Banco / medio', 'Entradas', 'Salidas'].map((c) => ({ texto: c, estilo: 'encabezado' as const })));
  for (const m of x.porMedio) {
    filas.push([
      { texto: m.medio, estilo: 'texto' },
      { numero: m.entradas, estilo: 'entrada' },
      { numero: m.salidas, estilo: 'salida' },
    ]);
  }
  if (!x.porMedio.length) filas.push([{ texto: 'Sin movimientos.', estilo: 'textoTenue' }]);

  return { nombre: 'Resumen', filas, anchos: [26, 16, 16, 16], combinadas, altos: { 0: 24 } };
}

export function extractoAXlsx(x: Extracto): Uint8Array {
  return crearXlsx([hojaExtracto(x), hojaResumen(x)], 'Piggy Eye · Extracto de movimientos');
}
