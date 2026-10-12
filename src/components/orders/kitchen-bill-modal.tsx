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
import { Printer } from "lucide-react";
import { toast } from "sonner";

interface KitchenBillModalProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KitchenBillModal({ orderId, open, onOpenChange }: KitchenBillModalProps) {
  const [bill, setBill] = useState<KitchenBill | null>(null);
  const [loading, setLoading] = useState(false);
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
   * Optimized 80mm Thermal Receipt Printing.
   * Compatible with Helett BillQuick Lite USB Direct POS Autocut Thermal Printer (80mm / 3 inch / 203 DPI).
   * Generates a dedicated printable frame to prevent browser headers, footers, or margins.
   */
  const handlePrint = () => {
    if (!bill) return;

    const printContent = printAreaRef.current?.innerHTML;
    if (!printContent) {
      window.print();
      return;
    }

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
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt_${bill.order.orderNumber}</title>
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
              font-family: 'Courier New', Courier, monospace, monospace;
              width: 74mm;
              margin: 0 auto;
              padding: 2mm 1mm;
              font-size: 11px;
              line-height: 1.3;
              color: #000000;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .left { text-align: left; }
            .bold { font-weight: bold; }
            .divider {
              border-top: 1px dashed #000000;
              margin: 6px 0;
            }
            .double-divider {
              border-top: 2px dashed #000000;
              margin: 6px 0;
            }
            .table-row {
              display: flex;
              justify-content: space-between;
              margin: 2px 0;
            }
            .item-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            .item-table th {
              text-align: left;
              padding: 2px 0;
              font-weight: bold;
              border-bottom: 1px dashed #000;
            }
            .item-table td {
              padding: 3px 0;
              vertical-align: top;
            }
            .nowrap { white-space: nowrap; }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    frameDoc.close();

    printFrame.contentWindow?.focus();
    setTimeout(() => {
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1000);
    }, 250);
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
        hour12: false,
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
            Optimized for Helett BillQuick Lite POS 80mm (3-inch) Thermal Receipt Printer
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
            className="rounded-lg border border-neutral-300 bg-white p-4 text-black shadow-inner space-y-2 print:border-none print:shadow-none print:p-0 print:m-0 font-mono"
            style={{ width: "100%", maxWidth: "340px", margin: "0 auto" }}
          >
            {/* ─── Header: Restaurant Name & Address ─────────────────── */}
            <div className="text-center pb-1">
              <h3 className="font-bold text-base tracking-wide uppercase font-mono">
                {bill.restaurant.name}
              </h3>
              <p className="text-[11px] leading-tight mt-1">
                {bill.restaurant.address}
              </p>
              <p className="text-[11px] mt-0.5">
                Ph: {bill.restaurant.phone}
              </p>
            </div>

            {/* Receipt title separator */}
            <div className="text-center text-[11px] font-bold py-1 border-t border-b border-dashed border-black">
              ---------------- RECEIPT ----------------
            </div>

            {/* ─── Customer & Order Meta ────────────────────────────── */}
            <div className="text-[11px] space-y-1 pt-1 pb-1">
              <div className="flex justify-between items-start">
                <span className="font-semibold truncate max-w-[170px]">
                  Name: {bill.customer.name}
                </span>
                <span className="font-bold shrink-0">
                  Invoice No: {bill.order.invoiceNumber || bill.order.orderNumber}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span>Order #: {bill.order.orderNumber}</span>
                <span>Date: {formattedDate}</span>
              </div>

              <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold uppercase">
                  {(bill.order.orderType || "delivery") === "pickup" ? "TYPE: PICKUP" : "TYPE: DELIVERY"}
                </span>
                {bill.order.dispatchSlot ? (
                  <span>Slot: {bill.order.dispatchSlot}</span>
                ) : (
                  <span>Status: {bill.order.status}</span>
                )}
              </div>

              <div className="text-[10px] leading-tight text-neutral-800 pt-0.5">
                {(bill.order.orderType || "delivery") === "pickup"
                  ? "Pickup: Kitchen (Metropolis Rivera, Shop No 10)"
                  : `Address: ${bill.customer.deliveryAddress}`}
              </div>

              {bill.customer.note && (
                <div className="text-[10px] italic pt-0.5 text-neutral-700">
                  Note: {bill.customer.note}
                </div>
              )}
            </div>

            {/* Separator before Items */}
            <div className="border-t border-dashed border-black" />

            {/* ─── Item Breakdown Table ─────────────────────────────── */}
            <div className="py-1">
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
                      <td className="py-1.5 pr-1 font-medium">
                        <div>{item.name}</div>
                        {item.addons && item.addons.length > 0 && (
                          <div className="text-[10px] text-neutral-600 pl-1.5 space-y-0.5">
                            {item.addons.map((add, aIdx) => (
                              <div key={aIdx}>
                                + {add.name} ({add.quantity}x ₹{add.price})
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-1 text-right whitespace-nowrap">
                        ₹{item.price}
                      </td>
                      <td className="py-1.5 px-1 text-center font-bold">
                        {item.quantity}
                      </td>
                      <td className="py-1.5 text-right font-bold whitespace-nowrap">
                        ₹{item.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Separator before totals */}
            <div className="border-t border-dashed border-black" />

            {/* ─── Totals Section ───────────────────────────────────── */}
            <div className="text-[11px] space-y-1 py-1">
              <div className="flex justify-between">
                <span>Sub-Total:</span>
                <span className="font-semibold">₹{bill.totals.subtotal}</span>
              </div>

              <div className="flex justify-between text-[11px]">
                <span>
                  {bill.order.orderType === "pickup" ? "Fulfillment:" : "Delivery Fee:"}
                </span>
                <span>
                  {bill.order.orderType === "pickup"
                    ? "Free (Pickup)"
                    : bill.totals.deliveryFee > 0
                    ? `₹${bill.totals.deliveryFee}`
                    : "Free"}
                </span>
              </div>

              {bill.totals.discount > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-₹{bill.totals.discount}</span>
                </div>
              )}

              <div className="border-t border-dashed border-black pt-1.5 flex justify-between font-bold text-xs">
                <span>Mode: {bill.payment.mode === "RAZORPAY" ? "Online" : bill.payment.mode}</span>
                <span>Total: ₹{bill.totals.grandTotal}</span>
              </div>
            </div>

            {/* Separator before footer */}
            <div className="border-t border-dashed border-black" />

            {/* ─── Footer: Save Paper + Time ───────────────────────── */}
            <div className="text-center text-[10px] text-neutral-800 space-y-0.5 pt-1">
              <div className="font-bold tracking-wider">
                ** SAVE PAPER SAVE NATURE !! **
              </div>
              <div>Time: {formattedTime}</div>
            </div>

            <div className="border-b border-dashed border-black pt-0.5" />
          </div>
        ) : null}

        <DialogFooter className="font-sans flex items-center justify-between sm:justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
