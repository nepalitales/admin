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
import { Printer, X } from "lucide-react";
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

  const handlePrint = () => {
    if (!printAreaRef.current) return;
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto font-mono text-xs">
        <DialogHeader className="font-sans">
          <DialogTitle className="flex items-center justify-between text-base">
            <span>Kitchen Receipt / Bill</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Format optimized for kitchen thermal receipt printers (80mm/58mm)
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
            className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-inner space-y-3 print:border-none print:shadow-none print:p-0 print:m-0"
          >
            {/* Header */}
            <div className="text-center border-b border-dashed border-border pb-3">
              <h3 className="font-bold text-sm tracking-wider uppercase font-sans">
                {bill.restaurant.name}
              </h3>
              <p className="text-[11px] text-muted-foreground">{bill.restaurant.tagline}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{bill.restaurant.address}</p>
              <p className="text-[10px] text-muted-foreground">Ph: {bill.restaurant.phone}</p>
            </div>

            {/* Order meta */}
            <div className="border-b border-dashed border-border pb-2 text-[11px] space-y-0.5">
              <div className="flex justify-between font-bold">
                <span>ORDER: {bill.order.orderNumber}</span>
                <span className="uppercase text-primary">{bill.order.status}</span>
              </div>
              <div className="uppercase text-[10px] font-bold tracking-wider">
                {(bill.order.orderType || "delivery") === "pickup" ? "PICKUP" : "DELIVERY"}
              </div>
              <div className="flex justify-between text-muted-foreground text-[10px]">
                <span>Date: {new Date(bill.order.date).toLocaleDateString("en-IN")}</span>
                <span>Time: {new Date(bill.order.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>

            {/* Customer Details */}
            <div className="border-b border-dashed border-border pb-2 text-[11px] space-y-0.5">
              <div className="font-semibold text-foreground">Customer: {bill.customer.name}</div>
              {bill.customer.email && (
                <div className="text-muted-foreground">Email: {bill.customer.email}</div>
              )}
              <div className="text-muted-foreground">Phone: {bill.customer.phone}</div>
              <div className="text-muted-foreground text-[10px] leading-tight">
                {(bill.order.orderType || "delivery") === "pickup" ? "Pickup at: " : "Deliver to: "}
                {bill.customer.deliveryAddress}
              </div>
              {bill.customer.note && (
                <div className="text-[10px] text-amber-500 font-sans mt-0.5">
                  Note: {bill.customer.note}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="border-b border-dashed border-border pb-2">
              <div className="grid grid-cols-12 font-bold text-[10px] pb-1 border-b border-border text-muted-foreground">
                <span className="col-span-7">ITEM</span>
                <span className="col-span-2 text-center">QTY</span>
                <span className="col-span-3 text-right">TOTAL</span>
              </div>
              <div className="divide-y divide-border/40">
                {bill.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 py-1.5 text-[11px]">
                    <span className="col-span-7 font-sans font-medium">{item.name}</span>
                    <span className="col-span-2 text-center font-bold">{item.quantity}</span>
                    <span className="col-span-3 text-right">₹{item.total}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="text-[11px] space-y-1 pb-2 border-b border-dashed border-border">
              <div className="flex justify-between text-muted-foreground">
                <span>Item Subtotal:</span>
                <span>₹{bill.totals.subtotal}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{bill.order.orderType === "pickup" ? "Fulfillment:" : "Delivery Charge:"}</span>
                <span>
                  {bill.order.orderType === "pickup"
                    ? "Kitchen Pickup"
                    : bill.totals.deliveryFee > 0
                    ? `₹${bill.totals.deliveryFee}`
                    : "Free"}
                </span>
              </div>
              {bill.totals.discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount:</span>
                  <span>-₹{bill.totals.discount}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-border">
                <span>GRAND TOTAL:</span>
                <span className="text-primary font-sans">₹{bill.totals.grandTotal}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="text-[10px] text-muted-foreground space-y-0.5 text-center pt-1">
              <div>
                Payment: <span className="font-bold text-foreground">{bill.payment.mode}</span> ({bill.payment.status})
              </div>
              {bill.payment.transactionId !== "N/A" && (
                <div className="truncate">Txn: {bill.payment.transactionId}</div>
              )}
              <div className="text-[9px] text-muted-foreground/80 mt-2 font-sans">
                *** Authentic Himalayan Momos & Chilli Oil ***
              </div>
            </div>
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
            Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
