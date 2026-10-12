import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { KitchenBill } from "./api";

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!current) {
      current = w;
    } else if ((current + " " + w).length <= maxChars) {
      current += " " + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface ReceiptLine {
  text?: string;
  left?: string;
  right?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
}

/**
 * Generates an authentic 80mm thermal receipt PDF for a KitchenBill.
 * Identical to the kitchen POS receipt slip with clean monospace typography and dashed dividers.
 */
export async function generateKitchenBillPdf(bill: KitchenBill): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const COLS = 38;
  const FONT_SIZE = 8.5;
  const LINE_HEIGHT = 11.5;
  const PAGE_WIDTH = 226.77; // 80mm in points
  const MARGIN_LEFT = 14;
  const PRINTABLE_WIDTH = PAGE_WIDTH - MARGIN_LEFT * 2; // ~198.77pt

  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(bill.order.date));

  const formattedTime = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(bill.order.date));

  const invoiceNum = bill.order.invoiceNumber || bill.order.orderNumber;
  const isPickup = (bill.order.orderType || "delivery") === "pickup";
  const fulfillmentType = isPickup ? "PICKUP" : "DELIVERY";

  const lines: ReceiptLine[] = [];
  const divider: ReceiptLine = { text: "-".repeat(COLS), bold: true };

  // 1. Header
  lines.push({ text: bill.restaurant.name.toUpperCase(), bold: true, align: "center" });
  for (const l of wrapText(bill.restaurant.address, COLS)) {
    lines.push({ text: l, align: "center" });
  }
  lines.push({ text: `Ph: ${bill.restaurant.phone}`, align: "center" });
  lines.push(divider);
  lines.push({ text: "RECEIPT", bold: true, align: "center" });
  lines.push(divider);

  // 2. Customer & Order Meta
  lines.push({
    left: `Name: ${bill.customer.name.slice(0, 19)}`,
    right: `Inv: ${invoiceNum}`,
    bold: true,
  });
  lines.push({
    left: `Order #: ${bill.order.orderNumber}`,
    right: formattedDate,
  });
  lines.push({
    left: `TYPE: ${fulfillmentType}`,
    right: `Time: ${formattedTime}`,
    bold: true,
  });

  if (bill.order.dispatchSlot) {
    const slotStr = `Slot: ${bill.order.dispatchDate ? `${bill.order.dispatchDate} ` : ""}${bill.order.dispatchSlot}`;
    for (const l of wrapText(slotStr, COLS)) {
      lines.push({ text: l });
    }
  }

  const addrPrefix = isPickup
    ? "Pickup: Metropolis Rivera, Shop 10"
    : `Address: ${bill.customer.deliveryAddress || "Thane, Maharashtra"}`;
  for (const l of wrapText(addrPrefix, COLS)) {
    lines.push({ text: l });
  }

  if (bill.customer.note) {
    for (const l of wrapText(`Note: ${bill.customer.note}`, COLS)) {
      lines.push({ text: l });
    }
  }

  lines.push(divider);

  // 3. Item Breakdown Table
  lines.push({
    left: "Item",
    right: "Price Qty Total",
    bold: true,
  });

  for (const item of bill.items) {
    const priceStr = String(item.price).padStart(5);
    const qtyStr = String(item.quantity).padStart(3);
    const totalStr = String(item.total).padStart(6);
    const colRight = `${priceStr} ${qtyStr} ${totalStr}`;

    const maxItemNameLen = COLS - colRight.length - 1;
    if (item.name.length <= maxItemNameLen) {
      lines.push({
        left: item.name,
        right: colRight,
      });
    } else {
      const itemWrapped = wrapText(item.name, maxItemNameLen);
      lines.push({
        left: itemWrapped[0],
        right: colRight,
      });
      for (let i = 1; i < itemWrapped.length; i++) {
        lines.push({ text: `  ${itemWrapped[i]}` });
      }
    }

    if (item.addons && item.addons.length > 0) {
      for (const add of item.addons) {
        const addInfo = `+ ${add.name} (${add.quantity}x @ ${add.price})`;
        const addTotal = String(add.total);
        if (addInfo.length + addTotal.length + 1 <= COLS) {
          lines.push({ left: `  ${addInfo}`, right: addTotal });
        } else {
          lines.push({ text: `  ${addInfo}` });
          lines.push({ right: addTotal });
        }
      }
    }
  }

  lines.push(divider);

  // 4. Totals
  lines.push({
    left: "Sub-Total:",
    right: `INR ${bill.totals.subtotal}`,
  });
  if (isPickup) {
    lines.push({
      left: "Fulfillment:",
      right: "Self-Pickup (Free)",
    });
  } else {
    lines.push({
      left: "Delivery Fee:",
      right: bill.totals.deliveryFee > 0 ? `INR ${bill.totals.deliveryFee}` : "As per Borzo/Porter",
    });
  }

  if (bill.totals.discount > 0) {
    lines.push({
      left: "Discount:",
      right: `-INR ${bill.totals.discount}`,
    });
  }

  lines.push({
    left: `Mode: ${bill.payment.mode === "RAZORPAY" ? "Online" : bill.payment.mode}`,
    right: `Total: INR ${bill.totals.grandTotal}`,
    bold: true,
  });

  lines.push(divider);

  // 5. Footer
  if (!isPickup) {
    lines.push({ text: "* Delivery as per Borzo/Porter service", align: "center" });
  }
  lines.push({ text: "** SAVE PAPER SAVE NATURE **", bold: true, align: "center" });
  lines.push({ text: `Time: ${formattedTime}`, align: "center" });
  lines.push(divider);

  // Layout calculation
  const totalHeight = lines.length * LINE_HEIGHT + 32;
  const page = pdfDoc.addPage([PAGE_WIDTH, totalHeight]);
  const textColor = rgb(0, 0, 0);

  let y = totalHeight - 18;

  for (const l of lines) {
    const f = l.bold ? fontBold : font;

    if (l.left !== undefined && l.right !== undefined) {
      page.drawText(l.left, {
        x: MARGIN_LEFT,
        y,
        size: FONT_SIZE,
        font: f,
        color: textColor,
      });

      const rightWidth = f.widthOfTextAtSize(l.right, FONT_SIZE);
      page.drawText(l.right, {
        x: PAGE_WIDTH - MARGIN_LEFT - rightWidth,
        y,
        size: FONT_SIZE,
        font: f,
        color: textColor,
      });
    } else if (l.right !== undefined) {
      const rightWidth = f.widthOfTextAtSize(l.right, FONT_SIZE);
      page.drawText(l.right, {
        x: PAGE_WIDTH - MARGIN_LEFT - rightWidth,
        y,
        size: FONT_SIZE,
        font: f,
        color: textColor,
      });
    } else {
      const str = l.text || "";
      let x = MARGIN_LEFT;
      if (l.align === "center") {
        const textWidth = f.widthOfTextAtSize(str, FONT_SIZE);
        x = Math.max(MARGIN_LEFT, (PAGE_WIDTH - textWidth) / 2);
      } else if (l.align === "right") {
        const textWidth = f.widthOfTextAtSize(str, FONT_SIZE);
        x = PAGE_WIDTH - MARGIN_LEFT - textWidth;
      }
      page.drawText(str, {
        x,
        y,
        size: FONT_SIZE,
        font: f,
        color: textColor,
      });
    }

    y -= LINE_HEIGHT;
  }

  return await pdfDoc.save();
}

/**
 * Triggers a browser download of the generated 80mm kitchen bill PDF receipt.
 */
export async function downloadKitchenBillPdf(bill: KitchenBill): Promise<void> {
  const pdfBytes = await generateKitchenBillPdf(bill);
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Receipt_${bill.order.invoiceNumber || bill.order.orderNumber}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 1000);
}
