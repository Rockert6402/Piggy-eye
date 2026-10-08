import { strFromU8, unzipSync } from 'fflate';

import type { Gasto } from '../db/gastos';
import { construirExtracto, rangoDePeriodo } from './extracto';
import { extractoAXlsx } from './excel';
import { extractoAHtml } from './pdf';
import { extractoACsv } from './csv';
import { columna, fechaExcel } from './xlsx';

let id = 0;
const mov = (p: Partial<Gasto> & { monto: number; fecha: number }): Gasto => ({
  id: ++id,
  comercio: null,
  categoria: 'Sin categoría',
  tipo: 'gasto',
  origen: 'automatico',
  banco: 'Nequi',
  nota: null,
  creado_en: p.fecha,
  editado_en: null,
  regla_id: null,
  texto_original: null,
  huella: `h-${id}`,
  sincronizado: 0,
  ...p,
});

const AHORA = new Date(2026, 9, 7, 22, 0); // 7 oct 2026
const d = (mes: number, dia: number, h = 12) => new Date(2026, mes, dia, h).getTime();

const datos: Gasto[] = [
  mov({ monto: 50000, fecha: d(9, 3), comercio: 'Éxito', categoria: 'Mercado', banco: 'Bancolombia' }),
  mov({ monto: 1_000_000, fecha: d(9, 1), tipo: 'ingreso', comercio: 'Nómina' }),
  mov({ monto: 20000, fecha: d(8, 28), categoria: 'Transporte' }),
  mov({ monto: 7000, fecha: d(9, 5), origen: 'manual', banco: null, nota: 'Tinto' }),
];

describe('rangos de período', () => {
  it('"mes anterior" cubre exactamente el mes calendario anterior', () => {
    const r = rangoDePeriodo('mes-anterior', AHORA);
    expect(new Date(r.desde)).toEqual(new Date(2026, 8, 1));
    expect(new Date(r.hasta)).toEqual(new Date(2026, 9, 1));
  });

  it('"últimos 3 meses" arranca el día 1 de hace dos meses', () => {
    expect(new Date(rangoDePeriodo('tres-meses', AHORA).desde)).toEqual(new Date(2026, 7, 1));
  });

  it('enero: "mes anterior" es diciembre del año pasado', () => {
    const r = rangoDePeriodo('mes-anterior', new Date(2026, 0, 15));
    expect(new Date(r.desde)).toEqual(new Date(2025, 11, 1));
  });
});

describe('construirExtracto', () => {
  const x = construirExtracto(datos, rangoDePeriodo('tres-meses', AHORA), AHORA.getTime());

  it('ordena del más antiguo al más reciente y acumula el saldo', () => {
    expect(x.filas.map((f) => f.saldo)).toEqual([-20000, 980000, 930000, 923000]);
  });

  it('separa entradas y salidas como un extracto', () => {
    expect(x.totales).toEqual({ entradas: 1_000_000, salidas: 77000, neto: 923000, cantidad: 4 });
    const ingreso = x.filas.find((f) => f.descripcion === 'Nómina')!;
    expect(ingreso.entrada).toBe(1_000_000);
    expect(ingreso.salida).toBe(0);
  });

  it('resume por mes en orden y por categoría solo con salidas', () => {
    expect(x.porMes.map((m) => [m.etiqueta, m.entradas, m.salidas])).toEqual([
      ['Septiembre 2026', 0, 20000],
      ['Octubre 2026', 1_000_000, 57000],
    ]);
    expect(x.porCategoria[0]).toMatchObject({ categoria: 'Mercado', total: 50000 });
    expect(x.porCategoria.reduce((s, c) => s + c.porcentaje, 0)).toBeCloseTo(1);
  });

  it('usa nota como descripción y "Efectivo" para manuales sin banco', () => {
    const tinto = x.filas.find((f) => f.descripcion === 'Tinto')!;
    expect(tinto.medio).toBe('Efectivo');
    expect(tinto.registro).toBe('Manual');
  });

  it('no arrastra errores de coma flotante', () => {
    const y = construirExtracto(
      [mov({ monto: 0.1, fecha: d(9, 1) }), mov({ monto: 0.2, fecha: d(9, 2) })],
      rangoDePeriodo('mes', AHORA)
    );
    expect(y.totales.salidas).toBe(0.3);
  });
});

describe('archivos generados', () => {
  const x = construirExtracto(datos, rangoDePeriodo('tres-meses', AHORA), AHORA.getTime());

  it('el .xlsx es un ZIP con las partes que Excel exige', () => {
    const zip = unzipSync(extractoAXlsx(x));
    for (const parte of [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]) {
      expect(zip[parte]).toBeDefined();
    }
    const hoja = strFromU8(zip['xl/worksheets/sheet1.xml']!);
    expect(hoja).toContain('Éxito');
    expect(hoja).toContain('<f>SUM(F9:F12)</f>');
    // El número de estilos declarado debe coincidir con los definidos.
    const estilos = strFromU8(zip['xl/styles.xml']!);
    const declarado = Number(/<cellXfs count="(\d+)"/.exec(estilos)![1]);
    const reales = estilos.split('<cellXfs')[1]!.split('</cellXfs>')[0]!.match(/<xf /g)!.length;
    expect(reales).toBe(declarado);
  });

  it('escapa texto del usuario en XML y HTML', () => {
    const y = construirExtracto(
      [mov({ monto: 1000, fecha: d(9, 1), comercio: 'A&B <script>' })],
      rangoDePeriodo('mes', AHORA)
    );
    const hoja = strFromU8(unzipSync(extractoAXlsx(y))['xl/worksheets/sheet1.xml']!);
    expect(hoja).toContain('A&amp;B &lt;script&gt;');
    expect(extractoAHtml(y)).toContain('A&amp;B &lt;script&gt;');
    expect(extractoAHtml(y)).not.toContain('<script>');
  });

  it('el CSV usa ; con BOM y comas decimales', () => {
    const csv = extractoACsv(x);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    // trim() también quitaría el BOM, por eso se corta aparte.
    const lineas = csv.slice(1).trim().split('\r\n');
    expect(lineas[0]).toBe('Fecha;Descripción;Categoría;Banco / medio;Registro;Entradas;Salidas;Saldo');
    expect(lineas).toHaveLength(5);
  });

  it('convierte fechas y columnas al formato de Excel', () => {
    expect(columna(0)).toBe('A');
    expect(columna(25)).toBe('Z');
    expect(columna(26)).toBe('AA');
    // 1 de enero de 2026 a medianoche local = serial 46023 en Excel.
    expect(fechaExcel(new Date(2026, 0, 1).getTime())).toBeCloseTo(46023, 6);
  });
});
