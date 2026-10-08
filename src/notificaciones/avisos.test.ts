/**
 * Si la app instalada se compiló sin el módulo nativo de notificaciones,
 * los avisos deben apagarse en silencio sin tumbar la captura de gastos.
 */

describe('avisos sin módulo nativo', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.doMock('expo-notifications', () => {
      throw new Error("Cannot find native module 'ExpoPushTokenManager'");
    });
  });

  afterEach(() => {
    jest.dontMock('expo-notifications');
    jest.restoreAllMocks();
  });

  it('importar el archivo no revienta', () => {
    expect(() => require('./avisos')).not.toThrow();
  });

  it('las funciones públicas no lanzan errores', async () => {
    const avisos = require('./avisos');
    expect(() => avisos.configurarAvisos()).not.toThrow();
    await expect(avisos.pedirPermisoAvisos()).resolves.toBe(false);
    await expect(
      avisos.avisarGastoRegistrado({ id: 1, monto: 1000, comercio: null, banco: 'Nequi', tipo: 'gasto' })
    ).resolves.toBeUndefined();
    await expect(avisos.avisarPagoSinProcesar('Nequi')).resolves.toBeUndefined();
    const dejar = avisos.escucharToquesAvisos(() => undefined);
    expect(() => dejar()).not.toThrow();
  });
});
