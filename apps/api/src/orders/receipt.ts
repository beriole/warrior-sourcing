import { DELIVERY_MODE_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@ws/contracts';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Order, OrderLine, Payment } from '../generated/prisma/client.js';

/**
 * Reçu de paiement au format PDF (ORD-05), généré côté serveur avec pdf-lib.
 *
 * Le document reprend ce qui a été payé, tel que figé sur la commande : il ne recalcule rien.
 * Polices standard uniquement (aucun fichier à embarquer) : les caractères accentués du
 * français sont couverts par l'encodage WinAnsi.
 */

export type ReceiptInput = {
  order: Order & { lines: OrderLine[] };
  payment: Payment;
  customerName: string;
};

const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.42, 0.47);
const LINE = rgb(0.85, 0.85, 0.88);
const ACCENT = rgb(0.72, 0.13, 0.13);

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

export async function buildReceiptPdf(input: ReceiptInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Reçu ${input.order.reference}`);
  pdf.setAuthor('Warrior Sourcing');
  pdf.setSubject('Reçu de paiement');
  pdf.setCreationDate(new Date());

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const writer = new Writer(page, regular, bold);

  // En-tête
  writer.text('WARRIOR SOURCING', { bold: true, size: 11, color: ACCENT });
  writer.text('Reçu de paiement', { bold: true, size: 22 });
  writer.text(`Commande ${input.order.reference}`, { size: 11, color: MUTED });
  writer.gap(10);
  writer.rule();
  writer.gap(14);

  // Références
  writer.pair('Client', input.customerName || '—');
  writer.pair('Date du paiement', formatDate(input.payment.paidAt ?? input.payment.updatedAt));
  writer.pair('Référence de paiement', input.payment.reference);
  writer.pair('Moyen de paiement', PAYMENT_METHOD_LABELS[input.payment.method]);
  writer.pair('État', PAYMENT_STATUS_LABELS[input.payment.status]);
  if (input.payment.providerRef) writer.pair('Transaction agrégateur', input.payment.providerRef);
  writer.pair('Réception', `${DELIVERY_MODE_LABELS[input.order.deliveryMode].label} — ${input.order.city}`);
  writer.gap(16);

  // Lignes
  writer.text('Détail', { bold: true, size: 12 });
  writer.gap(6);
  writer.columns(['Article', 'Quantité', 'Prix unitaire', 'Total'], { bold: true, size: 9, color: MUTED });
  writer.rule();
  for (const line of input.order.lines) {
    writer.columns([line.label, String(line.quantity), fcfa(line.unitPriceXaf), fcfa(line.lineTotalXaf)], { size: 10 });
  }
  writer.gap(8);

  // Frais
  if (input.order.kind === 'STANDARD') {
    writer.columns(['Marchandise', '', '', fcfa(input.order.subtotalXaf)], { size: 10, color: MUTED });
    writer.columns(['Fret (estimation)', '', '', fcfa(input.order.freightXaf)], { size: 10, color: MUTED });
    writer.columns(['Frais de service', '', '', fcfa(input.order.serviceFeeXaf)], { size: 10, color: MUTED });
    writer.columns(['Droits et taxes (estimation)', '', '', fcfa(input.order.customsXaf)], { size: 10, color: MUTED });
  }
  writer.rule();
  writer.columns(['Total réglé', '', '', fcfa(input.payment.amountXaf)], { bold: true, size: 12 });
  if (input.payment.refundedXaf > 0) {
    writer.columns(['Dont remboursé', '', '', fcfa(input.payment.refundedXaf)], { size: 10, color: MUTED });
  }
  writer.gap(20);

  // Mentions
  writer.text(
    'Le fret et les droits de douane ont été estimés au moment de la commande ; l’écart réel est régularisé sur justificatif.',
    { size: 8.5, color: MUTED, wrap: true },
  );
  writer.text('Aucune donnée bancaire n’est conservée par Warrior Sourcing : le paiement a été traité par l’agrégateur Mobile Money.', {
    size: 8.5,
    color: MUTED,
    wrap: true,
  });
  writer.gap(6);
  writer.text(`Document généré le ${formatDate(new Date())}.`, { size: 8.5, color: MUTED });

  return pdf.save();
}

/** Petit moteur de mise en page : une colonne de texte qui descend, quelques tableaux. */
class Writer {
  private y = PAGE_HEIGHT - MARGIN;
  private readonly width = PAGE_WIDTH - MARGIN * 2;
  /** Largeurs relatives des quatre colonnes des tableaux. */
  private readonly columnWidths = [0.5, 0.14, 0.18, 0.18];

  constructor(
    private readonly page: PDFPage,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
  ) {}

  text(value: string, options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb>; wrap?: boolean } = {}) {
    const font = options.bold ? this.bold : this.regular;
    const size = options.size ?? 10;
    const lines = options.wrap ? wrap(sanitize(value), font, size, this.width) : [sanitize(value)];
    for (const line of lines) {
      this.y -= size + 4;
      this.page.drawText(line, { x: MARGIN, y: this.y, size, font, color: options.color ?? INK });
    }
  }

  pair(label: string, value: string) {
    const size = 10;
    this.y -= size + 5;
    this.page.drawText(sanitize(label), { x: MARGIN, y: this.y, size, font: this.regular, color: MUTED });
    this.page.drawText(sanitize(value), { x: MARGIN + 170, y: this.y, size, font: this.bold, color: INK });
  }

  columns(values: string[], options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}) {
    const font = options.bold ? this.bold : this.regular;
    const size = options.size ?? 10;
    this.y -= size + 6;
    let x = MARGIN;
    values.forEach((value, index) => {
      const columnWidth = this.width * (this.columnWidths[index] ?? 0.2);
      const text = sanitize(value);
      const textWidth = font.widthOfTextAtSize(text, size);
      // Les colonnes de chiffres sont alignées à droite.
      const drawX = index === 0 ? x : x + columnWidth - textWidth;
      this.page.drawText(text, { x: drawX, y: this.y, size, font, color: options.color ?? INK });
      x += columnWidth;
    });
  }

  rule() {
    this.y -= 4;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 0.6, color: LINE });
  }

  gap(height: number) {
    this.y -= height;
  }
}

function wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = value.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Retire ce que l'encodage WinAnsi ne sait pas dessiner (flèches, emoji), sans toucher aux accents. */
function sanitize(value: string): string {
  return value.replace(/[^ -~ -ÿŒœ–—‘’“”…]/g, '');
}

function fcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/ /g, ' ')} FCFA`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Douala',
  }).format(date);
}
