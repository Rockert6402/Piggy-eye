/**
 * Generador mínimo de archivos .xlsx (Office Open XML).
 *
 * Un .xlsx es un ZIP con unos cuantos XML. Escribirlo a mano permite dar
 * formato (negritas, colores, moneda, fechas reales, filtros, paneles
 * fijos) con una sola dependencia pequeña y en JavaScript puro: fflate.
 *
 * Solo implementa lo que usa el extracto. Los estilos están predefinidos
 * en `ESTILO`; cada celda elige uno por nombre.
 */

import { strToU8, zipSync } from 'fflate';

// ─── Estilos ────────────────────────────────────────────────────────────

/** Índices en <cellXfs>. El orden debe coincidir con XFS más abajo. */
export const ESTILO = {
  normal: 0,
  titulo: 1,
  subtitulo: 2,
  encabezado: 3,
  fecha: 4,
  texto: 5,
  moneda: 6,
  entrada: 7,
  salida: 8,
  totalEtiqueta: 9,
  totalMoneda: 10,
  porcentaje: 11,
  etiqueta: 12,
  seccion: 13,
  textoTenue: 14,
} as const;

export type NombreEstilo = keyof typeof ESTILO;

const FMT_MONEDA = 164;
const FMT_FECHA = 165;
const FMT_PORCENTAJE = 166;

const NUM_FMTS = `<numFmts count="3">
<numFmt numFmtId="${FMT_MONEDA}" formatCode="&quot;$&quot;\\ #,##0;[Red]\\-&quot;$&quot;\\ #,##0"/>
<numFmt numFmtId="${FMT_FECHA}" formatCode="dd/mm/yyyy\\ hh:mm"/>
<numFmt numFmtId="${FMT_PORCENTAJE}" formatCode="0.0%"/>
</numFmts>`;

// 0 normal · 1 negrita · 2 título · 3 gris · 4 blanco negrita · 5 verde · 6 rojo · 7 negrita sección
const FONTS = `<fonts count="8">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="16"/><color rgb="FF0E1B1F"/><name val="Calibri"/></font>
<font><sz val="10"/><color rgb="FF5F7A80"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="FF1E7F55"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="FFB3261E"/><name val="Calibri"/></font>
<font><b/><sz val="12"/><color rgb="FF0E1B1F"/><name val="Calibri"/></font>
</fonts>`;

// Los dos primeros rellenos son obligatorios en el formato.
const FILLS = `<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF16272C"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEEF3F3"/><bgColor indexed="64"/></patternFill></fill>
</fills>`;

// 0 sin borde · 1 fino abajo · 2 doble arriba (totales)
const BORDERS = `<borders count="3">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FFD5DEE0"/></bottom><diagonal/></border>
<border><left/><right/><top style="thin"><color rgb="FF16272C"/></top><bottom style="double"><color rgb="FF16272C"/></bottom><diagonal/></border>
</borders>`;

/** Un <xf> por entrada de ESTILO, en el mismo orden. */
const XFS: string[] = [
  /* normal */ '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  /* titulo */ '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
  /* subtitulo */ '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
  /* encabezado */ '<xf numFmtId="0" fontId="4" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>',
  /* fecha */ `<xf numFmtId="${FMT_FECHA}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>`,
  /* texto */ '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>',
  /* moneda */ `<xf numFmtId="${FMT_MONEDA}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>`,
  /* entrada */ `<xf numFmtId="${FMT_MONEDA}" fontId="5" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>`,
  /* salida */ `<xf numFmtId="${FMT_MONEDA}" fontId="6" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>`,
  /* totalEtiqueta */ '<xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>',
  /* totalMoneda */ `<xf numFmtId="${FMT_MONEDA}" fontId="1" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>`,
  /* porcentaje */ `<xf numFmtId="${FMT_PORCENTAJE}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>`,
  /* etiqueta */ '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
  /* seccion */ '<xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
  /* textoTenue */ '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>',
];

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${NUM_FMTS}
${FONTS}
${FILLS}
${BORDERS}
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${XFS.length}">
${XFS.join('\n')}
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// ─── Modelo de hoja ─────────────────────────────────────────────────────

export type Celda =
  | null
  | { texto: string; estilo?: NombreEstilo }
  | { numero: number; estilo?: NombreEstilo }
  /** Fecha en ms epoch; se guarda como fecha real de Excel en hora local. */
  | { fecha: number; estilo?: NombreEstilo }
  /** Fórmula sin "=" y su valor ya calculado, para que se vea sin recalcular. */
  | { formula: string; valor: number; estilo?: NombreEstilo };

export interface Hoja {
  nombre: string;
  filas: Celda[][];
  /** Ancho de cada columna en caracteres. */
  anchos?: number[];
  /** Rangos combinados, ej. "A1:H1". */
  combinadas?: string[];
  /** Filas fijas arriba al desplazarse (cantidad). */
  filasFijas?: number;
  /** Rango con filtro automático, ej. "A9:H120". */
  filtro?: string;
  /** Alto en puntos de filas puntuales, por índice 0-based. */
  altos?: Record<number, number>;
}

/** 0 → "A", 25 → "Z", 26 → "AA". */
export function columna(indice: number): string {
  let n = indice + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function ref(fila0: number, col0: number): string {
  return `${columna(col0)}${fila0 + 1}`;
}

function escaparXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Caracteres de control prohibidos en XML 1.0 (salvo tab y saltos).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/**
 * Excel guarda fechas como días desde 1899-12-30 en hora "de pared", sin
 * zona horaria. Se corrige con el desfase local para que 14:05 en Bogotá
 * se vea 14:05 en el archivo.
 */
export function fechaExcel(ms: number): number {
  const desfase = new Date(ms).getTimezoneOffset() * 60_000;
  return (ms - desfase) / 86_400_000 + 25_569;
}

function celdaXml(c: Celda, r: string): string {
  if (c === null) return '';
  const s = ESTILO[c.estilo ?? 'normal'];
  const atrS = s ? ` s="${s}"` : '';
  if ('texto' in c) {
    return `<c r="${r}"${atrS} t="inlineStr"><is><t xml:space="preserve">${escaparXml(c.texto)}</t></is></c>`;
  }
  if ('numero' in c) {
    return `<c r="${r}"${atrS}><v>${Number.isFinite(c.numero) ? c.numero : 0}</v></c>`;
  }
  if ('fecha' in c) {
    return `<c r="${r}"${atrS}><v>${fechaExcel(c.fecha)}</v></c>`;
  }
  return `<c r="${r}"${atrS}><f>${escaparXml(c.formula)}</f><v>${c.valor}</v></c>`;
}

function hojaXml(h: Hoja): string {
  const ancho = Math.max(1, ...h.filas.map((f) => f.length));
  const dimension = `A1:${ref(Math.max(0, h.filas.length - 1), ancho - 1)}`;

  const vista = h.filasFijas
    ? `<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${h.filasFijas}" topLeftCell="A${h.filasFijas + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${h.filasFijas + 1}" sqref="A${h.filasFijas + 1}"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>';

  const cols = h.anchos?.length
    ? `<cols>${h.anchos
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : '';

  const filas = h.filas
    .map((fila, i) => {
      const alto = h.altos?.[i];
      const atrAlto = alto ? ` ht="${alto}" customHeight="1"` : '';
      const celdas = fila.map((c, j) => celdaXml(c, ref(i, j))).join('');
      return `<row r="${i + 1}"${atrAlto}>${celdas}</row>`;
    })
    .join('');

  const filtro = h.filtro ? `<autoFilter ref="${h.filtro}"/>` : '';
  const combinadas = h.combinadas?.length
    ? `<mergeCells count="${h.combinadas.length}">${h.combinadas
        .map((m) => `<mergeCell ref="${m}"/>`)
        .join('')}</mergeCells>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="${dimension}"/>${vista}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${filas}</sheetData>${filtro}${combinadas}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

/** Excel limita los nombres de hoja a 31 caracteres y prohíbe : \ / ? * [ ] */
function nombreHojaValido(nombre: string): string {
  return nombre.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Hoja';
}

/** Arma el .xlsx completo en memoria. */
export function crearXlsx(hojas: Hoja[], titulo = 'Piggy Eye'): Uint8Array {
  const nombres = hojas.map((h) => nombreHojaValido(h.nombre));

  // El filtro automático de Excel necesita este nombre definido por hoja.
  const definidos = hojas
    .map((h, i) =>
      h.filtro
        ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${nombres[i]!.replace(/'/g, "''")}'!${h.filtro
            .split(':')
            .map((p) => p.replace(/([A-Z]+)(\d+)/, '$$$1$$$2'))
            .join(':')}</definedName>`
        : ''
    )
    .join('');

  const archivos: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${hojas
  .map(
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )
  .join('\n')}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`),
    'docProps/core.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${escaparXml(titulo)}</dc:title><dc:creator>Piggy Eye</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</dcterms:created>
</cp:coreProperties>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView/></bookViews>
<sheets>${nombres
      .map((n, i) => `<sheet name="${escaparXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets>
${definidos ? `<definedNames>${definidos}</definedNames>` : ''}
<calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${hojas
  .map(
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  )
  .join('\n')}
<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    'xl/styles.xml': strToU8(STYLES_XML),
  };

  hojas.forEach((h, i) => {
    archivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(hojaXml(h));
  });

  return zipSync(archivos, { level: 6 });
}
