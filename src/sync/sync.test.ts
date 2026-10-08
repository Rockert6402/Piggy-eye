/**
 * @jest-environment node
 *
 * HU-06 de punta a punta: la cola y el adaptador HTTP reales contra el
 * servidor simulado real (servidor/index.js), levantado en un puerto libre.
 * Solo la base de datos del teléfono se reemplaza por una en memoria.
 *
 * Se usa el entorno "node" para tener fetch y sockets de verdad.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';

import type { Gasto } from '../db/gastos';

jest.mock('../db/esquema', () => ({ abrirBD: jest.fn() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: {} } }));

// Archivo de datos temporal ANTES de cargar el servidor.
const ARCHIVO = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'piggy-')), 'datos.json');
process.env.DATOS = ARCHIVO;
process.env.SILENCIO = '1';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const srv = require('../../servidor/index.js') as {
  servidor: import('http').Server;
  cargar: () => void;
};

import { configurarAdaptador, configurarAlmacen, obtenerEstadoSync, vaciarCola, type Almacen } from './cola';
import { crearAdaptadorHttp, ErrorServidor } from './http';

let url = '';

beforeAll(async () => {
  srv.cargar();
  await new Promise<void>((r) => srv.servidor.listen(0, '127.0.0.1', () => r()));
  url = `http://127.0.0.1:${(srv.servidor.address() as AddressInfo).port}`;
});

afterAll(async () => {
  srv.servidor.closeAllConnections();
  await new Promise((r) => srv.servidor.close(r));
});

/** Base de datos del teléfono, en memoria. */
function crearTelefono(cantidad: number) {
  const gastos: Gasto[] = Array.from({ length: cantidad }, (_, i) => ({
    id: i + 1,
    monto: 1000 + i,
    comercio: `Comercio ${i + 1}`,
    categoria: 'Mercado',
    tipo: 'gasto',
    origen: i % 2 ? 'manual' : 'automatico',
    banco: 'Nequi',
    nota: null,
    fecha: 1_790_000_000_000 + i * 60_000,
    creado_en: 0,
    editado_en: null,
    regla_id: null,
    texto_original: null,
    huella: `huella-${i + 1}`,
    sincronizado: 0,
  }));
  const almacen: Almacen = {
    async pendientes(limite, excluir) {
      return gastos
        .filter((g) => g.sincronizado === 0 && !excluir.includes(g.id))
        .slice(0, limite)
        .map((g) => ({ ...g }));
    },
    async marcarSubidos(ids, inicio) {
      for (const g of gastos) {
        if (ids.includes(g.id) && (g.editado_en === null || g.editado_en < inicio)) g.sincronizado = 1;
      }
    },
    async contarPendientes() {
      return gastos.filter((g) => g.sincronizado === 0).length;
    },
  };
  return { gastos, almacen };
}

const fetchNode: typeof fetch = (...a) => fetch(...a);

async function servidor(ruta: string, cuerpo?: object) {
  const r = await fetch(`${url}${ruta}`, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return r.json();
}
const modo = (m: string) => servidor('/control', { modo: m });
const enServidor = async () => ((await servidor('/api/movimientos')).movimientos as { clave: string }[]);

beforeEach(async () => {
  await modo('normal');
  await servidor('/api/reiniciar', {});
  configurarAdaptador(crearAdaptadorHttp(url, fetchNode, 2000));
});

afterEach(() => {
  configurarAlmacen(null);
  configurarAdaptador(null);
});

it('sube todo por lotes y marca solo lo confirmado', async () => {
  const tel = crearTelefono(120);
  configurarAlmacen(tel.almacen);

  expect(await vaciarCola(50)).toBe(120);
  expect(await tel.almacen.contarPendientes()).toBe(0);
  expect(await enServidor()).toHaveLength(120);
  expect(obtenerEstadoSync().ultimoError).toBeNull();
});

it('reenviar los mismos gastos no crea duplicados en el servidor', async () => {
  const tel = crearTelefono(30);
  configurarAlmacen(tel.almacen);
  await vaciarCola();

  // Como si el teléfono no hubiera alcanzado a marcarlos y los reenviara.
  tel.gastos.forEach((g) => (g.sincronizado = 0));
  expect(await vaciarCola()).toBe(30);

  const claves = (await enServidor()).map((m) => m.clave);
  expect(claves).toHaveLength(30);
  expect(new Set(claves).size).toBe(30);
});

it('si la conexión se corta a mitad, no marca nada y al reintentar no duplica', async () => {
  const tel = crearTelefono(10);
  configurarAlmacen(tel.almacen);

  // El servidor guarda la mitad del lote y corta la conexión sin responder.
  await modo('cortar');
  await expect(vaciarCola()).rejects.toThrow(ErrorServidor);
  expect(await tel.almacen.contarPendientes()).toBe(10); // nada se dio por subido
  expect(await enServidor()).toHaveLength(5); // el servidor alcanzó a guardar 5

  // Vuelve la conexión: se reenvía el lote completo.
  await modo('normal');
  expect(await vaciarCola()).toBe(10);
  expect(await tel.almacen.contarPendientes()).toBe(0);
  expect(await enServidor()).toHaveLength(10); // 10, no 15
});

it('si el servidor responde con error, los datos quedan intactos en el teléfono', async () => {
  const tel = crearTelefono(8);
  const copia = JSON.stringify(tel.gastos);
  configurarAlmacen(tel.almacen);

  await modo('error');
  await expect(vaciarCola()).rejects.toMatchObject({ estado: 500 });
  expect(JSON.stringify(tel.gastos)).toBe(copia);
  expect(obtenerEstadoSync().ultimoError?.mensaje).toContain('500');

  await modo('normal');
  expect(await vaciarCola()).toBe(8);
  expect(obtenerEstadoSync().ultimoError).toBeNull();
});

it('si el servidor no responde a tiempo, aborta y conserva los datos', async () => {
  const tel = crearTelefono(3);
  configurarAlmacen(tel.almacen);
  configurarAdaptador(crearAdaptadorHttp(url, fetchNode, 300));

  await modo('lento');
  await expect(vaciarCola()).rejects.toThrow('no respondió a tiempo');
  expect(await tel.almacen.contarPendientes()).toBe(3);
});

it('sin servidor alcanzable (modo avión) falla limpio y sincroniza al volver', async () => {
  const tel = crearTelefono(4);
  configurarAlmacen(tel.almacen);

  // Un puerto donde no escucha nadie: igual que no tener red.
  configurarAdaptador(crearAdaptadorHttp('http://127.0.0.1:1', fetchNode, 2000));
  await expect(vaciarCola()).rejects.toThrow('sin conexión');
  expect(await tel.almacen.contarPendientes()).toBe(4);

  configurarAdaptador(crearAdaptadorHttp(url, fetchNode, 2000));
  expect(await vaciarCola()).toBe(4);
});

it('un gasto editado mientras se subía queda pendiente para subir la edición', async () => {
  const tel = crearTelefono(2);
  configurarAlmacen(tel.almacen);
  const real = crearAdaptadorHttp(url, fetchNode, 2000);
  configurarAdaptador({
    async subir(lote) {
      const ids = await real.subir(lote);
      tel.gastos[0]!.editado_en = Date.now() + 1; // el usuario editó en pleno envío
      tel.gastos[0]!.monto = 9999;
      return ids;
    },
  });

  await vaciarCola();
  expect(tel.gastos[0]!.sincronizado).toBe(0);
  expect(tel.gastos[1]!.sincronizado).toBe(1);

  configurarAdaptador(real);
  await vaciarCola();
  const guardado = (await enServidor()).find((m) => m.clave === 'huella-1') as unknown as { monto: number };
  expect(guardado.monto).toBe(9999); // la edición llegó, sin duplicar
  expect(await enServidor()).toHaveLength(2);
});

it('un movimiento que el servidor rechaza no deja la cola en un ciclo infinito', async () => {
  const tel = crearTelefono(3);
  (tel.gastos[1] as { tipo: string }).tipo = 'otro'; // inválido para el servidor
  configurarAlmacen(tel.almacen);

  expect(await vaciarCola(2)).toBe(2);
  expect(tel.gastos.map((g) => g.sincronizado)).toEqual([1, 0, 1]);
});

it('no sube dos veces lo mismo si se piden dos sincronizaciones a la vez', async () => {
  const tel = crearTelefono(20);
  configurarAlmacen(tel.almacen);
  const [a, b] = await Promise.all([vaciarCola(), vaciarCola()]);
  expect(a + b).toBe(20);
  expect(await enServidor()).toHaveLength(20);
});
