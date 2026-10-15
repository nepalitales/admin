"use client";

import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getKitchenBill, type KitchenBill } from "@/lib/api";
import { Printer, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadKitchenBillPdf } from "@/lib/pdf-invoice";

interface KitchenBillModalProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KitchenBillModal({ orderId, open, onOpenChange }: KitchenBillModalProps) {
  const [bill, setBill] = useState<KitchenBill | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !orderId) {
      setBill(null);
      return;
    }

    let active = true;
    setLoading(true);

    getKitchenBill(orderId)
      .then((res) => {
        if (active) setBill(res.bill);
      })
      .catch((err) => {
        if (active) {
          toast.error("Failed to load bill receipt: " + err.message);
          onOpenChange(false);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId, open, onOpenChange]);

  /**
   * Generates self-contained HTML for 80mm POS Thermal Receipt Printers
   * (e.g. Helett BillQuick Lite 80mm / 3-inch USB Direct POS printer).
   * Centered horizontally on ANY print canvas (A4, Letter, Save as PDF, or continuous roll).
   */
  const buildThermalReceiptHtml = (b: KitchenBill): string => {
    const formattedDate = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(b.order.date));

    const formattedTime = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(b.order.date));

    const invoiceNum = b.order.invoiceNumber || b.order.orderNumber;
    const isPickup = (b.order.orderType || "delivery") === "pickup";
    const fulfillmentType = isPickup ? "PICKUP (TAKEAWAY)" : "DOORSTEP DELIVERY";
    const slotText = b.order.dispatchSlot
      ? `${b.order.dispatchDate ? `${b.order.dispatchDate} ` : ""}(${b.order.dispatchSlot})`
      : b.order.dispatchDate || "Scheduled";

    const itemsHtml = b.items
      .map((item) => {
        const addonLines = (item.addons || [])
          .map(
            (add) => `
            <tr>
              <td colspan="4" style="padding-left: 8px; font-size: 10px; font-weight: 600; color: #000000; line-height: 13px;">
                + ${add.name} (${add.quantity}x @ ${add.price} = ${add.total})
              </td>
            </tr>
          `,
          )
          .join("");

        return `
          <tr>
            <td style="padding: 3px 0 2px 0; text-align: left; font-weight: 700; font-size: 11px; vertical-align: top; color: #000000;">
              ${item.name}
            </td>
            <td style="padding: 3px 2px 2px 2px; text-align: right; font-size: 11px; font-weight: 600; vertical-align: top; white-space: nowrap; color: #000000;">
              ${item.price}
            </td>
            <td style="padding: 3px 2px 2px 2px; text-align: center; font-size: 11px; font-weight: 800; vertical-align: top; color: #000000;">
              ${item.quantity}
            </td>
            <td style="padding: 3px 0 2px 2px; text-align: right; font-size: 11px; font-weight: 800; vertical-align: top; white-space: nowrap; color: #000000;">
              ${item.total}
            </td>
          </tr>
          ${addonLines}
        `;
      })
      .join("");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt_${invoiceNum}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 100%;
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #000000 !important;
              font-family: Arial, 'Segoe UI', -apple-system, Roboto, 'Helvetica Neue', sans-serif;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: geometricPrecision;
            }
            .receipt-container {
              width: 72mm;
              max-width: 72mm;
              margin: 0 !important;
              padding: 2mm 2.5mm;
              background: #ffffff;
              color: #000000 !important;
              box-sizing: border-box;
            }
            @media print {
              @page {
                size: 80mm auto;
                margin: 0mm !important;
              }
              html, body {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
              }
              .receipt-container {
                width: 72mm !important;
                max-width: 72mm !important;
                margin: 0 !important;
                padding: 1.5mm 2.5mm !important;
                background: #ffffff !important;
                color: #000000 !important;
                box-sizing: border-box !important;
              }
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-feature-settings: "tnum" 1;
            }
            .dashed-line {
              border-top: 1.5px dashed #000000;
              margin: 4px 0;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .left { text-align: left; }
            .bold { font-weight: 800; }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <!-- Brand Header -->
            <div class="center" style="margin-bottom: 3px;">
              <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px; color: #000000;">
                ${b.restaurant.name.toUpperCase()}
              </div>
              <div style="font-size: 10px; font-weight: 600; margin-top: 2px; line-height: 13px; color: #000000;">
                ${b.restaurant.address}
              </div>
              <div style="font-size: 10.5px; font-weight: 700; margin-top: 2px; color: #000000;">
                Ph: ${b.restaurant.phone}
              </div>
            </div>

            <div class="dashed-line"></div>
            <div class="center bold" style="font-size: 12.5px; letter-spacing: 2px; color: #000000; padding: 1px 0;">
              RECEIPT
            </div>
            <div class="dashed-line"></div>

            <!-- Customer & Order Meta Table -->
            <table style="width: 100%; font-size: 11px; color: #000000; line-height: 1.35; font-weight: 600;">
              <tr>
                <td style="text-align: left; font-weight: 800; vertical-align: top; width: 55%;">
                  Name: ${b.customer.name}
                </td>
                <td style="text-align: right; font-weight: 800; vertical-align: top; width: 45%;">
                  Inv #: ${invoiceNum}
                </td>
              </tr>
              <tr>
                <td style="text-align: left; font-weight: 700; vertical-align: top;">
                  Ph: ${b.customer.phone || "—"}
                </td>
                <td style="text-align: right; vertical-align: top;">
                  ${formattedDate}
                </td>
              </tr>
              <tr>
                <td style="text-align: left; vertical-align: top;">
                  Order #: ${b.order.orderNumber}
                </td>
                <td style="text-align: right; vertical-align: top;">
                  Time: ${formattedTime}
                </td>
              </tr>
              <tr>
                <td style="text-align: left; font-weight: 800; vertical-align: top;" colspan="2">
                  MODE: ${fulfillmentType}
                </td>
              </tr>
              <tr>
                <td colspan="2" style="text-align: left; padding-top: 2px;">
                  Slot: <strong style="font-weight: 800;">${slotText}</strong>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="text-align: left; font-size: 10px; line-height: 13px; padding-top: 2px; font-weight: 600;">
                  ${isPickup ? "Pickup: Metropolis Rivera, Shop 10" : `Address: ${b.customer.deliveryAddress || "Thane, Maharashtra"}`}
                </td>
              </tr>
              ${
                b.customer.note
                  ? `<tr><td colspan="2" style="text-align: left; font-size: 10px; padding-top: 2px; font-weight: 700; color: #000000;">Note: ${b.customer.note}</td></tr>`
                  : ""
              }
            </table>

            <div class="dashed-line"></div>

            <!-- Items Table -->
            <table style="width: 100%; font-size: 11px; color: #000000; line-height: 1.35;">
              <thead>
                <tr style="border-bottom: 1.5px dashed #000000; font-weight: 800; font-size: 11.5px;">
                  <th style="text-align: left; padding: 2px 0 3px 0;">Item</th>
                  <th style="text-align: right; padding: 2px 2px 3px 2px; width: 38px;">Price</th>
                  <th style="text-align: center; padding: 2px 2px 3px 2px; width: 28px;">Qty</th>
                  <th style="text-align: right; padding: 2px 0 3px 2px; width: 44px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="dashed-line"></div>

            <!-- Totals Table -->
            <table style="width: 100%; font-size: 11px; color: #000000; line-height: 1.35; font-weight: 600;">
              <tr>
                <td style="text-align: left; padding: 2px 0;">Sub-Total:</td>
                <td style="text-align: right; padding: 2px 0; font-weight: 800;">INR ${b.totals.subtotal}</td>
              </tr>
              <tr>
                <td style="text-align: left; padding: 2px 0;">
                  ${isPickup ? "Fulfillment:" : "Delivery Fee:"}
                </td>
                <td style="text-align: right; padding: 2px 0; font-weight: 700;">
                  ${isPickup ? "FREE (Pickup)" : b.totals.deliveryFee > 0 ? `INR ${b.totals.deliveryFee}` : "As per Borzo/Porter service"}
                </td>
              </tr>
              ${
                b.totals.discount > 0
                  ? `
              <tr>
                <td style="text-align: left; padding: 2px 0;">Discount:</td>
                <td style="text-align: right; padding: 2px 0; font-weight: 800;">-INR ${b.totals.discount}</td>
              </tr>
              `
                  : ""
              }
              <tr style="border-top: 1.5px dashed #000000; font-weight: 900; font-size: 13px;">
                <td style="text-align: left; padding-top: 5px; padding-bottom: 2px;">
                  Mode: ${b.payment.mode === "RAZORPAY" ? "Online" : b.payment.mode}
                </td>
                <td style="text-align: right; padding-top: 5px; padding-bottom: 2px;">
                  TOTAL: INR ${b.totals.grandTotal}
                </td>
              </tr>
            </table>

            <div class="dashed-line"></div>

            <!-- Footer -->
            <div class="center" style="font-size: 10px; margin-top: 6px; line-height: 14px; color: #000000; text-align: center;">
              <div style="font-weight: 800; letter-spacing: 0.5px;">
                ** SAVE PAPER SAVE NATURE **
              </div>
              <div style="font-weight: 600;">Authentic Nepali Delicacies</div>
              ${!isPickup ? `<div style="margin-top: 2px; font-weight: 700;">* Delivery as per Borzo/Porter service</div>` : ""}
              <div style="margin-top: 2px; font-weight: 700;">Thank you for your order!</div>
            </div>
            <div class="dashed-line" style="margin-top: 5px;"></div>
          </div>
        </body>
      </html>
    `;
  };

  /**
   * Optimized 80mm Thermal Receipt Printing.
   * Compatible with POS80 / Helett BillQuick Lite USB Direct POS Thermal Printers.
   * Centered on 80mm rolls with anti-bleed typography and 0 margin clipping.
   */
  const handlePrint = () => {
    if (!bill) return;

    const printHtml = buildThermalReceiptHtml(bill);

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.left = "-9999px";
    printFrame.style.top = "0";
    printFrame.style.width = "80mm";
    printFrame.style.height = "1000px";
    printFrame.style.border = "none";
    printFrame.style.opacity = "0";
    printFrame.style.pointerEvents = "none";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) {
      window.print();
      return;
    }

    frameDoc.open();
    frameDoc.write(printHtml);
    frameDoc.close();

    printFrame.contentWindow?.focus();
    setTimeout(() => {
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1500);
    }, 250);
  };

  /**
   * Generates and downloads the exact 80mm Kitchen Bill PDF receipt.
   */
  const handleDownloadPdf = async () => {
    if (!bill) return;
    setDownloadingPdf(true);
    try {
      toast.info("Generating kitchen bill PDF...");
      await downloadKitchenBillPdf(bill);
      toast.success("Kitchen bill PDF downloaded successfully!");
    } catch (err: any) {
      console.error("PDF download error:", err);
      toast.error("Failed to generate PDF: " + (err?.message || "Unknown error"));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const formattedDate = bill
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(bill.order.date))
    : "";

  const formattedTime = bill
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(bill.order.date))
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden font-sans text-xs">
        <DialogHeader className="font-sans">
          <DialogTitle className="flex items-center justify-between text-base">
            <span>Kitchen Receipt / Bill</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Optimized for POS80 &amp; Helett BillQuick Lite 80mm Thermal Printers (Anti-bleed font, Centered)
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-6 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : bill ? (
          <div
            ref={printAreaRef}
            id="kitchen-print-receipt"
            className="rounded-lg border border-neutral-300 bg-white p-4 text-black shadow-inner space-y-2 font-sans text-[11px]"
            style={{ width: "100%", maxWidth: "340px", margin: "0 auto" }}
          >
            {/* Header: Restaurant Name & Address */}
            <div className="text-center pb-1">
              <h3 className="font-bold text-sm tracking-wide uppercase font-sans">
                {bill.restaurant.name}
              </h3>
              <p className="text-[10px] leading-tight mt-1 text-neutral-800">
                {bill.restaurant.address}
              </p>
              <p className="text-[10px] mt-0.5 text-neutral-800">
                Ph: {bill.restaurant.phone}
              </p>
            </div>

            <div className="text-center text-[10px] font-bold py-1 border-t border-b border-dashed border-black">
              ---------------- RECEIPT ----------------
            </div>

            {/* Customer & Order Meta Table */}
            <table className="w-full text-[11px] border-collapse">
              <tbody>
                <tr>
                  <td className="text-left font-semibold align-top pb-0.5">
                    Name: {bill.customer.name}
                  </td>
                  <td className="text-right font-bold align-top pb-0.5 whitespace-nowrap">
                    Inv: {bill.order.invoiceNumber || bill.order.orderNumber}
                  </td>
                </tr>
                <tr>
                  <td className="text-left font-semibold align-top pb-0.5">
                    Ph: {bill.customer.phone || "—"}
                  </td>
                  <td className="text-right align-top pb-0.5 whitespace-nowrap">
                    {formattedDate}
                  </td>
                </tr>
                <tr>
                  <td className="text-left align-top pb-0.5">
                    Order #: {bill.order.orderNumber}
                  </td>
                  <td className="text-right align-top pb-0.5 whitespace-nowrap">
                    {formattedTime}
                  </td>
                </tr>
                <tr>
                  <td className="text-left font-bold uppercase align-top pb-0.5">
                    {(bill.order.orderType || "delivery") === "pickup"
                      ? "TYPE: PICKUP"
                      : "TYPE: DELIVERY"}
                  </td>
                  <td className="text-right align-top pb-0.5 whitespace-nowrap">
                    {bill.order.dispatchSlot ? `Slot: ${bill.order.dispatchSlot}` : `Status: ${bill.order.status}`}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="text-left text-[10px] leading-tight text-neutral-800 pt-0.5">
                    {(bill.order.orderType || "delivery") === "pickup"
                      ? "Pickup: Metropolis Rivera, Shop No 10"
                      : `Address: ${bill.customer.deliveryAddress || "Thane, Maharashtra"}`}
                  </td>
                </tr>
                {bill.customer.note && (
                  <tr>
                    <td colSpan={2} className="text-left text-[9.5px] italic text-neutral-700 pt-0.5">
                      Note: {bill.customer.note}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="border-t border-dashed border-black" />

            {/* Item Breakdown Table */}
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-dashed border-black font-bold">
                  <th className="text-left py-1">Item</th>
                  <th className="text-right py-1 px-1">Price</th>
                  <th className="text-center py-1 px-1">Qty</th>
                  <th className="text-right py-1">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-neutral-300">
                {bill.items.map((item, idx) => (
                  <tr key={idx} className="align-top">
                    <td className="py-1 pr-1 font-medium">
                      <div>{item.name}</div>
                      {item.addons && item.addons.length > 0 && (
                        <div className="text-[9.5px] text-neutral-600 pl-1.5 space-y-0.5">
                          {item.addons.map((add, aIdx) => (
                            <div key={aIdx}>
                              + {add.name} ({add.quantity}x @ ₹{add.price})
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-1 px-1 text-right whitespace-nowrap">
                      ₹{item.price}
                    </td>
                    <td className="py-1 px-1 text-center font-bold">
                      {item.quantity}
                    </td>
                    <td className="py-1 text-right font-bold whitespace-nowrap">
                      ₹{item.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashed border-black" />

            {/* Totals Table */}
            <table className="w-full text-[11px] border-collapse">
              <tbody>
                <tr>
                  <td className="text-left py-0.5">Sub-Total:</td>
                  <td className="text-right py-0.5 font-semibold">₹{bill.totals.subtotal}</td>
                </tr>
                <tr>
                  <td className="text-left py-0.5">
                    {bill.order.orderType === "pickup" ? "Fulfillment:" : "Delivery Fee:"}
                  </td>
                  <td className="text-right py-0.5">
                    {bill.order.orderType === "pickup"
                      ? "Free (Pickup)"
                      : bill.totals.deliveryFee > 0
                      ? `₹${bill.totals.deliveryFee}`
                      : "As per Borzo/Porter service"}
                  </td>
                </tr>
                {bill.totals.discount > 0 && (
                  <tr>
                    <td className="text-left py-0.5">Discount:</td>
                    <td className="text-right py-0.5">-₹{bill.totals.discount}</td>
                  </tr>
                )}
                <tr className="border-t border-dashed border-black font-bold text-xs">
                  <td className="text-left pt-1.5">
                    Mode: {bill.payment.mode === "RAZORPAY" ? "Online" : bill.payment.mode}
                  </td>
                  <td className="text-right pt-1.5">
                    Total: ₹{bill.totals.grandTotal}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="border-t border-dashed border-black" />

            {/* Footer */}
            <div className="text-center text-[9.5px] text-neutral-800 space-y-0.5 pt-1">
              {bill.order.orderType !== "pickup" && (
                <div className="font-bold text-neutral-900">* Delivery as per Borzo/Porter service</div>
              )}
              <div className="font-bold tracking-wider">
                ** SAVE PAPER SAVE NATURE !! **
              </div>
              <div>Time: {formattedTime}</div>
            </div>

            <div className="border-b border-dashed border-black pt-0.5" />
          </div>
        ) : null}

        <DialogFooter className="font-sans flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={!bill || downloadingPdf}
              className="gap-1.5 border-neutral-300 hover:bg-neutral-100"
            >
              {downloadingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4 text-neutral-700" />
              )}
              Download Bill PDF
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-primary text-primary-foreground gap-1.5"
              disabled={!bill}
            >
              <Printer className="h-4 w-4" />
              Print Receipt (80mm)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
