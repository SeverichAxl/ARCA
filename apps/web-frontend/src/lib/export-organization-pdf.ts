/**
 * Exporta el organigrama (DOM) a un PDF de una sola página.
 *
 * html2canvas y jsPDF se cargan bajo demanda para no inflar el bundle inicial.
 */

export interface ExportOrganizationPdfOptions {
  title: string;
  subtitle: string;
  fileName?: string;
}

const MAX_CANVAS_PIXELS = 10_000_000;
const JPEG_QUALITY = 0.92;

function formatStamp(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export async function exportOrganizationChartPdf(
  element: HTMLElement,
  { title, subtitle, fileName }: ExportOrganizationPdfOptions,
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const holder = document.createElement('div');
  holder.setAttribute('data-arca-org-export', 'true');
  holder.style.cssText = [
    'position: fixed',
    'left: 0',
    'top: 0',
    'z-index: -99999',
    'padding: 32px',
    'background: #070B14',
    'color: #EDF4FE',
    'font-family: Inter, ui-sans-serif, system-ui, sans-serif',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = [
    'padding-bottom: 18px',
    'margin-bottom: 22px',
    'border-bottom: 1px solid #2A3950',
  ].join(';');
  header.innerHTML = [
    `<div style="font-size:22px;font-weight:600;letter-spacing:-0.02em">${title}</div>`,
    `<div style="margin-top:5px;font-size:12px;color:#9FB0C6">${subtitle}</div>`,
  ].join('');

  const tree = element.cloneNode(true) as HTMLElement;
  tree.style.transform = 'none';
  tree.style.width = 'max-content';
  tree.style.minWidth = '0';
  tree.style.padding = '8px';

  const footer = document.createElement('div');
  footer.style.cssText = [
    'margin-top: 22px',
    'padding-top: 14px',
    'border-top: 1px solid #2A3950',
    'display: flex',
    'justify-content: space-between',
    'font-size: 10px',
    'color: #9FB0C6',
  ].join(';');
  footer.innerHTML = [
    '<span>ARCA Ltda. · Sistema de Gestión Humana</span>',
    `<span>Generado el ${formatStamp(new Date())}</span>`,
  ].join('');

  holder.append(header, tree, footer);
  document.body.appendChild(holder);

  try {
    const naturalWidth = Math.max(holder.scrollWidth, 1);
    const naturalHeight = Math.max(holder.scrollHeight, 1);
    const scale = Math.max(
      0.75,
      Math.min(2, Math.sqrt(MAX_CANVAS_PIXELS / (naturalWidth * naturalHeight))),
    );

    const canvas = await html2canvas(holder, {
      backgroundColor: '#070B14',
      scale,
      useCORS: true,
      logging: false,
      windowWidth: naturalWidth,
      windowHeight: naturalHeight,
    });

    const pageWidth = Math.round(canvas.width / scale);
    const pageHeight = Math.round(canvas.height / scale);
    const pdf = new jsPDF({
      orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
      unit: 'px',
      format: [pageWidth, pageHeight],
      hotfixes: ['px_scaling'],
    });
    pdf.setProperties({ title, subject: subtitle });
    pdf.addImage(canvas.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', 0, 0, pageWidth, pageHeight);
    pdf.save(fileName ?? `organigrama-arca-${new Date().toISOString().slice(0, 10)}.pdf`);
  } finally {
    holder.remove();
  }
}
