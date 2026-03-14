import { jsPDF } from 'jspdf';

// ---------------------------------------------------------------------------
// Public data types
// ---------------------------------------------------------------------------

export interface ReportPDFData {
  jobNumber: string;
  jobName: string;
  date: string; // ISO date
  dayOfWeek: string;
  foremanName: string;
  weather?: string;
  comments?: string;
  laborEntries: Array<{
    employeeName: string;
    trade: string;
    stHours: number;
    otHours: number;
    equipmentNumber?: string;
    equipmentDescription?: string;
    idleStHours: number;
    idleOtHours: number;
    downStHours: number;
    downOtHours: number;
    workStHours: number;
    workOtHours: number;
    costCodeHours: Record<string, { st: number; ot: number }>;
  }>;
  costCodes: Array<{ id: string; code: string; description: string }>;
  subcontractors: Array<{
    contractorName: string;
    itemsWorked: string;
    production?: string;
  }>;
  deliveries: Array<{
    supplier: string;
    material: string;
    quantity: string;
  }>;
  diaryEntries: Array<{
    itemNumber: number;
    entryText: string;
    costCodeId?: string;
    costCodeDescription?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Layout constants (all in points – 72 pts/inch, landscape letter 792x612)
// ---------------------------------------------------------------------------

const PAGE_W = 792; // 11 inches
const PAGE_H = 612; // 8.5 inches

const MARGIN_L = 18;
const MARGIN_R = 18;
const MARGIN_T = 14;
const MARGIN_B = 14;

const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

// Header region
const HEADER_TOP = MARGIN_T;
const HEADER_H = 52;
const HEADER_BOTTOM = HEADER_TOP + HEADER_H;

// Divider between left (labor/equip) and right (subs/materials/diary)
const LEFT_FRAC = 0.62;
const LEFT_W = Math.round(CONTENT_W * LEFT_FRAC);
const RIGHT_W = CONTENT_W - LEFT_W;
const LEFT_X = MARGIN_L;
const RIGHT_X = MARGIN_L + LEFT_W;

// Body region (below header)
const BODY_TOP = HEADER_BOTTOM + 2;
const BODY_BOTTOM = PAGE_H - MARGIN_B;
const BODY_H = BODY_BOTTOM - BODY_TOP;

// Labor / Equipment grid
const LABOR_ROWS = 15;
const GRID_LABEL_H = 12; // "LABOR" / "EQUIPMENT" banner row
const GRID_HEADER_H = 40; // column headers (tall for diagonal text)
const GRID_ROW_H = 11;
const GRID_TOP = BODY_TOP;
const GRID_HEADER_TOP = GRID_TOP + GRID_LABEL_H;
const GRID_DATA_TOP = GRID_HEADER_TOP + GRID_HEADER_H;
const GRID_DATA_BOTTOM = GRID_DATA_TOP + LABOR_ROWS * GRID_ROW_H;
const GRID_FOOTER_H = 14;
const GRID_FOOTER_TOP = GRID_DATA_BOTTOM;

// Right-side sections
const RIGHT_PAD = 4;
const SUB_ROWS = 5;
const MAT_ROWS = 4;
const DIARY_ITEM_ROWS = 3;

// Max cost code columns
const MAX_COST_CODES = 7;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const yr = String(d.getFullYear()).slice(-2);
  return `${m}-${day}-${yr}`;
}

function hrs(n: number): string {
  if (!n) return '';
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function drawHatch(doc: jsPDF, x: number, y: number, w: number, h: number) {
  // Draw a single diagonal line from top-left to bottom-right of cell
  doc.setDrawColor(180);
  doc.setLineWidth(0.25);
  doc.line(x, y, x + w, y + h);
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
}

function textRight(doc: jsPDF, text: string, x: number, y: number) {
  doc.text(text, x, y, { align: 'right' });
}

function textCenter(doc: jsPDF, text: string, x: number, y: number) {
  doc.text(text, x, y, { align: 'center' });
}

function drawSTOTDiagonal(doc: jsPDF, x: number, y: number, w: number, h: number) {
  // Draw a diagonal line splitting the cell: ST upper-left, OT lower-right
  doc.setLineWidth(0.25);
  doc.line(x, y + h, x + w, y);
  doc.setLineWidth(0.5);
}

// ---------------------------------------------------------------------------
// Column definitions for the labor/equipment grid
// ---------------------------------------------------------------------------

interface ColDef {
  label: string;
  w: number;
  align?: 'left' | 'center' | 'right';
}

function buildColumns(numCostCodes: number): {
  fixedCols: ColDef[];
  costCodeW: number;
  equipMovesW: number;
  totalW: number;
} {
  // Fixed columns (before cost codes)
  const fixedCols: ColDef[] = [
    { label: 'Employee', w: 72, align: 'left' },
    { label: 'Trade', w: 32, align: 'center' },
    { label: 'ST', w: 14, align: 'right' },
    { label: 'OT', w: 14, align: 'right' },
    { label: 'Equip. #', w: 32, align: 'center' },
    { label: 'Equip.', w: 48, align: 'left' },
    { label: 'Idle', w: 18, align: 'right' },
    { label: 'Down', w: 18, align: 'right' },
    { label: 'Work', w: 18, align: 'right' },
  ];

  const fixedW = fixedCols.reduce((s, c) => s + c.w, 0);
  const equipMovesW = 38;
  const remainW = LEFT_W - fixedW - equipMovesW;
  const n = Math.max(numCostCodes, 1);
  const costCodeW = Math.max(Math.floor(remainW / n), 16);

  return {
    fixedCols,
    costCodeW,
    equipMovesW,
    totalW: fixedW + n * costCodeW + equipMovesW,
  };
}

// ---------------------------------------------------------------------------
// Main PDF generation
// ---------------------------------------------------------------------------

export function generateReportPDF(data: ReportPDFData): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'letter',
  });

  doc.setFont('helvetica');
  doc.setLineWidth(0.5);
  doc.setDrawColor(0);

  // ---- Determine cost code columns to show ----
  const activeCodes = data.costCodes.slice(0, MAX_COST_CODES);
  const numCC = Math.max(activeCodes.length, 1);
  const { fixedCols, costCodeW, equipMovesW } = buildColumns(numCC);
  const fixedW = fixedCols.reduce((s, c) => s + c.w, 0);

  // =======================================================================
  // HEADER
  // =======================================================================
  drawHeader(doc, data);

  // =======================================================================
  // LEFT HALF – LABOR & EQUIPMENT GRID
  // =======================================================================
  drawLaborGrid(doc, data, fixedCols, fixedW, costCodeW, equipMovesW, activeCodes, numCC);

  // =======================================================================
  // RIGHT HALF – SUBCONTRACTORS / MATERIALS / DIARY
  // =======================================================================
  drawRightSide(doc, data);

  // =======================================================================
  // Output
  // =======================================================================
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl as unknown as string, '_blank');
}

// ---------------------------------------------------------------------------
// Header drawing
// ---------------------------------------------------------------------------

function drawHeader(doc: jsPDF, data: ReportPDFData) {
  const dateStr = formatDate(data.date);

  // Left side – job info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');

  const row1Y = HEADER_TOP + 12;
  const row2Y = row1Y + 14;
  const row3Y = row2Y + 14;

  doc.text('JOB NO.', LEFT_X, row1Y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.jobNumber, LEFT_X + 38, row1Y);
  doc.line(LEFT_X + 37, row1Y + 2, LEFT_X + 80, row1Y + 2);

  doc.setFont('helvetica', 'bold');
  doc.text('DAY', LEFT_X + 90, row1Y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.dayOfWeek, LEFT_X + 108, row1Y);
  doc.line(LEFT_X + 107, row1Y + 2, LEFT_X + 156, row1Y + 2);

  doc.setFont('helvetica', 'bold');
  doc.text('DATE', LEFT_X + 164, row1Y);
  doc.setFont('helvetica', 'normal');
  doc.text(dateStr, LEFT_X + 186, row1Y);
  doc.line(LEFT_X + 185, row1Y + 2, LEFT_X + 240, row1Y + 2);

  // Row 2
  doc.setFont('helvetica', 'bold');
  doc.text('JOB NAME / DESCRIPTION', LEFT_X, row2Y);
  doc.setFont('helvetica', 'normal');
  const jnX = LEFT_X + 112;
  doc.text(data.jobName, jnX, row2Y);
  doc.line(jnX - 1, row2Y + 2, LEFT_X + 320, row2Y + 2);

  doc.setFont('helvetica', 'bold');
  doc.text('SUPT', LEFT_X + 328, row2Y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.foremanName, LEFT_X + 352, row2Y);
  doc.line(LEFT_X + 350, row2Y + 2, LEFT_X + 430, row2Y + 2);

  doc.setFont('helvetica', 'bold');
  doc.text('APPR', LEFT_X + 438, row2Y);
  doc.line(LEFT_X + 460, row2Y + 2, LEFT_X + 520, row2Y + 2);

  // Right side – Company branding
  const brandX = PAGE_W - MARGIN_R;
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('ECM', brandX, HEADER_TOP + 16, { align: 'right' });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Earth Construction Mining', brandX, HEADER_TOP + 24, { align: 'right' });

  doc.setFontSize(6);
  doc.text('GENERAL ENGINEERING CONTRACTOR', brandX, HEADER_TOP + 32, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text("SUPERINTENDENT'S DAILY REPORT", brandX, HEADER_TOP + 44, { align: 'right' });

  // Horizontal rule below header
  doc.setLineWidth(1);
  doc.line(MARGIN_L, HEADER_BOTTOM, PAGE_W - MARGIN_R, HEADER_BOTTOM);
  doc.setLineWidth(0.5);
}

// ---------------------------------------------------------------------------
// Labor & Equipment grid (left half)
// ---------------------------------------------------------------------------

function drawLaborGrid(
  doc: jsPDF,
  data: ReportPDFData,
  fixedCols: ColDef[],
  fixedW: number,
  costCodeW: number,
  equipMovesW: number,
  activeCodes: ReportPDFData['costCodes'],
  numCC: number,
) {
  // ---- Section banner: LABOR / EQUIPMENT ----
  const bannerY = GRID_TOP;
  doc.setFillColor(230, 230, 230);

  // "LABOR" spans employee..OT columns
  const laborBannerW = fixedCols[0].w + fixedCols[1].w + fixedCols[2].w + fixedCols[3].w;
  doc.rect(LEFT_X, bannerY, laborBannerW, GRID_LABEL_H, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  textCenter(doc, 'LABOR', LEFT_X + laborBannerW / 2, bannerY + 9);

  // "EQUIPMENT" spans Equip#..Work columns
  const equipBannerW = fixedCols[4].w + fixedCols[5].w + fixedCols[6].w + fixedCols[7].w + fixedCols[8].w;
  const equipBannerX = LEFT_X + laborBannerW;
  doc.rect(equipBannerX, bannerY, equipBannerW, GRID_LABEL_H, 'FD');
  textCenter(doc, 'EQUIPMENT', equipBannerX + equipBannerW / 2, bannerY + 9);

  // "COST CODE" spans cost-code columns
  const ccBannerX = LEFT_X + fixedW;
  const ccBannerW = numCC * costCodeW;
  doc.rect(ccBannerX, bannerY, ccBannerW, GRID_LABEL_H, 'FD');
  textCenter(doc, 'COST CODE', ccBannerX + ccBannerW / 2, bannerY + 9);

  // "EQUIP MOVES" column header banner
  const emBannerX = ccBannerX + ccBannerW;
  doc.rect(emBannerX, bannerY, equipMovesW, GRID_LABEL_H, 'FD');
  doc.setFontSize(5);
  textCenter(doc, 'EQUIP MOVES', emBannerX + equipMovesW / 2, bannerY + 5);
  textCenter(doc, 'IN / OUT', emBannerX + equipMovesW / 2, bannerY + 10);

  doc.setFont('helvetica', 'normal');

  // ---- Column headers row ----
  const headerY = GRID_HEADER_TOP;
  let cx = LEFT_X;

  // Draw header cells for fixed columns
  for (const col of fixedCols) {
    doc.rect(cx, headerY, col.w, GRID_HEADER_H);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');

    // Special handling for ST/OT label
    if (col.label === 'ST' || col.label === 'OT') {
      textCenter(doc, col.label, cx + col.w / 2, headerY + GRID_HEADER_H - 3);
    } else {
      // Wrap long labels
      const words = col.label.split(' ');
      if (words.length > 1 && col.w < 40) {
        words.forEach((w, i) => {
          textCenter(doc, w, cx + col.w / 2, headerY + GRID_HEADER_H - 8 + i * 7);
        });
      } else {
        textCenter(doc, col.label, cx + col.w / 2, headerY + GRID_HEADER_H - 3);
      }
    }
    cx += col.w;
  }

  // Draw cost code column headers with horizontal text
  for (let i = 0; i < numCC; i++) {
    const ccx = LEFT_X + fixedW + i * costCodeW;
    doc.rect(ccx, headerY, costCodeW, GRID_HEADER_H);

    if (i < activeCodes.length) {
      doc.setFontSize(4.5);
      doc.setFont('helvetica', 'bold');

      const code = activeCodes[i].code;
      const desc = activeCodes[i].description;

      // Code on top, description word-wrapped below
      textCenter(doc, code, ccx + costCodeW / 2, headerY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4);
      // Word-wrap description into lines that fit the column
      const maxChars = Math.max(Math.floor(costCodeW / 3), 6);
      const words = desc.split(' ');
      const lines: string[] = [];
      let current = '';
      for (const word of words) {
        if ((current + ' ' + word).trim().length > maxChars) {
          lines.push(current.trim());
          current = word;
        } else {
          current = current ? current + ' ' + word : word;
        }
      }
      if (current.trim()) lines.push(current.trim());

      for (let li = 0; li < Math.min(lines.length, 3); li++) {
        textCenter(doc, lines[li], ccx + costCodeW / 2, headerY + 17 + li * 6);
      }

      // ST / OT labels at the bottom of the header cell
      const halfW = costCodeW / 2;
      doc.setFontSize(4);
      doc.setFont('helvetica', 'bold');
      textCenter(doc, 'ST', ccx + halfW / 2, headerY + GRID_HEADER_H - 2);
      textCenter(doc, 'OT', ccx + halfW + halfW / 2, headerY + GRID_HEADER_H - 2);
      // Vertical divider in header matching data cells
      doc.setLineWidth(0.25);
      doc.line(ccx + halfW, headerY + GRID_HEADER_H - 8, ccx + halfW, headerY + GRID_HEADER_H);
      doc.setLineWidth(0.5);
    }
  }

  // EQUIP MOVES column header
  const emx = LEFT_X + fixedW + numCC * costCodeW;
  doc.rect(emx, headerY, equipMovesW, GRID_HEADER_H);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  textCenter(doc, 'IN/OUT', emx + equipMovesW / 2, headerY + GRID_HEADER_H - 3);

  // ---- Data rows ----
  doc.setFont('helvetica', 'normal');
  for (let row = 0; row < LABOR_ROWS; row++) {
    const ry = GRID_DATA_TOP + row * GRID_ROW_H;
    const entry = row < data.laborEntries.length ? data.laborEntries[row] : null;

    let colX = LEFT_X;
    for (let ci = 0; ci < fixedCols.length; ci++) {
      const col = fixedCols[ci];
      doc.rect(colX, ry, col.w, GRID_ROW_H);

      if (entry) {
        doc.setFontSize(5.5);
        const textY = ry + GRID_ROW_H - 3;
        const pad = 2;

        switch (ci) {
          case 0: // Employee
            doc.text(entry.employeeName.slice(0, 16), colX + pad, textY);
            break;
          case 1: // Trade
            textCenter(doc, entry.trade.slice(0, 6), colX + col.w / 2, textY);
            break;
          case 2: // ST
            if (entry.stHours) textRight(doc, hrs(entry.stHours), colX + col.w - pad, textY);
            break;
          case 3: // OT
            if (entry.otHours) textRight(doc, hrs(entry.otHours), colX + col.w - pad, textY);
            break;
          case 4: // Equip #
            if (entry.equipmentNumber) textCenter(doc, entry.equipmentNumber.slice(0, 6), colX + col.w / 2, textY);
            break;
          case 5: // Equip desc
            if (entry.equipmentDescription) doc.text(entry.equipmentDescription.slice(0, 10), colX + pad, textY);
            break;
          case 6: // Idle
            if (entry.idleStHours + entry.idleOtHours) textRight(doc, hrs(entry.idleStHours + entry.idleOtHours), colX + col.w - pad, textY);
            break;
          case 7: // Down
            if (entry.downStHours + entry.downOtHours) textRight(doc, hrs(entry.downStHours + entry.downOtHours), colX + col.w - pad, textY);
            break;
          case 8: // Work
            if (entry.workStHours + entry.workOtHours) textRight(doc, hrs(entry.workStHours + entry.workOtHours), colX + col.w - pad, textY);
            break;
        }
      }
      colX += col.w;
    }

    // Cost code cells — ST left, OT right with vertical divider
    for (let i = 0; i < numCC; i++) {
      const ccx = LEFT_X + fixedW + i * costCodeW;
      doc.rect(ccx, ry, costCodeW, GRID_ROW_H);

      if (entry && i < activeCodes.length) {
        const ccId = activeCodes[i].id;
        const ccHours = entry.costCodeHours[ccId];
        const halfW = costCodeW / 2;

        // Draw vertical divider line in cell
        doc.setLineWidth(0.25);
        doc.line(ccx + halfW, ry, ccx + halfW, ry + GRID_ROW_H);
        doc.setLineWidth(0.5);

        if (ccHours) {
          doc.setFontSize(5.5);
          const pad = 2;
          const textY = ry + GRID_ROW_H - 3;
          if (ccHours.st) textRight(doc, hrs(ccHours.st), ccx + halfW - pad, textY);
          if (ccHours.ot) textRight(doc, hrs(ccHours.ot), ccx + costCodeW - pad, textY);
        }
      } else if (!entry) {
        // Hatch unused rows in cost code area
        drawHatch(doc, ccx, ry, costCodeW, GRID_ROW_H);
      }
    }

    // EQUIP MOVES cell
    const emCellX = LEFT_X + fixedW + numCC * costCodeW;
    doc.rect(emCellX, ry, equipMovesW, GRID_ROW_H);
    if (!entry) {
      drawHatch(doc, emCellX, ry, equipMovesW, GRID_ROW_H);
    }
  }

  // ---- Grid footer ----
  drawGridFooter(doc, fixedW, numCC, costCodeW, equipMovesW);

  // ---- Vertical divider between left and right halves ----
  doc.setLineWidth(0.75);
  doc.line(RIGHT_X, BODY_TOP, RIGHT_X, BODY_BOTTOM);
  doc.setLineWidth(0.5);
}

// ---------------------------------------------------------------------------
// Grid footer (Inspector, Rental, Owner Rep)
// ---------------------------------------------------------------------------

function drawGridFooter(
  doc: jsPDF,
  _fixedW: number,
  _numCC: number,
  _costCodeW: number,
  _equipMovesW: number,
) {
  const fy = GRID_FOOTER_TOP;
  doc.rect(LEFT_X, fy, LEFT_W, GRID_FOOTER_H);

  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');

  // Inspector
  doc.text('Inspector', LEFT_X + 4, fy + 10);
  doc.line(LEFT_X + 40, fy + 11, LEFT_X + 130, fy + 11);

  // Rental / Equip labels
  const midX = LEFT_X + LEFT_W / 2;
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  doc.text('\u2020 Rental Co.', midX - 30, fy + 6);
  doc.text('Equip. \u2020', midX - 30, fy + 12);

  // Owner Representative
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  const orLabelX = LEFT_X + LEFT_W - 160;
  doc.text('Owner Representative', orLabelX, fy + 10);
  doc.line(orLabelX + 82, fy + 11, LEFT_X + LEFT_W - 4, fy + 11);
}

// ---------------------------------------------------------------------------
// Right side: Subcontractors, Materials, Job Diary
// ---------------------------------------------------------------------------

function drawRightSide(doc: jsPDF, data: ReportPDFData) {
  const rx = RIGHT_X + RIGHT_PAD;
  const rw = RIGHT_W - RIGHT_PAD * 2;

  // Divide the right side into three vertical sections
  const sectionGap = 4;

  // Calculate section heights proportionally
  const subHeaderH = 10;
  const subRowH = 10;
  const subH = subHeaderH + (SUB_ROWS + 1) * subRowH; // +1 for column header row

  const matHeaderH = 10;
  const matRowH = 10;
  const matH = matHeaderH + (MAT_ROWS + 1) * matRowH; // +1 for column header row

  const diaryTop = BODY_TOP + subH + sectionGap + matH + sectionGap;
  const diaryH = BODY_BOTTOM - diaryTop - 18; // 18 for weather row at bottom

  // =====  SUBCONTRACTORS WORKING ON JOB  =====
  let sy = BODY_TOP;
  doc.setFillColor(230, 230, 230);
  doc.rect(rx, sy, rw, subHeaderH, 'FD');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  textCenter(doc, 'SUBCONTRACTORS WORKING ON JOB', rx + rw / 2, sy + 7.5);

  sy += subHeaderH;

  // Sub-column headers
  const subCols = [
    { label: 'Contractor', w: rw * 0.35 },
    { label: 'Items Worked', w: rw * 0.45 },
    { label: 'Production', w: rw * 0.20 },
  ];

  let scx = rx;
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  for (const sc of subCols) {
    doc.rect(scx, sy, sc.w, subRowH);
    textCenter(doc, sc.label, scx + sc.w / 2, sy + 7);
    scx += sc.w;
  }
  sy += subRowH;

  // Sub data rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  for (let i = 0; i < SUB_ROWS; i++) {
    const sub = i < data.subcontractors.length ? data.subcontractors[i] : null;
    scx = rx;
    for (let ci = 0; ci < subCols.length; ci++) {
      const sc = subCols[ci];
      doc.rect(scx, sy, sc.w, subRowH);
      if (sub) {
        const pad = 2;
        const ty = sy + 7;
        switch (ci) {
          case 0:
            doc.text(sub.contractorName.slice(0, 18), scx + pad, ty);
            break;
          case 1:
            doc.text(sub.itemsWorked.slice(0, 28), scx + pad, ty);
            break;
          case 2:
            if (sub.production) doc.text(sub.production.slice(0, 10), scx + pad, ty);
            break;
        }
      }
      scx += sc.w;
    }
    sy += subRowH;
  }

  // =====  MATERIALS DELIVERED  =====
  let my = sy + sectionGap;
  doc.setFillColor(230, 230, 230);
  doc.rect(rx, my, rw, matHeaderH, 'FD');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  textCenter(doc, 'MATERIALS DELIVERED', rx + rw / 2, my + 7.5);
  my += matHeaderH;

  const matCols = [
    { label: 'Supplier', w: rw * 0.35 },
    { label: 'Material', w: rw * 0.40 },
    { label: 'Quantity', w: rw * 0.25 },
  ];

  let mcx = rx;
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  for (const mc of matCols) {
    doc.rect(mcx, my, mc.w, matRowH);
    textCenter(doc, mc.label, mcx + mc.w / 2, my + 7);
    mcx += mc.w;
  }
  my += matRowH;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  for (let i = 0; i < MAT_ROWS; i++) {
    const del = i < data.deliveries.length ? data.deliveries[i] : null;
    mcx = rx;
    for (let ci = 0; ci < matCols.length; ci++) {
      const mc = matCols[ci];
      doc.rect(mcx, my, mc.w, matRowH);
      if (del) {
        const pad = 2;
        const ty = my + 7;
        switch (ci) {
          case 0:
            doc.text(del.supplier.slice(0, 18), mcx + pad, ty);
            break;
          case 1:
            doc.text(del.material.slice(0, 22), mcx + pad, ty);
            break;
          case 2:
            doc.text(del.quantity.slice(0, 10), mcx + pad, ty);
            break;
        }
      }
      mcx += mc.w;
    }
    my += matRowH;
  }

  // =====  JOB DIARY  =====
  const dy = diaryTop;
  doc.setFillColor(230, 230, 230);
  doc.rect(rx, dy, rw, matHeaderH, 'FD');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  textCenter(doc, 'JOB DIARY', rx + rw / 2, dy + 7.5);

  let diy = dy + matHeaderH;

  // Diary item rows with boxes: Item | Production (3 rows)
  const diaryItemH = 14;
  const itemColW = rw * 0.60;
  const prodColW = rw * 0.40;

  // Diary column headers
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.rect(rx, diy, itemColW, 9);
  textCenter(doc, 'Item', rx + itemColW / 2, diy + 6.5);
  doc.rect(rx + itemColW, diy, prodColW, 9);
  textCenter(doc, 'Production', rx + itemColW + prodColW / 2, diy + 6.5);
  diy += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  for (let i = 0; i < DIARY_ITEM_ROWS; i++) {
    const de = i < data.diaryEntries.length ? data.diaryEntries[i] : null;
    doc.rect(rx, diy, itemColW, diaryItemH);
    doc.rect(rx + itemColW, diy, prodColW, diaryItemH);

    if (de) {
      const pad = 2;
      const ty = diy + 6;
      // Item number + text (wrap to two lines if needed)
      const itemText = `${de.itemNumber}. ${de.entryText}`;
      const line1 = itemText.slice(0, 38);
      const line2 = itemText.length > 38 ? itemText.slice(38, 76) : '';
      doc.text(line1, rx + pad, ty);
      if (line2) doc.text(line2, rx + pad, ty + 6);

      // Cost code description in production column
      if (de.costCodeDescription) {
        doc.text(de.costCodeDescription.slice(0, 20), rx + itemColW + pad, ty);
      }
    }
    diy += diaryItemH;
  }

  // Free-form notes area
  const notesTop = diy;
  const notesH = diaryTop + diaryH - notesTop;
  doc.rect(rx, notesTop, rw, notesH);

  // Fill in comments / diary overflow
  if (data.comments) {
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    const maxCharsPerLine = 52;
    const lineH = 7;
    const lines: string[] = [];

    // Word-wrap the comments
    const words = data.comments.split(' ');
    let currentLine = '';
    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length > maxCharsPerLine) {
        lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());

    const maxLines = Math.floor((notesH - 4) / lineH);
    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      doc.text(lines[i], rx + 3, notesTop + 8 + i * lineH);
    }
  }

  // Also add remaining diary entries as text in the notes area
  if (data.diaryEntries.length > DIARY_ITEM_ROWS && !data.comments) {
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    const lineH = 7;
    let yOff = notesTop + 8;
    for (let i = DIARY_ITEM_ROWS; i < data.diaryEntries.length; i++) {
      const de = data.diaryEntries[i];
      const text = `${de.itemNumber}. ${de.entryText}`;
      doc.text(text.slice(0, 55), rx + 3, yOff);
      yOff += lineH;
      if (yOff > notesTop + notesH - 4) break;
    }
  }

  // =====  WEATHER  =====
  const weatherY = BODY_BOTTOM - 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Weather', rx, weatherY + 10);
  doc.setFont('helvetica', 'normal');
  doc.line(rx + 36, weatherY + 11, rx + rw, weatherY + 11);
  if (data.weather) {
    doc.setFontSize(7);
    doc.text(data.weather, rx + 40, weatherY + 10);
  }
}
