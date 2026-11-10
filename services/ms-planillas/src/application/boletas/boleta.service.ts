import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import type { InternalPrincipal } from '@arca/internal-auth';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface BoletaDocument {
  bytes: Buffer;
  hashSha256: string;
  fileName: string;
}

function money(value: { toFixed(digits: number): string } | string): string {
  return typeof value === 'string' ? value : value.toFixed(2);
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

@Injectable()
export class BoletaService {
  constructor(private readonly prisma: PrismaService) {}

  async descargar(
    planillaId: string,
    empleadoId: string,
    principal: InternalPrincipal,
  ): Promise<BoletaDocument> {
    this.assertScope(empleadoId, principal);
    const detalle = await this.prisma.planillaDetalleNomina.findUnique({
      where: { planillaId_empleadoId: { planillaId, empleadoId } },
      include: { planilla: true, boleta: true },
    });
    if (!detalle) throw new NotFoundException('No se encontró la boleta solicitada.');
    if (detalle.planilla.estado !== 'CERRADA') {
      throw new ConflictException({
        code: 'PLANILLA_NO_CERRADA',
        message: 'Solo se emiten boletas definitivas de planillas cerradas.',
      });
    }

    if (detalle.boleta?.estado === 'EMITIDA') {
      return {
        bytes: Buffer.from(detalle.boleta.documento),
        hashSha256: detalle.boleta.hashSha256,
        fileName: this.fileName(detalle.planilla.periodo, detalle.nombreCompleto),
      };
    }

    const bytes = await this.renderPdf(detalle);
    const hashSha256 = createHash('sha256').update(bytes).digest('hex');
    await this.prisma.boletaNomina.upsert({
      where: { detalleId: detalle.id },
      create: {
        detalleId: detalle.id,
        empleadoId,
        periodo: detalle.planilla.periodo,
        hashSha256,
        documento: Uint8Array.from(bytes),
        firmaIncluida: true,
        emitidaPor: principal.userId,
      },
      update: {
        hashSha256,
        documento: Uint8Array.from(bytes),
        firmaIncluida: true,
        estado: 'EMITIDA',
        emitidaPor: principal.userId,
        emitidaEn: new Date(),
      },
    });
    return {
      bytes,
      hashSha256,
      fileName: this.fileName(detalle.planilla.periodo, detalle.nombreCompleto),
    };
  }

  async descargarPropia(periodo: string, principal: InternalPrincipal): Promise<BoletaDocument> {
    if (!principal.empleadoId) throw new NotFoundException('No se encontró la boleta solicitada.');
    const detalle = await this.prisma.planillaDetalleNomina.findFirst({
      where: { empleadoId: principal.empleadoId, planilla: { periodo, estado: 'CERRADA' } },
      select: { planillaId: true },
    });
    if (!detalle) throw new NotFoundException('No se encontró la boleta solicitada.');
    return this.descargar(detalle.planillaId, principal.empleadoId, principal);
  }

  async verificar(bytes: Buffer, declaredHash?: string) {
    const hashSha256 = createHash('sha256').update(bytes).digest('hex');
    const record = await this.prisma.boletaNomina.findFirst({
      where: { hashSha256, estado: 'EMITIDA' },
      select: { id: true, empleadoId: true, periodo: true, emitidaEn: true },
    });
    const coincideConHashDeclarado = declaredHash
      ? declaredHash.toLowerCase() === hashSha256
      : undefined;
    return {
      integra: record !== null && coincideConHashDeclarado !== false,
      hashSha256,
      ...(coincideConHashDeclarado === undefined ? {} : { coincideConHashDeclarado }),
      ...(record
        ? {
            boletaId: record.id,
            empleadoId: record.empleadoId,
            periodo: record.periodo,
            emitidaEn: record.emitidaEn,
          }
        : {}),
    };
  }

  private assertScope(empleadoId: string, principal: InternalPrincipal): void {
    const canReadAll = principal.permisos.includes('boleta:read_all');
    const canReadOwn =
      principal.permisos.includes('boleta:read_own') && principal.empleadoId === empleadoId;
    if (!canReadAll && !canReadOwn)
      throw new NotFoundException('No se encontró la boleta solicitada.');
  }

  private fileName(periodo: string, nombre: string): string {
    return `boleta-${safeFilePart(periodo)}-${safeFilePart(nombre)}.pdf`;
  }

  private renderPdf(detalle: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 48,
        info: { Title: 'Boleta de pago ARCA' },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text('ARCA Ltda. — Boleta de pago', { align: 'center' });
      doc.moveDown().fontSize(11).text(`Periodo: ${detalle.planilla.periodo}`);
      doc.text(`Funcionario: ${detalle.nombreCompleto}`);
      doc.text(`CI: ${detalle.ciEnmascarado ?? 'No disponible'}`);
      doc.text(`Días trabajados: ${detalle.diasTrabajados}`);
      doc.moveDown().fontSize(13).text('Haberes');
      this.row(doc, 'Haber ganado', money(detalle.haberGanado));
      this.row(doc, 'Bono de antigüedad', money(detalle.bonoAntiguedad));
      this.row(doc, 'Otros ingresos', money(detalle.otrosIngresos));
      this.row(doc, 'Total ganado', money(detalle.totalGanado), true);
      doc.moveDown().fontSize(13).text('Descuentos');
      this.row(doc, 'Aporte laboral', money(detalle.aporteLaboral));
      this.row(doc, 'Aporte nacional solidario', money(detalle.ans));
      this.row(doc, 'RC-IVA', money(detalle.rcIva));
      this.row(doc, 'Otros descuentos', money(detalle.otrosDescuentos));
      this.row(doc, 'Total descuentos', money(detalle.totalDescuentos), true);
      doc.moveDown().fontSize(14);
      this.row(doc, 'LÍQUIDO PAGABLE', money(detalle.liquidoPagable), true);

      const subsidios = detalle.subsidios as Record<string, unknown>;
      if (subsidios && Object.keys(subsidios).length > 0) {
        doc.moveDown().fontSize(13).text('Subsidios informativos');
        for (const [name, value] of Object.entries(subsidios)) this.row(doc, name, String(value));
      }

      doc.moveDown(2);
      const y = doc.y;
      doc.circle(435, y - 22, 20).stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .text('ARCA', 415, y - 27, { width: 40, align: 'center' });
      doc
        .font('Helvetica')
        .fontSize(6)
        .text('AUTORIZADO', 407, y - 18, { width: 56, align: 'center' });
      doc.moveTo(70, y).lineTo(250, y).stroke();
      doc.moveTo(345, y).lineTo(525, y).stroke();
      doc.fontSize(9).text('Firma del funcionario', 70, y + 5, { width: 180, align: 'center' });
      doc.text('Firma autorizada ARCA', 345, y + 5, { width: 180, align: 'center' });
      doc.end();
    });
  }

  private row(doc: PDFKit.PDFDocument, label: string, value: string, bold = false): void {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
    const y = doc.y;
    doc.text(label, 55, y, { width: 350 });
    doc.text(`Bs ${value}`, 410, y, { width: 120, align: 'right' });
    doc.moveDown(0.4);
  }
}
