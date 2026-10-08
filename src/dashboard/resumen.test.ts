import {
  rangoConsulta,
  rangoVista,
  resumirTodo,
  resumirVista,
  type MovimientoResumen,
} from './resumen';

// Miércoles 7 de octubre de 2026, 22:00.
const AHORA = new Date(2026, 9, 7, 22, 0);
const f = (mes: number, dia: number, h = 12) => new Date(2026, mes, dia, h).getTime();
const gasto = (fecha: number, monto: number, categoria = 'Sin categoría'): MovimientoResumen => ({
  fecha,
  monto,
  tipo: 'gasto',
  categoria,
});
const ingreso = (fecha: number, monto: number): MovimientoResumen => ({
  fecha,
  monto,
  tipo: 'ingreso',
  categoria: 'Salario',
});

describe('rangos de cada vista', () => {
  it('la semana va de lunes a domingo', () => {
    const r = rangoVista('semana', AHORA);
    expect(new Date(r.desde)).toEqual(new Date(2026, 9, 5)); // lunes 5
    expect(new Date(r.hasta)).toEqual(new Date(2026, 9, 12)); // lunes 12
    expect(r.barras.map((b) => b.etiqueta)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
  });

  it('un domingo pertenece a la semana que empezó el lunes anterior', () => {
    const r = rangoVista('semana', new Date(2026, 9, 11, 9));
    expect(new Date(r.desde)).toEqual(new Date(2026, 9, 5));
  });

  it('el mes tiene una barra por día', () => {
    expect(rangoVista('mes', AHORA).barras).toHaveLength(31);
    expect(rangoVista('mes', new Date(2026, 1, 10)).barras).toHaveLength(28);
  });

  it('la consulta cubre el período anterior de todas las vistas', () => {
    const c = rangoConsulta(AHORA);
    expect(new Date(c.desde)).toEqual(new Date(2026, 8, 1)); // 1 de septiembre
    expect(new Date(c.hasta)).toEqual(new Date(2026, 10, 1)); // 1 de noviembre
  });
});

describe('resumirVista', () => {
  // Gastos que vienen de orígenes distintos: para el resumen todos son iguales.
  const movs: MovimientoResumen[] = [
    gasto(f(9, 7, 9), 52900, 'Mercado'), // automático, hoy
    gasto(f(9, 7, 13), 7000, 'Comida'), // manual en efectivo, hoy
    gasto(f(9, 6), 20000, 'Transporte'), // confirmado desde pendientes, ayer
    gasto(f(9, 4), 15000, 'Comida'), // domingo de la semana pasada
    ingreso(f(9, 1), 1_800_000),
    gasto(f(8, 15), 300000, 'Mercado'), // mes pasado
  ];

  it('día: suma automáticos y manuales y compara con ayer', () => {
    const r = resumirVista(movs, rangoVista('dia', AHORA), AHORA.getTime());
    expect(r.gastos).toBe(59900);
    expect(r.cantidadGastos).toBe(2);
    expect(r.gastosAnterior).toBe(20000);
    expect(r.variacion).toBeCloseTo((59900 - 20000) / 20000);
    expect(r.barras.at(-1)).toMatchObject({ etiqueta: 'Hoy', gastos: 59900, esHoy: true });
  });

  it('semana: incluye lunes a hoy y deja afuera el domingo anterior', () => {
    const r = resumirVista(movs, rangoVista('semana', AHORA), AHORA.getTime());
    expect(r.gastos).toBe(79900);
    expect(r.gastosAnterior).toBe(15000);
  });

  it('mes: separa gastos de ingresos y calcula el balance', () => {
    const r = resumirVista(movs, rangoVista('mes', AHORA), AHORA.getTime());
    expect(r.gastos).toBe(94900);
    expect(r.ingresos).toBe(1_800_000);
    expect(r.balance).toBe(1_705_100);
    expect(r.gastosAnterior).toBe(300000);
    expect(r.categorias.map((c) => c.categoria)).toEqual(['Mercado', 'Comida', 'Transporte']);
    expect(r.categorias.reduce((s, c) => s + c.porcentaje, 0)).toBeCloseTo(1);
  });

  it('sin gastos en el período: totales en cero y sin variación', () => {
    const r = resumirVista([ingreso(f(9, 7), 1000)], rangoVista('dia', AHORA), AHORA.getTime());
    expect(r.cantidadGastos).toBe(0);
    expect(r.gastos).toBe(0);
    expect(r.variacion).toBeNull();
    expect(r.categorias).toEqual([]);
  });

  it('un movimiento justo a medianoche cuenta para el día que empieza', () => {
    const r = resumirVista([gasto(new Date(2026, 9, 7, 0, 0).getTime(), 100)], rangoVista('dia', AHORA));
    expect(r.gastos).toBe(100);
    expect(r.gastosAnterior).toBe(0);
  });

  it('las tres vistas salen de una sola lista', () => {
    const todo = resumirTodo(movs, AHORA);
    expect([todo.dia.gastos, todo.semana.gastos, todo.mes.gastos]).toEqual([59900, 79900, 94900]);
  });
});
