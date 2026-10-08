/**
 * HU-06: al recuperar la conexión se reintenta solo y, si se enviaron
 * datos pendientes, aparece un aviso breve.
 */

let mockOyenteRed: ((e: { isConnected?: boolean; isInternetReachable?: boolean }) => void) | null = null;
const mockToast = jest.fn();
const mockVaciar = jest.fn();

jest.mock('expo-network', () => ({
  addNetworkStateListener: (fn: typeof mockOyenteRed) => {
    mockOyenteRed = fn;
    return { remove: () => (mockOyenteRed = null) };
  },
}));
jest.mock('../ui/toast', () => ({ mostrarToast: (m: string) => mockToast(m) }));
jest.mock('../eventos', () => ({ avisarCambioDatos: () => undefined }));
jest.mock('./cola', () => ({
  haySincronizacion: () => true,
  vaciarCola: () => mockVaciar(),
  contarSinSincronizar: async () => 0,
}));

import { iniciarSincronizacionAutomatica, textoSincronizados } from './monitor';

const esperarPromesas = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  mockToast.mockReset();
  mockVaciar.mockReset();
});

it('al volver la conexión reintenta y avisa cuántos movimientos envió', async () => {
  // Al arrancar no hay red: el intento inicial falla.
  mockVaciar.mockRejectedValueOnce(new Error('sin conexión con el servidor'));
  const detener = iniciarSincronizacionAutomatica();
  await esperarPromesas();
  expect(mockToast).not.toHaveBeenCalled();

  // Modo avión...
  mockOyenteRed!({ isConnected: false, isInternetReachable: false });
  // ...y vuelve la conexión con 3 movimientos esperando.
  mockVaciar.mockResolvedValueOnce(3);
  mockOyenteRed!({ isConnected: true, isInternetReachable: true });
  await esperarPromesas();

  expect(mockVaciar).toHaveBeenCalledTimes(2);
  expect(mockToast).toHaveBeenCalledWith('Conexión recuperada: se sincronizaron 3 movimientos');
  detener();
});

it('no avisa si al reconectar no había nada pendiente', async () => {
  mockVaciar.mockResolvedValue(0);
  const detener = iniciarSincronizacionAutomatica();
  mockOyenteRed!({ isConnected: false });
  mockOyenteRed!({ isConnected: true, isInternetReachable: true });
  await esperarPromesas();
  expect(mockToast).not.toHaveBeenCalled();
  detener();
});

it('usa singular para un solo movimiento', () => {
  expect(textoSincronizados(1)).toBe('Conexión recuperada: se sincronizó 1 movimiento');
});
