import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import jceHeaderImage from '../assets/encabezadoJceBase64.js';
import footerImage from '../assets/pieDePaginaBase64.js';
import { buildReportWorkbookData } from './reportBuilder.js';
import {
  buildEmployeeDisciplinarySummary,
  getDisciplinaryCategoryFromLabel,
  getDisciplinaryCategoryMeta,
} from './disciplinaryRules.js';

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F4E79' },
};

const TEMPLATE_COLORS = {
  gold: 'FFE5B400',
  paleGold: 'FFFFE7A8',
  paleBlue: 'FFDDEBF7',
  paleGreen: 'FFE2F0D9',
  paleOrange: 'FFFCE4D6',
  faultRed: 'FFFF0000',
  faultOrange: 'FFFF6600',
  faultYellow: 'FFFFFF00',
  faultGreen: 'FFA9D18E',
  totalGray: 'FFD9E1F2',
  white: 'FFFFFFFF',
  black: 'FF000000',
};

const TIME_FORMAT = '[h]:mm:ss';
const PAPER_SIZE_LETTER = 1;
const INSTITUTIONAL_HEADER =
  '&L&G&R&"Aptos,Bold"&11&K00A9E0JCE-DGH-6064-2026\n' +
  '&"Aptos,Bold"&11&K4B2A14REPORTE DE ASISTENCIA\n\n' +
  '&"Aptos,Bold"&11&KD99A00DIRECCIÓN DE GESTIÓN HUMANA';
const INSTITUTIONAL_HEADER_IMAGE_BASE64 = jceHeaderImage.replace(/^data:image\/jpeg;base64,/, '');
const INSTITUTIONAL_FOOTER_IMAGE_BASE64 = footerImage.replace(/^data:image\/png;base64,/, '');
const TABLE7_DISCIPLINARY_COLUMNS = {
  tardanzas: [4, 5],
  salidasTempranas: [6, 7],
  ausencias: [8, 9],
};
const PAGE_ROW_LIMITS = {
  table1: {
    first: 33,
    continuation: 39,
  },
  table2: {
    first: 33,
    continuation: 39,
  },
  table6: {
    first: 57,
    continuation: 63,
  },
  table7: {
    first: 25,
    continuation: 32,
  },
  table8: {
    first: 25,
    continuation: 32,
  },
};

const TABLE_MARGIN_PRESETS_CM = {
  list: {
    top: 3.8,
    header: 0.8,
    left: 1.8,
    right: 1.8,
    bottom: 2.7,
    footer: 0.8,
  },
  hours: {
    top: 3.5,
    header: 0.8,
    left: 1.6,
    right: 2.1,
    bottom: 2.3,
    footer: 0.8,
  },
  eventualities: {
    top: 4.2,
    header: 0.8,
    left: 0.6,
    right: 1.3,
    bottom: 2.8,
    footer: 0.8,
  },
};

const TABLE_PRINT_PRESETS = {
  table1: {
    marginPreset: 'list',
    orientation: 'portrait',
    scale: 90,
  },
  table2: {
    marginPreset: 'list',
    orientation: 'portrait',
    scale: 98,
  },
  table6: {
    marginPreset: 'hours',
    orientation: 'portrait',
    scale: 62,
  },
  table7: {
    marginPreset: 'eventualities',
    orientation: 'landscape',
    scale: 74,
  },
  table8: {
    marginPreset: 'eventualities',
    orientation: 'landscape',
    scale: 74,
  },
};

function normalizeWorksheetName(name) {
  return name.slice(0, 31).replace(/[\\/*?:[\]]/g, ' ');
}

function cmToInches(value) {
  return Number(value || 0) / 2.54;
}

function pageMarginsFromCentimeters(presetName) {
  const preset = TABLE_MARGIN_PRESETS_CM[presetName] ?? TABLE_MARGIN_PRESETS_CM.list;

  return {
    left: cmToInches(preset.left),
    right: cmToInches(preset.right),
    top: cmToInches(preset.top),
    bottom: cmToInches(preset.bottom),
    header: cmToInches(preset.header),
    footer: cmToInches(preset.footer),
  };
}

function columnLetter(columnNumber) {
  let number = columnNumber;
  let letters = '';

  while (number > 0) {
    const remainder = (number - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    number = Math.floor((number - 1) / 26);
  }

  return letters;
}

function applyPageLayoutView(worksheet, columnCount, printPreset = 'table1') {
  const pageConfig = TABLE_PRINT_PRESETS[printPreset] ?? TABLE_PRINT_PRESETS.table1;
  worksheet.views = [
    {
      state: 'normal',
      style: 'pageLayout',
      showGridLines: false,
      zoomScale: pageConfig.scale,
    },
  ];
  worksheet.pageSetup = {
    paperSize: PAPER_SIZE_LETTER,
    orientation: pageConfig.orientation,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    scale: pageConfig.scale,
    pageOrder: 'downThenOver',
    horizontalCentered: true,
    verticalCentered: false,
    showGridLines: false,
    usePrinterDefaults: false,
    horizontalDpi: 600,
    verticalDpi: 600,
    printArea: `A1:${columnLetter(columnCount)}${worksheet.rowCount}`,
    margins: pageMarginsFromCentimeters(pageConfig.marginPreset),
  };
  worksheet.headerFooter = {
    oddHeader: INSTITUTIONAL_HEADER,
    oddFooter: '&L&G',
  };
}

function ensureWorksheetRelationshipNamespace(sheetXml) {
  if (sheetXml.includes('xmlns:r=')) return sheetXml;
  return sheetXml.replace(
    '<worksheet ',
    '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ',
  );
}

function getNextRelationshipId(relsXml) {
  const ids = Array.from(relsXml.matchAll(/Id="rId(\d+)"/g), (match) => Number(match[1]));
  return `rId${Math.max(0, ...ids) + 1}`;
}

function ensureWorksheetRelsXml(relsXml = '') {
  return (
    relsXml ||
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
  );
}

function appendRelationship(relsXml, { id, type, target }) {
  const relationship = `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`;
  return relsXml.replace('</Relationships>', `${relationship}</Relationships>`);
}

function ensureContentTypeDefault(contentTypesXml, extension, contentType) {
  if (contentTypesXml.includes(`Extension="${extension}"`)) return contentTypesXml;
  return contentTypesXml.replace(
    '</Types>',
    `<Default Extension="${extension}" ContentType="${contentType}"/></Types>`,
  );
}

function createHeaderFooterImageVml({ headerRelId, footerRelId }) {
  return `<xml xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel">
 <o:shapelayout v:ext="edit">
  <o:idmap v:ext="edit" data="1"/>
 </o:shapelayout><v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75"
  o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f">
  <v:stroke joinstyle="miter"/>
  <v:formulas>
   <v:f eqn="if lineDrawn pixelLineWidth 0"/>
   <v:f eqn="sum @0 1 0"/>
   <v:f eqn="sum 0 0 @1"/>
   <v:f eqn="prod @2 1 2"/>
   <v:f eqn="prod @3 21600 pixelWidth"/>
   <v:f eqn="prod @3 21600 pixelHeight"/>
   <v:f eqn="sum @0 0 1"/>
   <v:f eqn="prod @6 1 2"/>
   <v:f eqn="prod @7 21600 pixelWidth"/>
   <v:f eqn="sum @8 21600 0"/>
   <v:f eqn="prod @7 21600 pixelHeight"/>
   <v:f eqn="sum @10 21600 0"/>
  </v:formulas>
  <v:path o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/>
  <o:lock v:ext="edit" aspectratio="t"/>
 </v:shapetype><v:shape id="LH" o:spid="_x0000_s1025" type="#_x0000_t75"
  style='position:absolute;margin-left:0;margin-top:0;width:528.5pt;height:78pt;
  z-index:1'>
  <v:imagedata o:relid="${headerRelId}" o:title="encabezado-jce"/>
  <o:lock v:ext="edit" rotation="t"/>
 </v:shape><v:shape id="LF" o:spid="_x0000_s1026" type="#_x0000_t75"
  style='position:absolute;margin-left:0;margin-top:0;width:306.43pt;height:60.94pt;
  z-index:2'>
  <v:imagedata o:relid="${footerRelId}" o:title="pie-de-pagina"/>
  <o:lock v:ext="edit" rotation="t"/>
 </v:shape></xml>`;
}

async function addInstitutionalHeaderFooterImages(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const worksheetPaths = Object.keys(zip.files)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const contentTypesPath = '[Content_Types].xml';
  let contentTypesXml = await zip.file(contentTypesPath).async('string');
  contentTypesXml = ensureContentTypeDefault(contentTypesXml, 'jpeg', 'image/jpeg');
  contentTypesXml = ensureContentTypeDefault(contentTypesXml, 'png', 'image/png');
  contentTypesXml = ensureContentTypeDefault(
    contentTypesXml,
    'vml',
    'application/vnd.openxmlformats-officedocument.vmlDrawing',
  );
  zip.file(contentTypesPath, contentTypesXml);
  zip.file('xl/media/encabezado-jce.jpeg', INSTITUTIONAL_HEADER_IMAGE_BASE64, { base64: true });
  zip.file('xl/media/pie-de-pagina.png', INSTITUTIONAL_FOOTER_IMAGE_BASE64, { base64: true });

  let headerIndex = 1;
  for (const worksheetPath of worksheetPaths) {
    let sheetXml = await zip.file(worksheetPath).async('string');
    if (!sheetXml.includes('JCE-DGH-6064-2026') || !sheetXml.includes('&amp;L&amp;G')) {
      continue;
    }

    const sheetMatch = worksheetPath.match(/sheet(\d+)\.xml$/);
    const sheetNumber = sheetMatch?.[1] ?? String(headerIndex);
    const relsPath = `xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`;
    const vmlPath = `xl/drawings/vmlDrawingHeader${headerIndex}.vml`;
    const vmlRelsPath = `xl/drawings/_rels/vmlDrawingHeader${headerIndex}.vml.rels`;

    let relsXml = ensureWorksheetRelsXml(await zip.file(relsPath)?.async('string'));
    const legacyDrawingRelId = getNextRelationshipId(relsXml);
    relsXml = appendRelationship(relsXml, {
      id: legacyDrawingRelId,
      type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing',
      target: `../drawings/vmlDrawingHeader${headerIndex}.vml`,
    });
    zip.file(relsPath, relsXml);

    zip.file(vmlPath, createHeaderFooterImageVml({ headerRelId: 'rId1', footerRelId: 'rId2' }));
    zip.file(
      vmlRelsPath,
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/encabezado-jce.jpeg"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/pie-de-pagina.png"/>' +
        '</Relationships>',
    );

    sheetXml = ensureWorksheetRelationshipNamespace(sheetXml);
    if (sheetXml.includes('<legacyDrawingHF ')) {
      sheetXml = sheetXml.replace(
        /<legacyDrawingHF[^>]*\/>/,
        `<legacyDrawingHF r:id="${legacyDrawingRelId}"/>`,
      );
    } else {
      sheetXml = sheetXml.replace(
        '</worksheet>',
        `<legacyDrawingHF r:id="${legacyDrawingRelId}"/></worksheet>`,
      );
    }
    zip.file(worksheetPath, sheetXml);
    headerIndex += 1;
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

function addRowsToWorksheet(workbook, sheetName, rows = []) {
  const worksheet = workbook.addWorksheet(normalizeWorksheetName(sheetName), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headers = rows.length ? Object.keys(rows[0]) : ['Sin datos'];
  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.min(Math.max(String(header).length + 4, 16), 34),
  }));

  if (rows.length) worksheet.addRows(rows);
  applyDurationFormattingToTable(worksheet, headers);
  applyDisciplinaryFormattingToTable(worksheet, headers);

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      applyBorder(cell, 'FFE2E8F0');
      cell.font = {
        name: 'Aptos',
        size: 10,
        bold: cell.font?.bold ?? false,
        italic: cell.font?.italic ?? false,
        color: cell.font?.color,
      };
      if (rowNumber > 1) cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
}

function isDurationHeader(header) {
  const normalized = String(header)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  return normalized.includes('TIEMPO') && !normalized.includes('OBSERVACIONES');
}

function applyBorder(cell, color = TEMPLATE_COLORS.black) {
  cell.border = {
    top: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } },
  };
}

function fillCell(cell, argb) {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb },
  };
}

function styleRowCells(worksheet, rowNumber, fromCol, toCol, options = {}) {
  for (let col = fromCol; col <= toCol; col += 1) {
    const cell = worksheet.getCell(rowNumber, col);
    applyBorder(cell);
    if (options.fill) fillCell(cell, options.fill);
    if (options.font) cell.font = options.font;
    cell.alignment = {
      vertical: 'middle',
      horizontal: options.horizontal ?? 'center',
      wrapText: true,
    };
  }
}

function addTitleRow(worksheet, title, columnCount, rowNumber = 1) {
  worksheet.mergeCells(rowNumber, 1, rowNumber, columnCount);
  const titleCell = worksheet.getCell(rowNumber, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, italic: true, size: 11 };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  applyBorder(titleCell);
  worksheet.getRow(rowNumber).height = 18;
}

function addContinuationTitleRow(worksheet, title, columnCount, rowNumber) {
  addTitleRow(worksheet, `Continuación-${title}`, columnCount, rowNumber);
}

function addEditableTextBox(workbook, worksheet, noteText, columnCount) {
  const noteStartRow = 1;
  const noteEndRow = 3;
  worksheet.mergeCells(noteStartRow, 1, noteEndRow, columnCount);
  const noteCell = worksheet.getCell(noteStartRow, 1);
  noteCell.value =
    noteText ??
    'Cuadro de texto editable. Escribe aqui la descripcion, nota o comentario de esta tabla.';
  noteCell.font = { name: 'Aptos', size: 9 };
  noteCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  noteCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF2EAD1' },
  };
  noteCell.border = {
    top: { style: 'medium', color: { argb: 'FFD9A300' } },
    bottom: { style: 'medium', color: { argb: 'FFD9A300' } },
    left: { style: 'medium', color: { argb: 'FFD9A300' } },
    right: { style: 'medium', color: { argb: 'FFD9A300' } },
  };

  worksheet.getRow(noteStartRow).height = 24;
  worksheet.getRow(noteStartRow + 1).height = 24;
  worksheet.getRow(noteEndRow).height = 24;

  return 5;
}

function addGroupRow(worksheet, rowNumber, label, columnCount) {
  worksheet.mergeCells(rowNumber, 1, rowNumber, columnCount);
  const groupCell = worksheet.getCell(rowNumber, 1);
  groupCell.value = label || 'SIN UBICACION';
  groupCell.font = { bold: true };
  groupCell.alignment = { vertical: 'middle', horizontal: 'center' };
  fillCell(groupCell, TEMPLATE_COLORS.paleGold);
  styleRowCells(worksheet, rowNumber, 1, columnCount, {
    fill: TEMPLATE_COLORS.paleGold,
    font: { bold: true },
  });
}

function setColumns(worksheet, widths) {
  worksheet.columns = widths.map((width) => ({ width }));
}

function employeeName(employee) {
  return [employee.codigo, employee.nombre].filter(Boolean).join(' - ');
}

function collaboratorName(employee) {
  return employee.nombre || employeeName(employee);
}

function groupBy(employees, getKey) {
  const groups = new Map();
  employees.forEach((employee) => {
    const key = getKey(employee) || 'SIN UBICACION';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(employee);
  });
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function parseDuration(value = '00:00') {
  const [hours = '0', minutes = '0', seconds = '0'] = String(value).split(':');
  const totalMinutes = Number(hours) * 60 + Number(minutes) + Number(seconds) / 60;
  return Number.isFinite(totalMinutes) ? totalMinutes : 0;
}

function formatDuration(totalMinutes = 0) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function minutesToExcelDuration(totalMinutes = 0) {
  return Math.max(0, Number(totalMinutes || 0)) / 1440;
}

function hoursToExcelDuration(totalHours = 0) {
  return minutesToExcelDuration(Number(totalHours || 0) * 60);
}

function durationStringToExcelDuration(value) {
  if (typeof value !== 'string' || !/^\d+:\d{2}(:\d{2})?$/.test(value.trim())) return value;
  return minutesToExcelDuration(parseDuration(value));
}

function setDurationCell(cell, value) {
  cell.value = typeof value === 'number' ? value : durationStringToExcelDuration(value);
  cell.numFmt = TIME_FORMAT;
}

function getFaultColor(category) {
  return getDisciplinaryCategoryMeta(category).excelColor;
}

function applyFaultCategoryToCells(worksheet, rowNumber, columns, category) {
  const fill = getFaultColor(category);
  const fontColor =
    category === 'third' || category === 'second' ? TEMPLATE_COLORS.white : TEMPLATE_COLORS.black;
  columns.forEach((column) => {
    const cell = worksheet.getCell(rowNumber, column);
    fillCell(cell, fill);
    cell.font = { ...cell.font, color: { argb: fontColor } };
  });
}

function getEmployeeTable7FaultCategories(employee) {
  const hasCompleteDisciplinarySummary =
    employee.disciplina?.tardanzas?.category &&
    employee.disciplina?.salidasTempranas?.category &&
    employee.disciplina?.ausencias?.category;
  const summary = hasCompleteDisciplinarySummary
    ? employee.disciplina
    : buildEmployeeDisciplinarySummary({
      ...employee,
      tiempoTardanzaNoJustificadaMin: parseDuration(employee.tiempoTardanzaNoJustificada),
      tiempoSalidaTempranaNoJustificadaMin: parseDuration(
        employee.tiempoSalidaTempranaNoJustificada,
      ),
    });

  return {
    tardanzas: summary.tardanzas.category,
    salidasTempranas: summary.salidasTempranas.category,
    ausencias: summary.ausencias.category,
  };
}

function applyTable7FaultCategories(worksheet, rowNumber, employee) {
  const categories = getEmployeeTable7FaultCategories(employee);
  Object.entries(TABLE7_DISCIPLINARY_COLUMNS).forEach(([key, columns]) => {
    applyFaultCategoryToCells(worksheet, rowNumber, columns, categories[key]);
  });
  return categories;
}

function getCellFillArgb(cell) {
  return cell.fill?.fgColor?.argb ?? null;
}

function validateTable7FaultCoverage(worksheet, disciplinaryRows) {
  disciplinaryRows.forEach(({ rowNumber, categories }) => {
    Object.entries(TABLE7_DISCIPLINARY_COLUMNS).forEach(([key, columns]) => {
      const expectedFill = getFaultColor(categories[key]);
      columns.forEach((column) => {
        const cell = worksheet.getCell(rowNumber, column);
        if (getCellFillArgb(cell) !== expectedFill) {
          applyFaultCategoryToCells(worksheet, rowNumber, columns, categories[key]);
        }
      });
    });
  });
}

function styleTotalRow(worksheet, rowNumber, columnCount) {
  styleRowCells(worksheet, rowNumber, 1, columnCount, {
    fill: TEMPLATE_COLORS.totalGray,
    font: { name: 'Aptos', size: 10, bold: true },
    horizontal: 'center',
  });
  worksheet.getCell(rowNumber, 1).alignment = {
    vertical: 'middle',
    horizontal: 'left',
    wrapText: true,
  };
}

function applyTable6BlockFills(worksheet, rowNumber) {
  [2, 3, 4].forEach((column) => {
    fillCell(worksheet.getCell(rowNumber, column), TEMPLATE_COLORS.paleBlue);
  });
  [5, 6, 7].forEach((column) => {
    fillCell(worksheet.getCell(rowNumber, column), TEMPLATE_COLORS.paleGreen);
  });
  fillCell(worksheet.getCell(rowNumber, 8), TEMPLATE_COLORS.paleOrange);
}

function applyDurationFormattingToTable(worksheet, headers) {
  const durationColumns = headers
    .map((header, index) => ({ header, column: index + 1 }))
    .filter(({ header }) => isDurationHeader(header));

  durationColumns.forEach(({ column }) => {
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const cell = worksheet.getCell(rowNumber, column);
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        setDurationCell(cell, cell.value);
      }
    }
  });
}

function applyDisciplinaryFormattingToTable(worksheet, headers) {
  const categoryColumns = headers
    .map((header, index) => ({ header, column: index + 1 }))
    .filter(({ header }) =>
      String(header)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .includes('CATEGORIA DISCIPLINARIA'),
    );

  categoryColumns.forEach(({ column }) => {
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const cell = worksheet.getCell(rowNumber, column);
      if (!cell.value) continue;
      const category = getDisciplinaryCategoryFromLabel(cell.value);
      const meta = getDisciplinaryCategoryMeta(category);
      fillCell(cell, meta.excelColor);
      cell.font = {
        ...cell.font,
        color: {
          argb:
            category === 'third' || category === 'second'
              ? TEMPLATE_COLORS.white
              : TEMPLATE_COLORS.black,
        },
      };
    }
  });
}

function addNoDataRow(worksheet, rowNumber, columnCount) {
  worksheet.mergeCells(rowNumber, 1, rowNumber, columnCount);
  const cell = worksheet.getCell(rowNumber, 1);
  cell.value = 'Sin registros';
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  applyBorder(cell);
}

function createContinuationManager({
  worksheet,
  title,
  columnCount,
  rowLimit,
  addContinuationHeader,
  continuationHeaderRowCount = 1,
}) {
  let rowsOnPage = 0;
  let isFirstPage = true;
  const firstPageLimit = typeof rowLimit === 'number' ? rowLimit : rowLimit.first;
  const continuationPageLimit =
    typeof rowLimit === 'number' ? rowLimit : rowLimit.continuation ?? rowLimit.first;

  return {
    beforeRows(rowNumber, rowsNeeded = 1) {
      const currentPageLimit = isFirstPage ? firstPageLimit : continuationPageLimit;
      if (rowsOnPage > 0 && rowsOnPage + rowsNeeded > currentPageLimit) {
        worksheet.getRow(rowNumber - 1).addPageBreak();
        addContinuationTitleRow(worksheet, title, columnCount, rowNumber);
        addContinuationHeader(rowNumber + 1);
        rowsOnPage = 0;
        isFirstPage = false;
        return rowNumber + 1 + continuationHeaderRowCount;
      }
      return rowNumber;
    },
    addRows(count = 1) {
      rowsOnPage += count;
    },
  };
}

function addSimpleListHeader(worksheet, rowNumber, headers) {
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(rowNumber, index + 1);
    cell.value = header;
  });
  styleRowCells(worksheet, rowNumber, 1, 3, { fill: TEMPLATE_COLORS.gold });
}

function addHoursVsWorkedHeader(worksheet, rowNumber, headers) {
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(rowNumber, index + 1);
    cell.value = header;
  });
  [1].forEach((col) => fillCell(worksheet.getCell(rowNumber, col), TEMPLATE_COLORS.gold));
  applyTable6BlockFills(worksheet, rowNumber);
  styleRowCells(worksheet, rowNumber, 1, 8, { font: { bold: false } });
}

function addEventualitiesHeaderRows(worksheet, headerRow, subHeaderRow) {
  worksheet.mergeCells(headerRow, 1, subHeaderRow, 1);
  worksheet.getCell(headerRow, 1).value = 'Colaborador/a';
  worksheet.mergeCells(headerRow, 2, headerRow, 3);
  worksheet.getCell(headerRow, 2).value = 'Eventualidades Justificadas';
  worksheet.mergeCells(headerRow, 4, headerRow, 9);
  worksheet.getCell(headerRow, 4).value = 'Eventualidades no Justificadas';
  worksheet.mergeCells(headerRow, 10, subHeaderRow, 10);
  worksheet.getCell(headerRow, 10).value = 'Tiempo Total Acumulado';
  worksheet.mergeCells(headerRow, 11, subHeaderRow, 11);
  worksheet.getCell(headerRow, 11).value = 'Tiempo General Acumulado';

  const secondHeader = [
    null,
    'Total de eventualidades',
    'Tiempo Acumulado',
    'Tardanzas',
    'Acumulado',
    'Salidas tempranas',
    'Acumulado',
    'Ausencias',
    'Acumulado',
    null,
    null,
  ];
  secondHeader.forEach((header, index) => {
    if (header) worksheet.getCell(subHeaderRow, index + 1).value = header;
  });

  styleRowCells(worksheet, headerRow, 1, 11, { fill: TEMPLATE_COLORS.gold, font: { bold: true } });
  styleRowCells(worksheet, subHeaderRow, 1, 11, { fill: TEMPLATE_COLORS.gold });
  [4, 5].forEach((col) => fillCell(worksheet.getCell(subHeaderRow, col), TEMPLATE_COLORS.paleOrange));
  [6, 7].forEach((col) => fillCell(worksheet.getCell(subHeaderRow, col), TEMPLATE_COLORS.paleBlue));
  [8, 9].forEach((col) => fillCell(worksheet.getCell(subHeaderRow, col), TEMPLATE_COLORS.paleGreen));
  worksheet.getRow(headerRow).height = 22;
  worksheet.getRow(subHeaderRow).height = 38;
}

function applyTemplateSheetDefaults(worksheet) {
  worksheet.properties.defaultRowHeight = 18;
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = {
        name: 'Aptos',
        size: 10,
        bold: cell.font?.bold ?? false,
        italic: cell.font?.italic ?? false,
        color: cell.font?.color,
      };
    });
  });
}

function addSimpleListSheet(workbook, config) {
  const worksheet = workbook.addWorksheet(normalizeWorksheetName(config.sheetName));
  setColumns(worksheet, config.widths);
  const tableTitleRow = addEditableTextBox(workbook, worksheet, config.noteText, 3);
  addTitleRow(worksheet, config.title, 3, tableTitleRow);
  const headerRow = tableTitleRow + 1;

  addSimpleListHeader(worksheet, headerRow, config.headers);

  let rowNumber = headerRow + 1;
  const groups = groupBy(config.employees, (employee) => employee.ubicacion);
  let hasRows = false;
  let totalQuantity = 0;
  const pagination = createContinuationManager({
    worksheet,
    title: config.title,
    columnCount: 3,
    rowLimit: PAGE_ROW_LIMITS[config.pagePreset] ?? PAGE_ROW_LIMITS.table1,
    addContinuationHeader: (continuationHeaderRow) =>
      addSimpleListHeader(worksheet, continuationHeaderRow, config.headers),
  });

  groups.forEach(([groupName, employees]) => {
    const filtered = employees.filter(config.filter);
    if (!filtered.length) return;
    rowNumber = pagination.beforeRows(rowNumber, Math.min(2, filtered.length + 1));
    addGroupRow(worksheet, rowNumber, groupName, 3);
    rowNumber += 1;
    pagination.addRows(1);

    filtered.forEach((employee) => {
      const nextRowNumber = pagination.beforeRows(rowNumber, 1);
      if (nextRowNumber !== rowNumber) {
        rowNumber = nextRowNumber;
        addGroupRow(worksheet, rowNumber, groupName, 3);
        rowNumber += 1;
        pagination.addRows(1);
      }
      worksheet.getCell(rowNumber, 1).value = collaboratorName(employee);
      worksheet.getCell(rowNumber, 2).value = config.eventuality(employee);
      worksheet.getCell(rowNumber, 3).value = config.quantity(employee);
      totalQuantity += Number(config.quantity(employee) || 0);
      styleRowCells(worksheet, rowNumber, 1, 3, { horizontal: 'left' });
      worksheet.getCell(rowNumber, 3).alignment = { vertical: 'middle', horizontal: 'center' };
      rowNumber += 1;
      pagination.addRows(1);
      hasRows = true;
    });
  });

  if (!hasRows) {
    rowNumber = pagination.beforeRows(rowNumber, 1);
    addNoDataRow(worksheet, rowNumber, 3);
    rowNumber += 1;
    pagination.addRows(1);
  }

  rowNumber = pagination.beforeRows(rowNumber, 1);
  worksheet.getRow(rowNumber).values = ['TOTAL', '', totalQuantity];
  styleTotalRow(worksheet, rowNumber, 3);
  applyTemplateSheetDefaults(worksheet);
  applyPageLayoutView(worksheet, 3, config.pagePreset ?? 'table1');
}

function addHoursVsWorkedSheet(workbook, employees) {
  const worksheet = workbook.addWorksheet('Tabla 6 Horas y dias');
  setColumns(worksheet, [32, 14, 14, 16, 16, 16, 17, 16]);
  const tableTitleRow = addEditableTextBox(
    workbook,
    worksheet,
    'Cuadro de texto editable para explicar la relacion entre dias y horas a trabajar versus dias y horas trabajados.',
    8,
  );
  addTitleRow(
    worksheet,
    'Tabla 6. Relacion de horas y dias a trabajar vs horas y dias trabajados',
    8,
    tableTitleRow,
  );
  const headerRow = tableTitleRow + 1;

  const headers = [
    'Colaborador',
    'Dias a trabajar',
    'Dias trabajados',
    '% de dias trabajados',
    'Horas a trabajar',
    'Horas trabajadas',
    '% de horas trabajadas',
    'Tasa de Ausentismo',
  ];

  addHoursVsWorkedHeader(worksheet, headerRow, headers);

  let rowNumber = headerRow + 1;
  let hasRows = false;
  const totals = {
    diasATrabajar: 0,
    diasTrabajados: 0,
    horasEsperadas: 0,
    horasReconocidas: 0,
  };
  const pagination = createContinuationManager({
    worksheet,
    title: 'Tabla 6. Relacion de horas y dias a trabajar vs horas y dias trabajados',
    columnCount: 8,
    rowLimit: PAGE_ROW_LIMITS.table6,
    addContinuationHeader: (continuationHeaderRow) =>
      addHoursVsWorkedHeader(worksheet, continuationHeaderRow, headers),
  });

  groupBy(employees, (employee) => employee.ubicacion).forEach(([groupName, groupEmployees]) => {
    rowNumber = pagination.beforeRows(rowNumber, Math.min(2, groupEmployees.length + 1));
    addGroupRow(worksheet, rowNumber, groupName, 8);
    rowNumber += 1;
    pagination.addRows(1);

    groupEmployees.forEach((employee) => {
      const nextRowNumber = pagination.beforeRows(rowNumber, 1);
      if (nextRowNumber !== rowNumber) {
        rowNumber = nextRowNumber;
        addGroupRow(worksheet, rowNumber, groupName, 8);
        rowNumber += 1;
        pagination.addRows(1);
      }
      const dayRate = employee.diasATrabajar > 0 ? employee.diasTrabajadosCompletos / employee.diasATrabajar : 0;
      const hourRate = employee.horasEsperadas > 0 ? employee.horasReconocidas / employee.horasEsperadas : 0;
      totals.diasATrabajar += Number(employee.diasATrabajar || 0);
      totals.diasTrabajados += Number(employee.diasTrabajadosCompletos || 0);
      totals.horasEsperadas += Number(employee.horasEsperadas || 0);
      totals.horasReconocidas += Number(employee.horasReconocidas || 0);

      worksheet.getRow(rowNumber).values = [
        collaboratorName(employee),
        employee.diasATrabajar,
        employee.diasTrabajadosCompletos,
        dayRate,
        hoursToExcelDuration(employee.horasEsperadas),
        hoursToExcelDuration(employee.horasReconocidas),
        hourRate,
        employee.tasaAusentismo / 100,
      ];
      worksheet.getCell(rowNumber, 4).numFmt = '0%';
      worksheet.getCell(rowNumber, 5).numFmt = TIME_FORMAT;
      worksheet.getCell(rowNumber, 6).numFmt = TIME_FORMAT;
      worksheet.getCell(rowNumber, 7).numFmt = '0%';
      worksheet.getCell(rowNumber, 8).numFmt = '0%';
      styleRowCells(worksheet, rowNumber, 1, 8, { horizontal: 'center' });
      applyTable6BlockFills(worksheet, rowNumber);
      worksheet.getCell(rowNumber, 1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      rowNumber += 1;
      pagination.addRows(1);
      hasRows = true;
    });
  });

  if (!hasRows) {
    rowNumber = pagination.beforeRows(rowNumber, 1);
    addNoDataRow(worksheet, rowNumber, 8);
    rowNumber += 1;
    pagination.addRows(1);
  }

  const totalDayRate =
    totals.diasATrabajar > 0 ? totals.diasTrabajados / totals.diasATrabajar : 0;
  const totalHourRate =
    totals.horasEsperadas > 0 ? totals.horasReconocidas / totals.horasEsperadas : 0;
  const totalAbsenceRate =
    totals.horasEsperadas > 0 ? Math.max(0, 1 - totalHourRate) : 0;

  rowNumber = pagination.beforeRows(rowNumber, 1);
  worksheet.getRow(rowNumber).values = [
    'TOTAL',
    totals.diasATrabajar,
    totals.diasTrabajados,
    totalDayRate,
    hoursToExcelDuration(totals.horasEsperadas),
    hoursToExcelDuration(totals.horasReconocidas),
    totalHourRate,
    totalAbsenceRate,
  ];
  [4, 7, 8].forEach((column) => {
    worksheet.getCell(rowNumber, column).numFmt = '0%';
  });
  [5, 6].forEach((column) => {
    worksheet.getCell(rowNumber, column).numFmt = TIME_FORMAT;
  });
  styleTotalRow(worksheet, rowNumber, 8);
  applyTemplateSheetDefaults(worksheet);
  applyPageLayoutView(worksheet, 8, 'table6');
}

function addEventualitiesSheet(workbook, config) {
  const worksheet = workbook.addWorksheet(normalizeWorksheetName(config.sheetName));
  setColumns(worksheet, [34, 14, 15, 13, 14, 15, 14, 13, 14, 17, 17]);
  const tableTitleRow = addEditableTextBox(workbook, worksheet, config.noteText, 11);
  addTitleRow(worksheet, config.title, 11, tableTitleRow);

  const headerRow = tableTitleRow + 1;
  const subHeaderRow = tableTitleRow + 2;

  addEventualitiesHeaderRows(worksheet, headerRow, subHeaderRow);

  let rowNumber = tableTitleRow + 3;
  let hasRows = false;
  const disciplinaryRows = [];
  const filteredEmployees = config.employees.filter(config.filter);
  const totals = {
    justifiedCount: 0,
    justifiedTime: 0,
    tardanzas: 0,
    tardanzaTime: 0,
    salidas: 0,
    salidaTime: 0,
    ausencias: 0,
    ausenciaTime: 0,
    totalTime: 0,
    generalTime: 0,
  };
  const pagination = createContinuationManager({
    worksheet,
    title: config.title,
    columnCount: 11,
    rowLimit: PAGE_ROW_LIMITS[config.pagePreset] ?? PAGE_ROW_LIMITS.table7,
    continuationHeaderRowCount: 2,
    addContinuationHeader: (continuationHeaderRow) =>
      addEventualitiesHeaderRows(worksheet, continuationHeaderRow, continuationHeaderRow + 1),
  });

  groupBy(filteredEmployees, config.groupBy).forEach(([groupName, groupEmployees]) => {
    rowNumber = pagination.beforeRows(rowNumber, Math.min(2, groupEmployees.length + 1));
    addGroupRow(worksheet, rowNumber, groupName, 11);
    rowNumber += 1;
    pagination.addRows(1);

    groupEmployees.forEach((employee) => {
      const nextRowNumber = pagination.beforeRows(rowNumber, 1);
      if (nextRowNumber !== rowNumber) {
        rowNumber = nextRowNumber;
        addGroupRow(worksheet, rowNumber, groupName, 11);
        rowNumber += 1;
        pagination.addRows(1);
      }
      const justifiedCount = employee.eventualidadesJustificadas;
      const justifiedTime = parseDuration(employee.tiempoEventualidadJustificada);
      const nonJustifiedEventTime =
        parseDuration(employee.tiempoTardanzaNoJustificada) +
        parseDuration(employee.tiempoSalidaTempranaNoJustificada) +
        parseDuration(employee.tiempoAusenciaNoJustificada);
      const generalAccumulatedTime = justifiedTime + nonJustifiedEventTime;
      totals.justifiedCount += Number(justifiedCount || 0);
      totals.justifiedTime += justifiedTime;
      totals.tardanzas += Number(employee.tardanzasNoJustificadas || 0);
      totals.tardanzaTime += parseDuration(employee.tiempoTardanzaNoJustificada);
      totals.salidas += Number(employee.salidasTempranasNoJustificadas || 0);
      totals.salidaTime += parseDuration(employee.tiempoSalidaTempranaNoJustificada);
      totals.ausencias += Number(employee.ausenciasNoJustificadas || 0);
      totals.ausenciaTime += parseDuration(employee.tiempoAusenciaNoJustificada);
      totals.totalTime += nonJustifiedEventTime;
      totals.generalTime += generalAccumulatedTime;

      worksheet.getRow(rowNumber).values = [
        collaboratorName(employee),
        justifiedCount,
        minutesToExcelDuration(justifiedTime),
        employee.tardanzasNoJustificadas,
        durationStringToExcelDuration(employee.tiempoTardanzaNoJustificada),
        employee.salidasTempranasNoJustificadas,
        durationStringToExcelDuration(employee.tiempoSalidaTempranaNoJustificada),
        employee.ausenciasNoJustificadas,
        durationStringToExcelDuration(employee.tiempoAusenciaNoJustificada),
        minutesToExcelDuration(nonJustifiedEventTime),
        minutesToExcelDuration(generalAccumulatedTime),
      ];
      [3, 5, 7, 9, 10, 11].forEach((column) => {
        worksheet.getCell(rowNumber, column).numFmt = TIME_FORMAT;
      });
      styleRowCells(worksheet, rowNumber, 1, 11, { horizontal: 'center' });
      worksheet.getCell(rowNumber, 1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      if (config.applyFaultCategories) {
        disciplinaryRows.push({
          rowNumber,
          categories: applyTable7FaultCategories(worksheet, rowNumber, employee),
        });
      }

      rowNumber += 1;
      pagination.addRows(1);
      hasRows = true;
    });
  });

  if (!hasRows) {
    rowNumber = pagination.beforeRows(rowNumber, 1);
    addNoDataRow(worksheet, rowNumber, 11);
    rowNumber += 1;
    pagination.addRows(1);
  }

  rowNumber = pagination.beforeRows(rowNumber, 1);
  worksheet.getRow(rowNumber).values = [
    'TOTAL',
    totals.justifiedCount,
    minutesToExcelDuration(totals.justifiedTime),
    totals.tardanzas,
    minutesToExcelDuration(totals.tardanzaTime),
    totals.salidas,
    minutesToExcelDuration(totals.salidaTime),
    totals.ausencias,
    minutesToExcelDuration(totals.ausenciaTime),
    minutesToExcelDuration(totals.totalTime),
    minutesToExcelDuration(totals.generalTime),
  ];
  [3, 5, 7, 9, 10, 11].forEach((column) => {
    worksheet.getCell(rowNumber, column).numFmt = TIME_FORMAT;
  });
  styleTotalRow(worksheet, rowNumber, 11);
  if (config.applyFaultCategories) validateTable7FaultCoverage(worksheet, disciplinaryRows);
  applyTemplateSheetDefaults(worksheet);
  applyPageLayoutView(worksheet, 11, config.pagePreset ?? 'table7');
}

function addTemplateSheets(workbook, result) {
  const employees = result.summaryByEmployee ?? [];

  addSimpleListSheet(workbook, {
    sheetName: 'Tabla 1 Vacaciones',
    title: 'Tabla 1. Listado de vacaciones por colaborador/a',
    headers: ['Nombres y Apellidos', 'Eventualidad', 'Cantidad'],
    widths: [42, 22, 12],
    pagePreset: 'table1',
    employees,
    filter: (employee) => employee.vacaciones > 0,
    eventuality: () => 'Vacaciones',
    quantity: (employee) => employee.vacaciones,
  });

  addSimpleListSheet(workbook, {
    sheetName: 'Tabla 2 Ponchado irregular',
    title: 'Tabla 2. Listado de ponchado irregular por colaborador/a',
    headers: ['Nombres y Apellidos', 'Modo dePonchado', 'Cantidad'],
    widths: [42, 28, 12],
    pagePreset: 'table2',
    employees,
    filter: (employee) => employee.ponchesIrregulares > 0,
    eventuality: () => 'Ponche irregular',
    quantity: (employee) => employee.ponchesIrregulares,
  });

  addHoursVsWorkedSheet(workbook, employees);

  addEventualitiesSheet(workbook, {
    sheetName: 'Tabla 7 Eventualidades',
    title: 'Tabla 7. Eventualidades justificadas y no justificadas - Colaboradores/as',
    employees,
    filter: (employee) => !String(employee.tipoHorario).toLowerCase().includes('extendido'),
    groupBy: (employee) => employee.ubicacion,
    pagePreset: 'table7',
    applyFaultCategories: true,
    noteText:
      'La Tabla 7 consolida el registro de eventualidades justificadas (ausencias, permisos y licencias) y no justificadas (tardanzas, salidas anticipadas y ausencias). En el caso de las no justificadas, se incorpora una codificacion por colores que orienta sobre la posible medida disciplinaria conforme a la normativa vigente.\n\nNo obstante, su identificacion no implica la aplicacion automatica de sanciones, ya que corresponde al supervisor inmediato evaluar cada caso de manera individual y proceder segun los criterios establecidos en las Tablas 3, 4 y 5.',
  });

  addEventualitiesSheet(workbook, {
    sheetName: 'Tabla 8 Eventualidades HE',
    title: 'Tabla 8. Eventualidades justificadas y no justificadas - Horario extendido',
    employees,
    filter: (employee) => String(employee.tipoHorario).toLowerCase().includes('extendido'),
    groupBy: (employee) => employee.departamento || employee.ubicacion,
    pagePreset: 'table8',
    noteText:
      'La Tabla 8 consolida el registro de eventualidades justificadas y no justificadas del personal con horario extendido. Este cuadro es editable.',
  });
}

export async function exportAttendanceReport(result) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ReAS';
  workbook.created = new Date();

  const reportData = buildReportWorkbookData(result);
  reportData.sheets.forEach((sheet) => addRowsToWorksheet(workbook, sheet.name, sheet.rows));
  addTemplateSheets(workbook, result);

  const buffer = await workbook.xlsx.writeBuffer();
  return addInstitutionalHeaderFooterImages(buffer);
}

export function downloadArrayBuffer(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
