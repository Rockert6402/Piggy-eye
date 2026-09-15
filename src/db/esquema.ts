/**
 * Base de datos local. Es la fuente de verdad de la app.
 *
 * Decisión de diseño (HU-06 y riesgo #3 del acta): todo gasto se escribe
 * aquí primero, con `sincronizado = 0`. La subida al backend ocurre después
 * y puede fallar sin que el usuario pierda nada. La app funciona completa
 * sin internet; la sincronización es un extra, no un requisito.
 */

import * as SQLite from 'expo-sqlite';

const NOMBRE_BD = 'piggyeye.db';
const VERSION_ESQUEMA = 2;

let instancia: SQLite.SQLiteDatabase | null = null;

/** Abre la base de datos y aplica migraciones. Idempotente. */
export async function abrirBD(): Promise<SQLite.SQLiteDatabase> {
  if (instancia) return instancia;

  const bd = await SQLite.openDatabaseAsync(NOMBRE_BD);
  await bd.execAsync('PRAGMA journal_mode = WAL;');
  await bd.execAsync('PRAGMA foreign_keys = ON;');
  await migrar(bd);
  instancia = bd;
  return bd;
}

async function migrar(bd: SQLite.SQLiteDatabase): Promise<void> {
  const fila = await bd.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const actual = fila?.user_version ?? 0;
  if (actual >= VERSION_ESQUEMA) return;

  if (actual < 1) {
    await bd.execAsync(`
      CREATE TABLE IF NOT EXISTS gastos (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        monto         REAL    NOT NULL CHECK (monto > 0),
        comercio      TEXT,
        categoria     TEXT    NOT NULL DEFAULT 'Sin categoría',
        tipo          TEXT    NOT NULL DEFAULT 'gasto'
                              CHECK (tipo IN ('gasto','ingreso')),
        origen        TEXT    NOT NULL DEFAULT 'manual'
                              CHECK (origen IN ('automatico','manual','confirmado')),
        banco         TEXT,
        nota          TEXT,
        fecha         INTEGER NOT NULL,
        creado_en     INTEGER NOT NULL,
        editado_en    INTEGER,
        regla_id      TEXT,
        texto_original TEXT,
        huella        TEXT UNIQUE,
        sincronizado  INTEGER NOT NULL DEFAULT 0
      );

      -- El dashboard siempre consulta por rango de fecha descendente.
      CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos (fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_gastos_sync  ON gastos (sincronizado)
        WHERE sincronizado = 0;

      -- HU-04: notificaciones que el parser no pudo interpretar.
      CREATE TABLE IF NOT EXISTS pendientes (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        monto_sugerido REAL,
        banco          TEXT,
        razon          TEXT,
        texto_original TEXT NOT NULL,
        fecha          INTEGER NOT NULL,
        resuelto       INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_pendientes_abiertos
        ON pendientes (resuelto, fecha DESC);

      -- Bitácora de diagnóstico: sirve para afinar los patrones por banco.
      -- Se poda sola para no crecer sin límite.
      CREATE TABLE IF NOT EXISTS diagnostico (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        paquete  TEXT,
        titulo   TEXT,
        texto    TEXT,
        veredicto TEXT,
        motivo   TEXT,
        fecha    INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_diag_fecha ON diagnostico (fecha DESC);
    `);
  }

  if (actual < 2) {
    await bd.execAsync(`
      CREATE TABLE IF NOT EXISTS presupuestos (
        categoria  TEXT    PRIMARY KEY,
        limite     REAL    NOT NULL CHECK (limite > 0),
        creado_en  INTEGER NOT NULL,
        editado_en INTEGER
      );
    `);
  }

  await bd.execAsync(`PRAGMA user_version = ${VERSION_ESQUEMA}`);
}

/**
 * Huella de deduplicación.
 *
 * Android reenvía la misma notificación cuando la app del banco la actualiza,
 * y sin esto un solo gasto se registraría dos o tres veces. Combinamos monto,
 * comercio y una ventana de tiempo de 2 minutos: dos compras idénticas en el
 * mismo comercio dentro de ese rango son, casi siempre, la misma.
 *
 * El costo es que dos compras reales iguales seguidas se cuentan como una.
 * Es el intercambio correcto: un gasto de menos es más fácil de notar y
 * corregir a mano que un duplicado silencioso inflando el total del mes.
 */
export function calcularHuella(
  monto: number,
  comercio: string | null,
  fecha: number
): string {
  const ventana = Math.floor(fecha / 120_000);
  const lugar = (comercio || 'sin-comercio').toLowerCase().replace(/\s+/g, '');
  return `${monto}|${lugar}|${ventana}`;
}

/** Solo para pruebas: cierra y olvida la instancia. */
export async function cerrarBD(): Promise<void> {
  await instancia?.closeAsync();
  instancia = null;
}
