const PDFDocument = require('pdfkit');

const BRAND_GREEN = '#0F3D2C';
const ACCENT_GREEN = '#279C5A';
const INK = '#222222';
const MUTED = '#777777';

/**
 * Genere une facture PDF pour une commande et la diffuse directement dans la
 * reponse HTTP (section 46 du cahier des charges). `order` doit inclure
 * items, address, deliveryZone, payment, customer.user.
 */
function generateInvoicePdf(order, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=facture-${order.orderNumber}.pdf`);
  doc.pipe(res);

  // En-tete
  doc.fillColor(BRAND_GREEN).fontSize(20).font('Helvetica-Bold').text('NONO SMART SARL');
  doc.fillColor(MUTED).fontSize(9).font('Helvetica').text('Essos Madison, Yaoundé — Cameroun');
  doc.text('Tél : 659 103 000 · WhatsApp : 674 331 099');

  doc.moveDown(1.5);
  doc.fillColor(INK).fontSize(16).font('Helvetica-Bold').text(`Facture ${order.orderNumber}`);
  doc.fillColor(MUTED).fontSize(9).font('Helvetica').text(`Date : ${new Date(order.createdAt).toLocaleDateString('fr-FR')}`);
  doc.text(`Statut de la commande : ${order.status}`);

  // Client
  doc.moveDown(1);
  doc.fillColor(INK).fontSize(11).font('Helvetica-Bold').text('Client');
  doc.font('Helvetica').fontSize(10);
  const customerName = order.customer ? `${order.customer.user.firstName} ${order.customer.user.lastName}` : order.guestName;
  const customerPhone = order.customer?.user?.phone || order.guestPhone;
  doc.text(customerName || '-');
  doc.text(customerPhone || '-');
  if (order.address) {
    doc.text(`${order.address.district}, ${order.address.city}`);
    if (order.address.landmark) doc.text(order.address.landmark);
  }

  // Tableau des articles
  doc.moveDown(1.2);
  const tableTop = doc.y;
  const col = { name: 50, qty: 300, unit: 370, total: 460 };

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
  doc.rect(50, tableTop, 495, 20).fill(BRAND_GREEN);
  doc.fillColor('#ffffff');
  doc.text('Produit', col.name + 5, tableTop + 6);
  doc.text('Quantité', col.qty, tableTop + 6);
  doc.text('Prix unit.', col.unit, tableTop + 6);
  doc.text('Total', col.total, tableTop + 6);

  let y = tableTop + 25;
  doc.font('Helvetica').fontSize(9).fillColor(INK);
  order.items.forEach((it, i) => {
    if (i % 2 === 1) doc.rect(50, y - 4, 495, 18).fill('#F0F3F0').fillColor(INK);
    doc.text(it.name, col.name + 5, y);
    doc.text(String(it.quantity), col.qty, y);
    doc.text(`${it.unitPrice.toLocaleString('fr-FR')} FCFA`, col.unit, y);
    doc.text(`${it.total.toLocaleString('fr-FR')} FCFA`, col.total, y);
    y += 18;
  });

  // Totaux
  y += 12;
  doc.moveTo(320, y).lineTo(545, y).strokeColor('#dddddd').stroke();
  y += 8;
  const totalLine = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10).fillColor(INK);
    doc.text(label, 320, y);
    doc.text(`${value.toLocaleString('fr-FR')} FCFA`, col.total, y);
    y += bold ? 18 : 15;
  };
  totalLine('Sous-total', order.subtotal);
  totalLine('Livraison', order.deliveryFee);
  if (order.discount > 0) totalLine('Réduction', -order.discount);
  y += 3;
  doc.fillColor(ACCENT_GREEN);
  totalLine('TOTAL', order.total, true);

  // Pied de page
  doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(
    `Mode de paiement : ${order.payment?.method || '-'}  ·  Statut du paiement : ${order.payment?.status || '-'}`,
    50,
    740,
    { width: 495, align: 'center' }
  );
  doc.text('Merci pour votre confiance — NONO SMART SARL', 50, 755, { width: 495, align: 'center' });

  doc.end();
}

module.exports = { generateInvoicePdf };
