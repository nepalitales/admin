"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge } from "./order-status-badge";
import type { Order } from "@/lib/api";
import {
  Phone,
  MapPin,
  Clock,
  Truck,
  ExternalLink,
  RotateCw,
  Printer,
  Ban,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface OrderDetailsModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrintBill?: (orderId: string) => void;
  onCancelOrder?: (order: Order) => void;
  onRetryPorter?: (orderId: string) => void;
  onUpdateStatus?: (orderId: string, status: any) => void;
}

export function OrderDetailsModal({
  order,
  open,
  onOpenChange,
  onPrintBill,
  onCancelOrder,
  onRetryPorter,
  onUpdateStatus,
}: OrderDetailsModalProps) {
  if (!order) return null;

  const isPickup = (order.orderType || "delivery") === "pickup";

  const canCancel =
    order.status !== "delivered" &&
    order.status !== "cancelled_by_customer" &&
    order.status !== "cancelled_by_admin";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-xl font-bold">
                Order #{order.orderNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Placed on {new Date(order.createdAt).toLocaleString("en-IN", { hour12: true })}
              </DialogDescription>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2.5 border border-border">
            {onPrintBill && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => onPrintBill(order.id)}
              >
                <Printer className="h-3.5 w-3.5" />
                Print Bill
              </Button>
            )}

            {order.status === "placed" && onUpdateStatus && (
              <Button
                size="sm"
                className="gap-1.5 text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => onUpdateStatus(order.id, "preparing")}
              >
                <Clock className="h-3.5 w-3.5" />
                Start Preparing
              </Button>
            )}

            {order.status === "preparing" && onUpdateStatus && (
              <Button
                size="sm"
                className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => onUpdateStatus(order.id, "ready")}
              >
                <Truck className="h-3.5 w-3.5" />
                {isPickup ? "Mark ready for pickup" : "Mark Ready & Auto-Dispatch Porter"}
              </Button>
            )}

            {isPickup && order.status === "ready" && onUpdateStatus && (
              <Button
                size="sm"
                className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onUpdateStatus(order.id, "delivered")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark collected
              </Button>
            )}

            {order.status === "porter_failed" && onRetryPorter && !isPickup && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => onRetryPorter(order.id)}
              >
                <RotateCw className="h-3.5 w-3.5" />
                Retry Porter Booking
              </Button>
            )}

            {order.borzo?.trackingUrl && (
              <a href={order.borzo.trackingUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-8 text-emerald-400 hover:text-emerald-300 border-emerald-500/40"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Live Porter Tracking
                </Button>
              </a>
            )}

            {canCancel && onCancelOrder && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-8 text-rose-400 hover:text-rose-300 ml-auto"
                onClick={() => onCancelOrder(order)}
              >
                <Ban className="h-3.5 w-3.5" />
                Cancel Order
              </Button>
            )}
          </div>

          {/* Customer & Delivery Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Box */}
            <div className="rounded-lg border border-border p-3.5 space-y-2 bg-card">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Customer Details
              </div>
              <div className="font-semibold text-base">{order.customer.name}</div>
              {order.customer.email && (
                <div className="text-xs text-muted-foreground">{order.customer.email}</div>
              )}
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{order.customer.phone || "No phone"}</span>
                {order.customer.phone && (
                  <a href={`tel:${order.customer.phone}`}>
                    <Button variant="outline" size="xs" className="h-6 text-xs gap-1">
                      Call
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {/* Delivery Box */}
            <div className="rounded-lg border border-border p-3.5 space-y-2 bg-card">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {isPickup ? "Pickup (kitchen)" : "Delivery Address"}
              </div>
              <div className="text-xs leading-relaxed">
                {order.deliveryAddress.borzoFormat.address}
              </div>
              {order.deliveryAddress.borzoFormat.note && (
                <div className="text-xs text-amber-500 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                  <span className="font-semibold">Note:</span> {order.deliveryAddress.borzoFormat.note}
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Items Ordered ({order.items.length})
            </div>
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 text-sm">
                  <div className="flex items-center gap-3">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.productName}
                        className="h-10 w-10 rounded-md object-cover border border-border"
                      />
                    )}
                    <div>
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        ₹{item.price} × {item.quantity}
                      </div>
                    </div>
                  </div>
                  <div className="font-semibold">₹{item.subtotal}</div>
                </div>
              ))}
              <div className="p-3 bg-muted/30 text-xs space-y-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{order.itemTotal}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{isPickup ? "Pickup" : "Delivery Fee"}</span>
                  <span>{isPickup ? "Free" : (order.deliveryFee > 0 ? `₹${order.deliveryFee}` : "Borzo Porter (Separate)")}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount</span>
                    <span>-₹{order.discount}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t border-border">
                  <span>Total Amount</span>
                  <span className="text-primary font-bold">₹{order.totalAmount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Borzo Delivery Status Card */}
          {!isPickup && order.borzo && (
            <div className="rounded-lg border border-border p-3.5 bg-card space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" /> Borzo Porter Logistics
                </span>
                <span className="font-mono text-primary">ID: {order.borzo.borzoOrderName || "Pending"}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Courier Status:</span>{" "}
                  <span className="font-medium capitalize">{order.borzo.status || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Delivery Cost:</span>{" "}
                  <span className="font-medium">
                    {order.borzo.deliveryFee && Number(order.borzo.deliveryFee) > 0
                      ? `₹${order.borzo.deliveryFee}`
                      : "Calculated by Borzo"}
                  </span>
                </div>
              </div>
              {order.borzo.error && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{order.borzo.error}</span>
                </div>
              )}
            </div>
          )}

          {/* Refund Details (if any) */}
          {order.refund && order.refund.status !== "none" && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> Refund Information ({order.refund.type.toUpperCase()})
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Refund Status:</span>{" "}
                  <span className="font-semibold capitalize text-foreground">{order.refund.status}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Refund Amount:</span>{" "}
                  <span className="font-semibold text-foreground">₹{order.refund.amount}</span>
                </div>
              </div>
              {order.refund.reason && (
                <div>
                  <span className="text-muted-foreground">Reason:</span> {order.refund.reason}
                </div>
              )}
              {order.refund.notes && (
                <div>
                  <span className="text-muted-foreground">Admin Notes:</span> {order.refund.notes}
                </div>
              )}
              {order.refund.razorpayRefundId && (
                <div className="font-mono text-[11px] text-muted-foreground">
                  Razorpay Refund ID: {order.refund.razorpayRefundId}
                </div>
              )}
            </div>
          )}

          {/* Chronological Audit Timeline */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Order Timeline Audit Log
            </div>
            <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {order.timeline?.map((entry, idx) => (
                <div key={idx} className="relative text-xs">
                  <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wider text-foreground">
                      {entry.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(entry.timestamp).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                  {entry.note && (
                    <div className="text-muted-foreground text-[11px] mt-0.5">
                      {entry.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
