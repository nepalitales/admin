import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { KitchenBill } from "./api";

/**
 * Generates an itemized, publication-quality A4 PDF invoice from KitchenBill data.
 * Compatible with all browsers and runtimes using pure pdf-lib.
 */
export async function generateKitchenBillPdf(bill: KitchenBill): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  // Standard A4 dimensions: 595.28 x 841.89 points
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Brand Colors
  const brandRed = rgb(0.85, 0.13, 0.13); // #D92121
  const darkGray = rgb(0.12, 0.12, 0.12);
  const mediumGray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.92, 0.92, 0.92);
  const lineGray = rgb(0.82, 0.82, 0.82);

  let y = height - 50;

  // 1. Header: Brand & Invoice Meta
  page.drawText("NEPALI TALES", {
    x: 50,
    y,
    size: 22,
    font: fontBold,
    color: brandRed,
  });

  page.drawText("TAX INVOICE / RECEIPT", {
    x: width - 210,
    y,
    size: 13,
    font: fontBold,
    color: darkGray,
  });

  y -= 16;
  page.drawText("Authentic Himalayan Cloud Kitchen", {
    x: 50,
    y,
    size: 9.5,
    font: fontRegular,
    color: mediumGray,
  });

  const invoiceNumber = bill.order.invoiceNumber || bill.order.orderNumber;
  page.drawText(`Invoice #: ${invoiceNumber}`, {
    x: width - 210,
    y,
    size: 10,
    font: fontBold,
    color: darkGray,
  });

  y -= 14;
  page.drawText(
    "Metropolis Rivera, Shop No 10, Kasarvadavali, Opp to Laxmi Narayan Mandir, 400615",
    {
      x: 50,
      y,
      size: 8.5,
      font: fontRegular,
      color: mediumGray,
    },
  );

  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(bill.order.date));

  page.drawText(`Date: ${formattedDate}`, {
    x: width - 210,
    y,
    size: 9,
    font: fontRegular,
    color: mediumGray,
  });

  y -= 14;
  page.drawText("Phone: +91 7678097659 | Email: orders@nepalitales.com", {
    x: 50,
    y,
    size: 8.5,
    font: fontRegular,
    color: mediumGray,
  });

  page.drawText(`Status: ${(bill.order.status || "CONFIRMED").toUpperCase()}`, {
    x: width - 210,
    y,
    size: 9,
    font: fontBold,
    color: brandRed,
  });

  // Top Divider line
  y -= 16;
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1.5,
    color: brandRed,
  });

  // 2. Customer & Fulfillment Info Box
  y -= 25;
  const infoBoxY = y;

  // Left Column: Customer Details
  page.drawText("BILLED TO:", {
    x: 50,
    y: infoBoxY,
    size: 9,
    font: fontBold,
    color: mediumGray,
  });
  page.drawText(bill.customer.name || "Customer", {
    x: 50,
    y: infoBoxY - 14,
    size: 11,
    font: fontBold,
    color: darkGray,
  });
  page.drawText(`Phone: ${bill.customer.phone || "N/A"}`, {
    x: 50,
    y: infoBoxY - 28,
    size: 9,
    font: fontRegular,
    color: darkGray,
  });
  if (bill.customer.email) {
    page.drawText(`Email: ${bill.customer.email}`, {
      x: 50,
      y: infoBoxY - 40,
      size: 9,
      font: fontRegular,
      color: darkGray,
    });
  }

  // Right Column: Fulfillment / Delivery Details
  const isPickup = bill.order.orderType === "pickup";
  const fulfillmentX = width / 2 + 20;

  page.drawText("FULFILLMENT & DISPATCH:", {
    x: fulfillmentX,
    y: infoBoxY,
    size: 9,
    font: fontBold,
    color: mediumGray,
  });

  page.drawText(
    isPickup
      ? "Mode: Kitchen Pickup (Takeaway)"
      : "Mode: Doorstep Delivery (Mumbai / Thane)",
    {
      x: fulfillmentX,
      y: infoBoxY - 14,
      size: 10,
      font: fontBold,
      color: darkGray,
    },
  );

  const slotInfo = bill.order.dispatchSlot
    ? `Slot: ${bill.order.dispatchDate ? `${bill.order.dispatchDate} ` : ""}(${bill.order.dispatchSlot})`
    : `Date: ${bill.order.dispatchDate || "Scheduled"}`;
  page.drawText(slotInfo, {
    x: fulfillmentX,
    y: infoBoxY - 28,
    size: 9,
    font: fontRegular,
    color: darkGray,
  });

  const addressText = isPickup
    ? "Pickup at: Metropolis Rivera, Shop No 10, Kasarvadavali"
    : `Address: ${bill.customer.deliveryAddress || "Delivery Address"}`;

  page.drawText(addressText.slice(0, 52), {
    x: fulfillmentX,
    y: infoBoxY - 40,
    size: 8.5,
    font: fontRegular,
    color: mediumGray,
  });

  if (bill.customer.note) {
    page.drawText(`Note: ${bill.customer.note.slice(0, 48)}`, {
      x: fulfillmentX,
      y: infoBoxY - 52,
      size: 8,
      font: fontRegular,
      color: mediumGray,
    });
  }

  y = infoBoxY - 65;

  // 3. Itemized Table
  // Header Row
  page.drawRectangle({
    x: 50,
    y: y - 6,
    width: width - 100,
    height: 22,
    color: lightGray,
  });

  page.drawText("ITEM DESCRIPTION", {
    x: 60,
    y,
    size: 9,
    font: fontBold,
    color: darkGray,
  });
  page.drawText("QTY", {
    x: 340,
    y,
    size: 9,
    font: fontBold,
    color: darkGray,
  });
  page.drawText("PRICE", {
    x: 410,
    y,
    size: 9,
    font: fontBold,
    color: darkGray,
  });
  page.drawText("AMOUNT", {
    x: 495,
    y,
    size: 9,
    font: fontBold,
    color: darkGray,
  });

  y -= 20;

  for (const item of bill.items) {
    page.drawText(item.name, {
      x: 60,
      y,
      size: 9.5,
      font: fontBold,
      color: darkGray,
    });
    page.drawText(String(item.quantity), {
      x: 345,
      y,
      size: 9.5,
      font: fontRegular,
      color: darkGray,
    });
    page.drawText(`INR ${item.price}`, {
      x: 410,
      y,
      size: 9.5,
      font: fontRegular,
      color: darkGray,
    });
    page.drawText(`INR ${item.total}`, {
      x: 495,
      y,
      size: 9.5,
      font: fontBold,
      color: darkGray,
    });

    y -= 14;

    // Attached Add-ons
    if (item.addons && item.addons.length > 0) {
      for (const addon of item.addons) {
        page.drawText(`+ ${addon.name} (x${addon.quantity})`, {
          x: 75,
          y,
          size: 8.5,
          font: fontRegular,
          color: mediumGray,
        });
        page.drawText(`INR ${addon.total}`, {
          x: 495,
          y,
          size: 8.5,
          font: fontRegular,
          color: mediumGray,
        });
        y -= 12;
      }
    }

    // Row divider line
    page.drawLine({
      start: { x: 50, y: y + 4 },
      end: { x: width - 50, y: y + 4 },
      thickness: 0.5,
      color: lineGray,
    });
    y -= 6;
  }

  // 4. Totals Summary
  y -= 10;
  const totalsX = width - 220;

  page.drawText("Subtotal:", {
    x: totalsX,
    y,
    size: 9.5,
    font: fontRegular,
    color: mediumGray,
  });
  page.drawText(`INR ${bill.totals.subtotal}`, {
    x: width - 80,
    y,
    size: 9.5,
    font: fontRegular,
    color: darkGray,
  });

  y -= 14;
  page.drawText("Delivery Charges:", {
    x: totalsX,
    y,
    size: 9.5,
    font: fontRegular,
    color: mediumGray,
  });
  page.drawText(
    bill.totals.deliveryFee > 0 ? `INR ${bill.totals.deliveryFee}` : "FREE",
    {
      x: width - 80,
      y,
      size: 9.5,
      font: fontRegular,
      color: darkGray,
    },
  );

  if (bill.totals.discount > 0) {
    y -= 14;
    page.drawText("Discount:", {
      x: totalsX,
      y,
      size: 9.5,
      font: fontRegular,
      color: mediumGray,
    });
    page.drawText(`-INR ${bill.totals.discount}`, {
      x: width - 80,
      y,
      size: 9.5,
      font: fontRegular,
      color: darkGray,
    });
  }

  y -= 16;
  page.drawLine({
    start: { x: totalsX - 10, y: y + 10 },
    end: { x: width - 50, y: y + 10 },
    thickness: 1,
    color: lineGray,
  });

  page.drawText("TOTAL PAID:", {
    x: totalsX,
    y,
    size: 11,
    font: fontBold,
    color: brandRed,
  });
  page.drawText(`INR ${bill.totals.grandTotal}`, {
    x: width - 80,
    y,
    size: 12,
    font: fontBold,
    color: brandRed,
  });

  // Payment method note
  y -= 16;
  const paymentMode = `Payment: ${bill.payment.mode === "RAZORPAY" ? "Online Razorpay" : bill.payment.mode} (${bill.payment.status})`;
  page.drawText(paymentMode, {
    x: totalsX,
    y,
    size: 8,
    font: fontRegular,
    color: mediumGray,
  });

  // 5. Bottom Compliance Disclaimer & Thank you
  const footerY = 60;
  page.drawLine({
    start: { x: 50, y: footerY + 25 },
    end: { x: width - 50, y: footerY + 25 },
    thickness: 0.8,
    color: lineGray,
  });

  page.drawText(
    "Thank you for ordering authentic Himalayan delicacies with Nepali Tales!",
    {
      x: 50,
      y: footerY + 12,
      size: 9,
      font: fontBold,
      color: darkGray,
    },
  );

  const disclaimerText =
    "* Disclaimer: All dishes are freshly prepared on a 1-day advance pre-order schedule. Dishes contain Monosodium Glutamate (MSG) in balanced culinary proportions for authentic taste.";
  page.drawText(disclaimerText, {
    x: 50,
    y: footerY,
    size: 7.5,
    font: fontRegular,
    color: mediumGray,
  });

  return await pdfDoc.save();
}

/**
 * Triggers a browser download of the generated PDF invoice.
 */
export async function downloadKitchenBillPdf(bill: KitchenBill): Promise<void> {
  const pdfBytes = await generateKitchenBillPdf(bill);
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Invoice_${bill.order.invoiceNumber || bill.order.orderNumber}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 1000);
}
