import { jsPDF } from 'jspdf';

/**
 * Generates a budget PDF for a single job, mirroring the format of the
 * original ECM Excel-based budgets while layering in light visual
 * improvements (brand color, row striping, automatic page breaks, profit
 * margin row).
 *
 * Uses jsPDF directly — no Excel/PDFKit/etc. dependency. Works offline
 * because all input data comes from local Dexie.
 */

export interface BudgetPDFData {
  jobNumber: string;
  jobName: string;
  address?: string;
  owner?: string;
  totalContract?: number;
  costCodes: Array<{
    code: string;
    description: string;
    quantity?: number;
    uom?: string;
    unitPrice?: number;
    budgetAmount?: number;
  }>;
}

// ---------------------------------------------------------------------------
// Layout constants (points; 72 pts/inch, portrait letter)
// ---------------------------------------------------------------------------

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// ECM brand brown — matches --primary in the app
const BRAND_R = 53;
const BRAND_G = 31;
const BRAND_B = 9;

// Column widths sum to CONTENT_W (= 540)
const COL_CODE_W = 55;
const COL_QTY_W = 60;
const COL_UOM_W = 40;
const COL_UP_W = 80;
const COL_AMT_W = 90;
const COL_DESC_W = CONTENT_W - COL_CODE_W - COL_QTY_W - COL_UOM_W - COL_UP_W - COL_AMT_W;

const ROW_H = 14;
const HEADER_ROW_H = 18;

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtCurrency(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtNumber(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function drawProjectHeader(doc: jsPDF, data: BudgetPDFData): number {
  // Brand color title bar
  doc.setFillColor(BRAND_R, BRAND_G, BRAND_B);
  doc.rect(MARGIN, MARGIN, CONTENT_W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ECM PROJECT BUDGET', MARGIN + 8, MARGIN + 19);
  doc.setFontSize(9);
  doc.text(`Job ${data.jobNumber}`, MARGIN + CONTENT_W - 8, MARGIN + 19, { align: 'right' });

  // Project info block
  const infoTop = MARGIN + 40;
  const labelX = MARGIN + 4;
  const valueX = MARGIN + 80;
  const lineH = 13;

  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  doc.setTextColor(80, 80, 80);
  doc.text('PROJECT', labelX, infoTop);
  doc.text('JOB NO.', labelX, infoTop + lineH);
  if (data.address) doc.text('LOCATION', labelX, infoTop + lineH * 2);
  if (data.owner) doc.text('OWNER', labelX, infoTop + lineH * 3);

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  doc.text(data.jobName, valueX, infoTop, { maxWidth: CONTENT_W - (valueX - MARGIN) - 4 });
  doc.text(data.jobNumber, valueX, infoTop + lineH);
  if (data.address) doc.text(data.address, valueX, infoTop + lineH * 2);
  if (data.owner) doc.text(data.owner, valueX, infoTop + lineH * 3);

  // Return Y for the next element
  let bottom = infoTop + lineH * 2;
  if (data.address) bottom += lineH;
  if (data.owner) bottom += lineH;
  return bottom + 12;
}

function drawTableHeader(doc: jsPDF, y: number): number {
  doc.setFillColor(BRAND_R, BRAND_G, BRAND_B);
  doc.rect(MARGIN, y, CONTENT_W, HEADER_ROW_H, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  let x = MARGIN;
  doc.text('COST CODE', x + 4, y + 12);
  x += COL_CODE_W;
  doc.text('DESCRIPTION', x + 4, y + 12);
  x += COL_DESC_W;
  doc.text('QUANTITY', x + COL_QTY_W - 4, y + 12, { align: 'right' });
  x += COL_QTY_W;
  doc.text('UOM', x + COL_UOM_W / 2, y + 12, { align: 'center' });
  x += COL_UOM_W;
  doc.text('UNIT PRICE', x + COL_UP_W - 4, y + 12, { align: 'right' });
  x += COL_UP_W;
  doc.text('AMOUNT', x + COL_AMT_W - 4, y + 12, { align: 'right' });

  return y + HEADER_ROW_H;
}

function drawRow(doc: jsPDF, y: number, idx: number, cc: BudgetPDFData['costCodes'][number]): void {
  // Striped background
  if (idx % 2 === 1) {
    doc.setFillColor(245, 243, 240);
    doc.rect(MARGIN, y, CONTENT_W, ROW_H, 'F');
  }

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  let x = MARGIN;
  doc.text(cc.code, x + 4, y + 10);
  x += COL_CODE_W;

  // Truncate description to single line; jsPDF won't wrap automatically here
  const desc = doc.splitTextToSize(cc.description, COL_DESC_W - 8)[0] || cc.description;
  doc.text(desc, x + 4, y + 10);
  x += COL_DESC_W;

  doc.text(fmtNumber(cc.quantity), x + COL_QTY_W - 4, y + 10, { align: 'right' });
  x += COL_QTY_W;

  doc.text(cc.uom || '', x + COL_UOM_W / 2, y + 10, { align: 'center' });
  x += COL_UOM_W;

  doc.text(fmtCurrency(cc.unitPrice), x + COL_UP_W - 4, y + 10, { align: 'right' });
  x += COL_UP_W;

  doc.text(fmtCurrency(cc.budgetAmount), x + COL_AMT_W - 4, y + 10, { align: 'right' });
}

function drawTableBorder(doc: jsPDF, top: number, bottom: number): void {
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.rect(MARGIN, top, CONTENT_W, bottom - top);
  // Vertical column dividers
  let x = MARGIN + COL_CODE_W;
  doc.line(x, top, x, bottom);
  x += COL_DESC_W;
  doc.line(x, top, x, bottom);
  x += COL_QTY_W;
  doc.line(x, top, x, bottom);
  x += COL_UOM_W;
  doc.line(x, top, x, bottom);
  x += COL_UP_W;
  doc.line(x, top, x, bottom);
}

function drawTotals(
  doc: jsPDF,
  y: number,
  totalCosts: number,
  totalContract: number | undefined
): number {
  const labelX = MARGIN + CONTENT_W - 200;
  const valueX = MARGIN + CONTENT_W - 8;
  let cursor = y;

  // Total Costs row
  doc.setFillColor(245, 243, 240);
  doc.rect(labelX - 8, cursor, CONTENT_W - (labelX - MARGIN) + 8, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text('TOTAL COSTS', labelX, cursor + 12);
  doc.text(fmtCurrency(totalCosts), valueX, cursor + 12, { align: 'right' });
  cursor += 18;

  if (totalContract != null) {
    // Total Contract row (brand color) — same size + font as Total Costs
    doc.setFillColor(BRAND_R, BRAND_G, BRAND_B);
    doc.rect(labelX - 8, cursor, CONTENT_W - (labelX - MARGIN) + 8, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('TOTAL CONTRACT', labelX, cursor + 12);
    doc.text(fmtCurrency(totalContract), valueX, cursor + 12, { align: 'right' });
    cursor += 18;

    // Margin row (small, grey)
    const margin = totalContract - totalCosts;
    const marginPct = totalCosts > 0 ? (margin / totalCosts) * 100 : 0;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `Margin: ${fmtCurrency(margin)} (${marginPct.toFixed(1)}%)`,
      valueX,
      cursor + 11,
      { align: 'right' }
    );
    cursor += 14;
  }

  return cursor;
}

function drawFooter(doc: jsPDF, pageNum: number, pageCount: number): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `Generated ${fmtDate(new Date())} · ECM Daily Reports`,
    MARGIN,
    PAGE_H - MARGIN / 2
  );
  doc.text(
    `Page ${pageNum} of ${pageCount}`,
    PAGE_W - MARGIN,
    PAGE_H - MARGIN / 2,
    { align: 'right' }
  );
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function generateBudgetPDF(data: BudgetPDFData): string {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });

  const totalCosts = data.costCodes.reduce((sum, cc) => sum + (cc.budgetAmount || 0), 0);

  // Page 1: project header + start of table
  let y = drawProjectHeader(doc, data);
  let tableTop = y;
  y = drawTableHeader(doc, y);
  let firstRowOnPage = true;

  const totalsHeight = data.totalContract != null ? 56 : 24;
  const footerSpace = 30;
  const bottomLimit = PAGE_H - MARGIN - footerSpace;

  data.costCodes.forEach((cc, i) => {
    // Reserve room for totals on the last row of the last page
    const isLastRow = i === data.costCodes.length - 1;
    const need = ROW_H + (isLastRow ? totalsHeight + 8 : 0);
    if (y + need > bottomLimit) {
      // Close out the table border on this page and start a new one
      drawTableBorder(doc, tableTop, y);
      doc.addPage();
      y = MARGIN;
      tableTop = y;
      y = drawTableHeader(doc, y);
      firstRowOnPage = true;
    }
    void firstRowOnPage;
    drawRow(doc, y, i, cc);
    y += ROW_H;
    firstRowOnPage = false;
  });

  // Close the final table border
  drawTableBorder(doc, tableTop, y);

  // Totals
  y = drawTotals(doc, y + 8, totalCosts, data.totalContract);

  // Footer + page numbers — needs to know total page count, so we walk pages
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    drawFooter(doc, p, pageCount);
  }

  return doc.output('bloburl').toString();
}
