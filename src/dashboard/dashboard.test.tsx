/**
 * Prueba de la pantalla del dashboard (HU-05) con la base de datos simulada.
 * Vive en src/ y no en app/ porque expo-router trataría el archivo como ruta.
 */

import React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

const mockListar = jest.fn();
let mockRecargar: (() => void) | null = null;

jest.mock('../db/gastos', () => ({ listarParaResumen: (...a: unknown[]) => mockListar(...a) }));
jest.mock('../db/presupuestos', () => ({ presupuestosConGasto: async () => [] }));
jest.mock('../db/pendientes', () => ({ contarPendientes: async () => 0 }));
jest.mock('../sms', () => ({
  consultarPermisoSMS: async () => 'denied',
  leerSMSBancarios: async () => 0,
}));
jest.mock('../notificaciones/permisos', () => ({
  usePermisoNotificaciones: () => ({ cargando: false, activo: true, solicitar: () => undefined }),
}));
jest.mock('../eventos', () => ({
  useAlCambiarDatos: (cb: () => void) => {
    mockRecargar = cb;
  },
}));
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useRouter: () => ({ push: jest.fn() }),
    // En la prueba, "enfocar" la pantalla es simplemente montarla.
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

import { SafeAreaProvider } from 'react-native-safe-area-context';
import Dashboard from '../../app/(tabs)/index';

// Medidas fijas: en la app real las da el SafeAreaProvider de app/_layout.tsx.
const MEDIDAS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** Todo el texto visible de la pantalla, unido. */
function textos(arbol: ReactTestRenderer): string {
  const partes: string[] = [];
  const recorrer = (n: unknown): void => {
    if (typeof n === 'string') partes.push(n);
    else if (Array.isArray(n)) n.forEach(recorrer);
    else if (n && typeof n === 'object' && 'children' in n) recorrer((n as { children: unknown }).children);
  };
  recorrer(arbol.toJSON());
  return partes.join(' ').replace(/\s+/g, ' ');
}

function tocar(arbol: ReactTestRenderer, etiqueta: string) {
  // El Boton de la app dispara al soltar (onPressOut); los Pressable simples, con onPress.
  const candidatos = arbol.root.findAll(
    (n) =>
      (typeof n.props.onPress === 'function' || typeof n.props.onPressOut === 'function') &&
      n.findAll((h) => h.children.includes(etiqueta), { deep: true }).length > 0
  );
  const boton = candidatos[candidatos.length - 1]; // el más interno
  if (!boton) throw new Error(`No se encontró el botón "${etiqueta}"`);
  act(() => (boton.props.onPress ?? boton.props.onPressOut)());
}

async function montar() {
  let arbol!: ReactTestRenderer;
  await act(async () => {
    arbol = renderer.create(
      <SafeAreaProvider initialMetrics={MEDIDAS}>
        <Dashboard />
      </SafeAreaProvider>
    );
  });
  return arbol;
}

const hoy = () => Date.now() - 60_000;
const haceDias = (n: number) => Date.now() - n * 86_400_000;

beforeEach(() => {
  mockListar.mockReset();
  mockRecargar = null;
});

it('muestra el total del día y cambia a semana y mes sin volver a consultar', async () => {
  mockListar.mockResolvedValue([
    { fecha: hoy(), monto: 52900, tipo: 'gasto', categoria: 'Mercado' }, // automático
    { fecha: hoy(), monto: 7000, tipo: 'gasto', categoria: 'Comida' }, // manual
  ]);
  const arbol = await montar();
  expect(textos(arbol)).toContain('Hoy · gastaste');
  expect(textos(arbol)).toMatch(/59\.900/);
  expect(textos(arbol)).toContain('2 gastos');

  const consultas = mockListar.mock.calls.length;
  tocar(arbol, 'Semana');
  expect(textos(arbol)).toContain('Esta semana · gastaste');
  tocar(arbol, 'Mes');
  expect(textos(arbol)).toMatch(/[A-Z][a-z]+ \d{4} · gastaste/);
  // Cambiar de pestaña no consulta la base: es inmediato.
  expect(mockListar.mock.calls.length).toBe(consultas);
});

it('muestra el estado vacío cuando no hay gastos en el período', async () => {
  mockListar.mockResolvedValue([
    // Solo un gasto de hace 10 días: el día y (casi seguro) la semana quedan vacíos.
    { fecha: haceDias(10), monto: 10000, tipo: 'gasto', categoria: 'Otros' },
  ]);
  const arbol = await montar();
  expect(textos(arbol)).toContain('No hay gastos registrados para este periodo');
});

it('si falla el cálculo muestra el error y reintenta', async () => {
  mockListar.mockRejectedValueOnce(new Error('disco lleno'));
  const arbol = await montar();
  expect(textos(arbol)).toContain('No pudimos calcular tus totales');

  mockListar.mockResolvedValue([{ fecha: hoy(), monto: 1000, tipo: 'gasto', categoria: 'Otros' }]);
  await act(async () => {
    tocar(arbol, 'Reintentar');
  });
  expect(textos(arbol)).not.toContain('No pudimos calcular');
  expect(textos(arbol)).toMatch(/1\.000/);
});

it('se recalcula solo cuando entra un gasto nuevo', async () => {
  mockListar.mockResolvedValue([]);
  const arbol = await montar();
  expect(textos(arbol)).toContain('No hay gastos registrados para este periodo');

  mockListar.mockResolvedValue([{ fecha: hoy(), monto: 25000, tipo: 'gasto', categoria: 'Comida' }]);
  await act(async () => {
    mockRecargar?.();
  });
  expect(textos(arbol)).toMatch(/25\.000/);
});
