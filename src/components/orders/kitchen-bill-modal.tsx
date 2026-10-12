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
   * Generates bulletproof, self-contained HTML for 80mm POS Thermal Receipt Printers
   * (e.g. Helett BillQuick Lite 80mm / 3-inch USB Direct POS printer).
   * Uses pure HTML tables with inline styling so formatting never breaks in any browser.
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
              <td colspan="4" style="padding-left: 10px; font-size: 10px; color: #333; line-height: 14px;">
                + ${add.name} (${add.quantity}x @ ${add.price} = ${add.total})
              </td>
            </tr>
          `,
          )
          .join("");

        return `
          <tr>
            <td style="padding: 4px 0 2px 0; text-align: left; font-weight: bold; font-size: 11px; vertical-align: top;">
              ${item.name}
            </td>
            <td style="padding: 4px 2px 2px 2px; text-align: right; font-size: 11px; vertical-align: top; white-space: nowrap;">
              ${item.price}
            </td>
            <td style="padding: 4px 2px 2px 2px; text-align: center; font-size: 11px; font-weight: bold; vertical-align: top;">
              ${item.quantity}
            </td>
            <td style="padding: 4px 0 2px 2px; text-align: right; font-size: 11px; font-weight: bold; vertical-align: top; white-space: nowrap;">
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
              margin: 0;
            }
            @media print {
              html, body {
                width: 80mm;
                margin: 0;
                padding: 0;
                background: #ffffff;
                color: #000000;
              }
            }
            body {
              font-family: 'Courier New', Courier, Monaco, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 4mm 2mm;
              font-size: 11px;
              line-height: 1.35;
              color: #000000;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            .dashed-line {
              border-top: 1px dashed #000000;
              margin: 5px 0;
            }
            .double-dashed-line {
              border-top: 2px dashed #000000;
              margin: 5px 0;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .left { text-align: left; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <!-- Brand Header -->
          <div class="center" style="margin-bottom: 4px;">
            <div style="font-size: 15px; font-weight: 800; letter-spacing: 1px;">
              ${b.restaurant.name.toUpperCase()}
            </div>
            <div style="font-size: 9.5px; margin-top: 2px; line-height: 12px;">
              ${b.restaurant.address}
            </div>
            <div style="font-size: 10px; margin-top: 2px;">
              Ph: ${b.restaurant.phone}
            </div>
          </div>

          <div class="dashed-line"></div>
          <div class="center bold" style="font-size: 11px; letter-spacing: 2px;">
            RECEIPT / TAX INVOICE
          </div>
          <div class="dashed-line"></div>

          <!-- Customer & Order Meta Table -->
          <table style="font-size: 11px;">
            <tr>
              <td style="text-align: left; font-weight: bold; vertical-align: top; width: 55%;">
                Name: ${b.customer.name}
              </td>
              <td style="text-align: right; font-weight: bold; vertical-align: top; width: 45%;">
                Inv #: ${invoiceNum}
              </td>
            </tr>
            <tr>
              <td style="text-align: left; vertical-align: top;">
                Order #: ${b.order.orderNumber}
              </td>
              <td style="text-align: right; vertical-align: top;">
                ${formattedDate}
              </td>
            </tr>
            <tr>
              <td style="text-align: left; font-weight: bold; vertical-align: top;">
                MODE: ${fulfillmentType}
              </td>
              <td style="text-align: right; vertical-align: top;">
                Time: ${formattedTime}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: left; padding-top: 2px;">
                Slot: <strong>${slotText}</strong>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="text-align: left; font-size: 10px; line-height: 13px; padding-top: 3px;">
                ${isPickup ? "Pickup: Metropolis Rivera, Shop 10" : `Address: ${b.customer.deliveryAddress}`}
              </td>
            </tr>
            ${
              b.customer.note
                ? `<tr><td colspan="2" style="text-align: left; font-size: 9.5px; font-style: italic; padding-top: 2px;">Note: ${b.customer.note}</td></tr>`
                : ""
            }
          </table>

          <div class="dashed-line"></div>

          <!-- Items Table -->
          <table style="font-size: 11px;">
            <thead>
              <tr style="border-bottom: 1px dashed #000000; font-weight: bold;">
                <th style="text-align: left; padding-bottom: 3px;">Item</th>
                <th style="text-align: right; padding-bottom: 3px; width: 38px;">Price</th>
                <th style="text-align: center; padding-bottom: 3px; width: 28px;">Qty</th>
                <th style="text-align: right; padding-bottom: 3px; width: 42px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="dashed-line"></div>

          <!-- Totals Table -->
          <table style="font-size: 11px;">
            <tr>
              <td style="text-align: left; padding: 1px 0;">Sub-Total:</td>
              <td style="text-align: right; padding: 1px 0;">INR ${b.totals.subtotal}</td>
            </tr>
            <tr>
              <td style="text-align: left; padding: 1px 0;">
                ${isPickup ? "Fulfillment:" : "Delivery Fee:"}
              </td>
              <td style="text-align: right; padding: 1px 0;">
                ${isPickup ? "FREE" : b.totals.deliveryFee > 0 ? `INR ${b.totals.deliveryFee}` : "FREE"}
              </td>
            </tr>
            ${
              b.totals.discount > 0
                ? `
            <tr>
              <td style="text-align: left; padding: 1px 0;">Discount:</td>
              <td style="text-align: right; padding: 1px 0;">-INR ${b.totals.discount}</td>
            </tr>
            `
                : ""
            }
            <tr style="border-top: 1px dashed #000000; font-weight: bold; font-size: 12px;">
              <td style="text-align: left; padding-top: 4px;">
                Mode: ${b.payment.mode === "RAZORPAY" ? "Online" : b.payment.mode}
              </td>
              <td style="text-align: right; padding-top: 4px;">
                TOTAL: INR ${b.totals.grandTotal}
              </td>
            </tr>
          </table>

          <div class="dashed-line"></div>

          <!-- Footer -->
          <div class="center" style="font-size: 9.5px; margin-top: 6px; line-height: 13px;">
            <div style="font-weight: bold; letter-spacing: 1px;">
              ** SAVE PAPER SAVE NATURE **
            </div>
            <div>Authentic Himalayan Delicacies</div>
            <div style="margin-top: 2px;">Thank you for your order!</div>
          </div>
          <div class="dashed-line" style="margin-top: 6px;"></div>
        </body>
      </html>
    `;
  };

  /**
   * Optimized 80mm Thermal Receipt Printing.
   * Compatible with Helett BillQuick Lite USB Direct POS Autocut Thermal Printer.
   */
  const handlePrint = () => {
    if (!bill) return;

    const printHtml = buildThermalReceiptHtml(bill);

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "none";
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
      }, 1000);
    }, 250);
  };

  /**
   * Generates and downloads official A4 Tax Invoice PDF using pure vector pdf-lib.
   */
  const handleDownloadPdf = async () => {
    if (!bill) return;
    setDownloadingPdf(true);
    try {
      toast.info("Generating invoice PDF...");
      await downloadKitchenBillPdf(bill);
      toast.success("Invoice PDF downloaded successfully!");
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
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto font-mono text-xs">
        <DialogHeader className="font-sans">
          <DialogTitle className="flex items-center justify-between text-base">
            <span>Kitchen Receipt / Bill</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Optimized for Helett BillQuick Lite POS 80mm (3-inch) Thermal Printer &amp; Vector A4 PDF
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
            className="rounded-lg border border-neutral-300 bg-white p-4 text-black shadow-inner space-y-2 font-mono text-[11px]"
            style={{ width: "100%", maxWidth: "340px", margin: "0 auto" }}
          >
            {/* Header: Restaurant Name & Address */}
            <div className="text-center pb-1">
              <h3 className="font-bold text-sm tracking-wide uppercase font-mono">
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
                  <td className="text-left align-top pb-0.5">
                    Order #: {bill.order.orderNumber}
                  </td>
                  <td className="text-right align-top pb-0.5 whitespace-nowrap">
                    {formattedDate}
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
                      : `Address: ${bill.customer.deliveryAddress}`}
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
                      : "Free"}
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
              Print Receipt (80mm Thermal)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
