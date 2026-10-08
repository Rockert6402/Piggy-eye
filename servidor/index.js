/**
 * Servidor simulado de Piggy Eye (HU-06).
 *
 * Hace de "backend en la nube" para probar la sincronización sin pagar ni
 * configurar un servicio real. Corre en el PC del equipo:
 *
 *     npm run servidor
 *
 * y la app del teléfono le envía los movimientos por Wi-Fi. Al poner el
 * teléfono en modo avión la conexión se corta de verdad, que es justo lo
 * que hay que probar.
 *
 * Sin dependencias: solo módulos de Node. Guarda en servidor/datos.json
 * para que los datos sobrevivan a un reinicio.
 *
 * Endpoints:
 *   GET  /                    Página para ver lo recibido y cambiar el modo.
 *   GET  /salud               { ok, modo, total }
 *   POST /api/movimientos     Recibe un lote. Guarda por `clave` (sin duplicados).
 *   GET  /api/movimientos     Lista todo lo guardado.
 *   POST /api/reiniciar       Borra todo.
 *   POST /control             Cambia el modo de falla: { "modo": "..." }
 *
 * Modos, para probar los criterios de manejo de errores:
 *   normal   Responde bien.
 *   error    Responde 500 a todo lote: la app debe conservar sus datos.
 *   lento    Tarda 20 s en responder: la app debe abortar por tiempo.
 *   cortar   Guarda la mitad del lote y corta la conexión sin responder,
 *            como si se cayera el internet a mitad de la sincronización.
 *            Al reintentar no deben quedar duplicados.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PUERTO = Number(process.env.PUERTO || process.env.PORT || 3001);
const ARCHIVO = process.env.DATOS || path.join(__dirname, 'datos.json');
const MODOS = ['normal', 'error', 'lento', 'cortar'];
const LIMITE_CUERPO = 5 * 1024 * 1024; // 5 MB por petición

// ─── Almacenamiento ─────────────────────────────────────────────────────

/** clave → movimiento. Un Map hace el upsert O(1) y garantiza unicidad. */
let movimientos = new Map();
let modo = MODOS.includes(process.env.MODO) ? process.env.MODO : 'normal';
let lotesRecibidos = 0;

function cargar() {
  try {
    const datos = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'));
    movimientos = new Map(datos.map((m) => [m.clave, m]));
  } catch {
    movimientos = new Map();
  }
}

function guardar() {
  // Escritura atómica: se escribe a un temporal y se renombra, para que un
  // Ctrl+C a mitad no deje el JSON corrupto.
  const tmp = `${ARCHIVO}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify([...movimientos.values()], null, 2));
  fs.renameSync(tmp, ARCHIVO);
}

// ─── Validación ─────────────────────────────────────────────────────────

const CAMPOS_TEXTO = ['comercio', 'categoria', 'banco', 'nota', 'origen'];

/** Devuelve el movimiento limpio o un texto con el error. */
function validar(m) {
  if (!m || typeof m !== 'object') return 'no es un objeto';
  if (typeof m.clave !== 'string' || !m.clave || m.clave.length > 200) return 'clave inválida';
  if (typeof m.monto !== 'number' || !Number.isFinite(m.monto) || m.monto <= 0) return 'monto inválido';
  if (m.tipo !== 'gasto' && m.tipo !== 'ingreso') return 'tipo inválido';
  if (typeof m.fecha !== 'number' || !Number.isFinite(m.fecha)) return 'fecha inválida';
  const limpio = { clave: m.clave, monto: m.monto, tipo: m.tipo, fecha: m.fecha };
  for (const c of CAMPOS_TEXTO) {
    limpio[c] = typeof m[c] === 'string' ? m[c].slice(0, 500) : null;
  }
  limpio.editado_en = typeof m.editado_en === 'number' ? m.editado_en : null;
  return limpio;
}

// ─── Utilidades HTTP ────────────────────────────────────────────────────

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let tam = 0;
    const partes = [];
    req.on('data', (c) => {
      tam += c.length;
      if (tam > LIMITE_CUERPO) {
        reject(Object.assign(new Error('cuerpo demasiado grande'), { estado: 413 }));
        req.destroy();
        return;
      }
      partes.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, estado, datos) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(cuerpo),
  });
  res.end(cuerpo);
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const hora = () => new Date().toLocaleTimeString('es-CO', { hour12: false });

function log(...partes) {
  if (process.env.SILENCIO) return;
  console.log(`[${hora()}]`, ...partes);
}

function escaparHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Rutas ──────────────────────────────────────────────────────────────

async function recibirLote(req, res) {
  let cuerpo;
  try {
    cuerpo = JSON.parse(await leerCuerpo(req));
  } catch (e) {
    return json(res, e.estado || 400, { error: 'JSON inválido' });
  }
  const lote = Array.isArray(cuerpo?.movimientos) ? cuerpo.movimientos : null;
  if (!lote) return json(res, 400, { error: 'falta "movimientos"' });

  lotesRecibidos++;
  const n = lotesRecibidos;

  if (modo === 'error') {
    log(`Lote #${n}: ${lote.length} movimientos → 500 (modo error)`);
    return json(res, 500, { error: 'Error simulado del servidor' });
  }

  if (modo === 'lento') {
    log(`Lote #${n}: ${lote.length} movimientos → esperando 20 s (modo lento)`);
    await esperar(20_000);
    // Si el teléfono se cansó de esperar y cortó, no se procesa nada.
    if (req.socket.destroyed) {
      log(`Lote #${n}: el cliente se desconectó antes de la respuesta; no se guardó nada`);
      return;
    }
  }

  const guardados = [];
  const rechazados = [];
  // En modo "cortar" solo se procesa la primera mitad antes de "caerse".
  const hasta = modo === 'cortar' ? Math.ceil(lote.length / 2) : lote.length;

  let nuevos = 0;
  for (let i = 0; i < hasta; i++) {
    const m = validar(lote[i]);
    if (typeof m === 'string') {
      rechazados.push({ clave: lote[i]?.clave ?? null, motivo: m });
      continue;
    }
    if (!movimientos.has(m.clave)) nuevos++;
    // Upsert: la misma clave reemplaza, nunca duplica. Una edición en el
    // teléfono llega con la misma clave y actualiza el registro.
    movimientos.set(m.clave, { ...m, recibido_en: Date.now() });
    guardados.push(m.clave);
  }
  guardar();

  if (modo === 'cortar') {
    log(`Lote #${n}: guardé ${guardados.length} de ${lote.length} y corto la conexión (modo cortar)`);
    req.socket.destroy();
    return;
  }

  log(
    `Lote #${n}: ${lote.length} recibidos · ${nuevos} nuevos · ${guardados.length - nuevos} actualizados` +
      (rechazados.length ? ` · ${rechazados.length} rechazados` : '') +
      ` · total ${movimientos.size}`
  );
  json(res, 200, { guardados, rechazados, total: movimientos.size });
}

function pagina(res) {
  const lista = [...movimientos.values()].sort((a, b) => b.fecha - a.fecha).slice(0, 300);
  const fmt = (n) => '$ ' + Math.round(n).toLocaleString('es-CO');
  const filas = lista
    .map(
      (m) => `<tr>
<td>${escaparHtml(new Date(m.fecha).toLocaleString('es-CO'))}</td>
<td>${escaparHtml(m.comercio || m.nota || m.categoria || '—')}</td>
<td>${escaparHtml(m.categoria)}</td><td>${escaparHtml(m.banco || 'Efectivo')}</td>
<td class="n ${m.tipo}">${m.tipo === 'ingreso' ? '+' : '−'}${fmt(m.monto)}</td>
<td class="c">${escaparHtml(m.clave)}</td></tr>`
    )
    .join('');
  const botones = MODOS.map(
    (m) =>
      `<form method="post" action="/control"><input type="hidden" name="modo" value="${m}"><button ${
        m === modo ? 'class="activo"' : ''
      }>${m}</button></form>`
  ).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="4"><title>Servidor simulado · Piggy Eye</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;color:#16272C;background:#F6F9F9}
h1{font-size:20px;margin:0 0 4px}.sub{color:#5F7A80;font-size:13px;margin-bottom:16px}
.modos{display:flex;gap:6px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
button{padding:6px 12px;border:1px solid #C9D6D8;background:#fff;border-radius:6px;cursor:pointer}
button.activo{background:#16272C;color:#fff;border-color:#16272C}
table{border-collapse:collapse;width:100%;background:#fff;font-size:13px}
th{background:#16272C;color:#fff;text-align:left;padding:6px 8px}
td{padding:5px 8px;border-bottom:1px solid #E3EAEB}.n{text-align:right;white-space:nowrap}
.gasto{color:#B3261E}.ingreso{color:#1E7F55}.c{color:#8AA0A5;font-size:11px;font-family:monospace}
</style></head><body>
<h1>Servidor simulado · Piggy Eye</h1>
<div class="sub">${movimientos.size} movimientos guardados · ${lotesRecibidos} lotes recibidos · la página se actualiza sola</div>
<div class="modos"><b>Modo:</b>${botones}</div>
<table><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Medio</th><th>Monto</th><th>Clave</th></tr></thead>
<tbody>${filas || '<tr><td colspan="6">Todavía no llega nada.</td></tr>'}</tbody></table>
</body></html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

async function control(req, res) {
  const texto = await leerCuerpo(req).catch(() => '');
  let pedido = new URL(req.url, 'http://x').searchParams.get('modo');
  if (!pedido && texto) {
    try {
      pedido = JSON.parse(texto).modo;
    } catch {
      pedido = new URLSearchParams(texto).get('modo'); // formulario de la página
    }
  }
  if (!MODOS.includes(pedido)) return json(res, 400, { error: `modo debe ser uno de: ${MODOS.join(', ')}` });
  modo = pedido;
  log(`Modo cambiado a "${modo}"`);
  // Desde el navegador se vuelve a la página; desde código, JSON.
  if ((req.headers['content-type'] || '').includes('form')) {
    res.writeHead(303, { Location: '/' });
    return res.end();
  }
  json(res, 200, { modo });
}

const servidor = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && pathname === '/') return pagina(res);
    if (req.method === 'GET' && pathname === '/salud') return json(res, 200, { ok: true, modo, total: movimientos.size });
    if (req.method === 'POST' && pathname === '/api/movimientos') return await recibirLote(req, res);
    if (req.method === 'GET' && pathname === '/api/movimientos')
      return json(res, 200, { movimientos: [...movimientos.values()] });
    if (req.method === 'POST' && pathname === '/api/reiniciar') {
      movimientos.clear();
      guardar();
      log('Datos borrados');
      return json(res, 200, { ok: true });
    }
    if (pathname === '/control') return await control(req, res);
    json(res, 404, { error: 'no existe' });
  } catch (e) {
    log('Error interno:', e);
    if (!res.headersSent) json(res, 500, { error: 'error interno' });
  }
});

/** IPs de la red local, para saber qué dirección poner en el teléfono. */
function ipsLocales() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

if (require.main === module) {
  cargar();
  servidor.listen(PUERTO, '0.0.0.0', () => {
    log(`Servidor simulado escuchando en el puerto ${PUERTO} · modo "${modo}" · ${movimientos.size} guardados`);
    for (const ip of ipsLocales()) log(`  Desde el teléfono (misma Wi-Fi): http://${ip}:${PUERTO}`);
    log(`  En este PC: http://localhost:${PUERTO}`);
  });
}

module.exports = { servidor, cargar, MODOS };
