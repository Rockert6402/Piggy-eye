/**
 * Pruebas del parser.
 *
 * ⚠️ Los textos de abajo son SINTÉTICOS: los escribimos imitando el formato
 * que usan estos bancos, pero no fueron copiados de notificaciones reales.
 * A medida que el equipo recolecte notificaciones auténticas con la pantalla
 * de diagnóstico, hay que ir reemplazando cada caso por el texto real y
 * ajustando el patrón correspondiente en `bancos.ts`.
 *
 * Correr con: npx jest src/parser
 */

import { parsearNotificacion, type NotificacionCruda } from './index';
import { normalizarMonto } from './monto';
import { filtrar } from './filtros';
import { textoGastoRegistrado, textoPagoSinProcesar } from '../notificaciones/avisos';

const notificacion = (
  app: string,
  title: string,
  text: string
): NotificacionCruda => ({ app, title, text, time: String(Date.now()) });

describe('normalizarMonto', () => {
  const casos: Array<[string, number | null]> = [
    ['$52.900', 52900],
    ['1.234.567', 1234567],
    ['$1.234.567,89', 1234567.89],
    ["1'234.567", 1234567],
    ['COP 15.000', 15000],
    ['52900', 52900],
    ['12,50', 12.5],
    ['', null],
    ['abc', null],
    ['0', null],
    ['-5000', null],
  ];

  test.each(casos)('normaliza %s', (entrada, esperado) => {
    expect(normalizarMonto(entrada)).toBe(esperado);
  });
});

describe('filtrado de falsos positivos (HU-02)', () => {
  it('descarta notificaciones de apps que no son bancos', () => {
    const r = parsearNotificacion(
      notificacion('com.whatsapp', 'Mamá', 'Compra pan por $5.000')
    );
    expect(r.estado).toBe('descartada');
    if (r.estado === 'descartada') expect(r.motivo).toBe('paquete-desconocido');
  });

  it('descarta publicidad aunque venga del banco', () => {
    const r = parsearNotificacion(
      notificacion(
        'com.nequi.MobileApp',
        'Nequi',
        '¡Aprovecha! Descuento del 20% en tu próxima compra'
      )
    );
    expect(r.estado).toBe('descartada');
    if (r.estado === 'descartada') expect(r.motivo).toBe('ruido');
  });

  it('descarta alertas de seguridad', () => {
    const r = parsearNotificacion(
      notificacion(
        'com.todo1.mobile',
        'Bancolombia',
        'Nunca te pediremos tu clave dinámica por teléfono'
      )
    );
    expect(r.estado).toBe('descartada');
  });

  it('descarta texto del banco sin palabra de operación', () => {
    const r = parsearNotificacion(
      notificacion('com.todo1.mobile', 'Bancolombia', 'Bienvenido a la app')
    );
    expect(r.estado).toBe('descartada');
    if (r.estado === 'descartada') expect(r.motivo).toBe('sin-operacion');
  });

  it('no confunde palabras clave dentro de otras palabras', () => {
    // "sent" vive dentro de "presente" y "cargo" dentro de "encargo":
    // con búsqueda por subcadena esto pasaba como transacción.
    const r = parsearNotificacion(
      notificacion(
        'com.paypal.android.p2pmobile',
        'PayPal',
        'Te presentamos el nuevo encargo de tu cuenta'
      )
    );
    expect(r.estado).toBe('descartada');
    if (r.estado === 'descartada') expect(r.motivo).toBe('sin-operacion');
  });

  it('acepta variantes de una palabra clave al inicio de palabra', () => {
    expect(filtrar('com.todo1.mobile', 'Bancolombia', 'Tus compras de hoy: $10.000').aceptada).toBe(true);
  });

  it('no descarta por ruido cuando el término está dentro de otra palabra', () => {
    // "gana" dentro de "ganancia" no es publicidad.
    const r = filtrar('com.nequi.MobileApp', 'Nequi', 'Recibiste $50.000 de tu ganancia');
    expect(r.aceptada).toBe(true);
  });

  it('las descartadas no producen gasto ni pendiente', () => {
    const textos = [
      ['com.whatsapp', 'Juan', 'Te pagué $20.000'],
      ['com.nequi.MobileApp', 'Nequi', 'Participa en el sorteo y gana $1.000.000'],
      ['com.todo1.mobile', 'Bancolombia', 'Tu código de verificación es 123456'],
      ['com.todo1.mobile', 'Bancolombia', ''],
    ] as const;
    for (const [app, titulo, texto] of textos) {
      expect(parsearNotificacion(notificacion(app, titulo, texto)).estado).toBe('descartada');
    }
  });
});

describe('avisos al usuario (HU-01)', () => {
  it('arma el texto de confirmación con monto en pesos y comercio', () => {
    const t = textoGastoRegistrado({ monto: 25000, comercio: 'Éxito', banco: 'Bancolombia', tipo: 'gasto' });
    expect(t).toMatch(/^Se registró un gasto de \$\s?25\.000 en Éxito$/);
  });

  it('usa el banco cuando no hay comercio', () => {
    const t = textoGastoRegistrado({ monto: 8000, comercio: null, banco: 'Nequi', tipo: 'gasto' });
    expect(t).toMatch(/con Nequi$/);
  });

  it('arma el texto de fallo con el nombre del banco', () => {
    expect(textoPagoSinProcesar('Bancolombia')).toBe(
      'Detectamos un pago en Bancolombia. Toca aquí para registrarlo manualmente.'
    );
  });
});

describe('extracción de gastos (HU-01)', () => {
  it('lee una compra de Bancolombia', () => {
    const r = parsearNotificacion(
      notificacion(
        'com.todo1.mobile',
        'Bancolombia',
        'Compra por $52.900 en EXITO SAN PEDRO'
      )
    );
    expect(r.estado).toBe('gasto');
    if (r.estado === 'gasto') {
      expect(r.monto).toBe(52900);
      expect(r.comercio).toBe('EXITO SAN PEDRO');
      expect(r.tipo).toBe('gasto');
      expect(r.banco).toBe('Bancolombia');
    }
  });

  it('lee un envío de Nequi', () => {
    const r = parsearNotificacion(
      notificacion('com.nequi.MobileApp', 'Nequi', 'Enviaste $20.000 a Juan Arango.')
    );
    expect(r.estado).toBe('gasto');
    if (r.estado === 'gasto') {
      expect(r.monto).toBe(20000);
      expect(r.comercio).toBe('Juan Arango');
    }
  });

  it('distingue un ingreso de un gasto', () => {
    const r = parsearNotificacion(
      notificacion('com.nequi.MobileApp', 'Nequi', 'Recibiste $80.000 de Ana.')
    );
    expect(r.estado).toBe('gasto');
    if (r.estado === 'gasto') expect(r.tipo).toBe('ingreso');
  });

  it('lee un pago de DaviPlata', () => {
    const r = parsearNotificacion(
      notificacion('com.davivienda.daviplataapp', 'DaviPlata', 'Pagaste $10.000 a D1')
    );
    expect(r.estado).toBe('gasto');
    if (r.estado === 'gasto') expect(r.monto).toBe(10000);
  });

  it('registra un retiro sin comercio', () => {
    const r = parsearNotificacion(
      notificacion('com.todo1.mobile', 'Bancolombia', 'Retiro por $200.000 cajero')
    );
    expect(r.estado).toBe('gasto');
    if (r.estado === 'gasto') expect(r.monto).toBe(200000);
  });
});

describe('confirmación manual cuando el parser falla (HU-04)', () => {
  it('deja pendiente un formato desconocido de banco conocido', () => {
    const r = parsearNotificacion(
      notificacion(
        'com.todo1.mobile',
        'Bancolombia',
        'Movimiento registrado: débito 45.000 ref 887766'
      )
    );
    expect(r.estado).toBe('pendiente');
    if (r.estado === 'pendiente') {
      expect(r.razon).toBe('sin-regla');
      expect(r.montoSugerido).toBe(45000);
    }
  });

  it('no inventa un monto si no hay ninguno legible', () => {
    const r = parsearNotificacion(
      notificacion('com.todo1.mobile', 'Bancolombia', 'Se registró un cargo en tu cuenta')
    );
    expect(r.estado).toBe('pendiente');
    if (r.estado === 'pendiente') expect(r.montoSugerido).toBeNull();
  });
});

describe('robustez', () => {
  it('no explota con campos vacíos', () => {
    expect(() => parsearNotificacion({ app: '' })).not.toThrow();
    expect(parsearNotificacion({ app: '' }).estado).toBe('descartada');
  });

  it('prefiere bigText cuando es más completo que text', () => {
    const r = parsearNotificacion({
      app: 'com.todo1.mobile',
      title: 'Bancolombia',
      text: 'Compra por $30.000...',
      bigText: 'Compra por $30.000 en LA REBAJA CALLE 50',
      time: String(Date.now()),
    });
    expect(r.estado).toBe('gasto');
    if (r.estado === 'gasto') expect(r.comercio).toBe('LA REBAJA CALLE 50');
  });
});
