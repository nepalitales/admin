"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Phone,
  MapPin,
  Package,
  Send,
  Loader2,
  AlertCircle,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { updateOrderStatus, type Order } from "@/lib/api";

interface CourierDispatchModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const KITCHEN_ADDRESS =
  "Metropolis Rivera, Shop No 10, Kasarvadavali, Opp to Laxmi Narayan Mandir, Thane 400615";
const KITCHEN_PHONE = "917678097659";

export function CourierDispatchModal({
  order,
  open,
  onOpenChange,
  onSuccess,
}: CourierDispatchModalProps) {
  const [trackingUrl, setTrackingUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const cleanPhone = useMemo(() => {
    if (!order?.customer.phone) return "";
    const digits = order.customer.phone.replace(/\D/g, "");
    return digits.length === 10 ? `91${digits}` : digits;
  }, [order]);

  const dropAddress = useMemo(() => {
    if (!order) return "";
    return (
      order.deliveryAddress.borzoFormat?.address ||
      order.deliveryAddress.street ||
      "Customer Delivery Address"
    );
  }, [order]);

  const dropNote = useMemo(() => {
    if (!order) return "";
    return order.deliveryAddress.borzoFormat?.note || order.deliveryAddress.landmark || "";
  }, [order]);

  const itemsSummary = useMemo(() => {
    if (!order) return "";
    return order.items
      .map((i) => `${i.quantity}x ${i.productName}`)
      .join(", ");
  }, [order]);

  const fullBookingSummary = useMemo(() => {
    if (!order) return "";
    return (
      `=== PICKUP (KITCHEN) ===\n` +
      `Address: ${KITCHEN_ADDRESS}\n` +
      `Phone: ${KITCHEN_PHONE}\n\n` +
      `=== DROP-OFF (CUSTOMER) ===\n` +
      `Name: ${order.customer.name}\n` +
      `Phone: ${order.customer.phone}\n` +
      `Address: ${dropAddress}\n` +
      (dropNote ? `Note: ${dropNote}\n` : "") +
      `\n=== PARCEL ===\n` +
      `Order: #${order.orderNumber}\n` +
      `Items: ${itemsSummary}\n` +
      `Note: Food parcel, please carry upright with care.`
    );
  }, [order, dropAddress, dropNote, itemsSummary]);

  const whatsappMessage = useMemo(() => {
    if (!order) return "";
    const track = trackingUrl.trim()
      ? `\n📍 *Live Courier Tracking:*\n${trackingUrl.trim()}\n`
      : "";

    return (
      `🥟 *Nepali Tales — Your Order is Out for Delivery!*\n\n` +
      `Namaste *${order.customer.name}*!\n` +
      `Your artisanal momo order *#${order.orderNumber}* is freshly packed and on its way via Borzo/Porter courier.\n` +
      track +
      `\n📦 *Drop Location:*\n${dropAddress}\n` +
      (dropNote ? `Note: ${dropNote}\n` : "") +
      `\nℹ️ *Delivery Fee:* As per policy, courier delivery charges are paid directly to the delivery rider upon arrival.\n\n` +
      `Enjoy your hot meal!\n` +
      `*Nepali Tales Cloud Kitchen*`
    );
  }, [order, trackingUrl, dropAddress, dropNote]);

  const handleCopy = (text: string, key: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success(`Copied ${label} to clipboard!`);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleOpenBorzo = () => {
    window.open("https://borzodelivery.com/in/order", "_blank", "noopener,noreferrer");
  };

  const handleOpenPorter = () => {
    window.open("https://porter.in/", "_blank", "noopener,noreferrer");
  };

  const handleSendWhatsApp = () => {
    if (!cleanPhone) {
      toast.error("Customer phone number is missing.");
      return;
    }
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSendSms = () => {
    if (!order?.customer.phone) {
      toast.error("Customer phone number is missing.");
      return;
    }
    const url = `sms:${order.customer.phone}?body=${encodeURIComponent(whatsappMessage)}`;
    window.location.href = url;
  };

  const handleDispatchOrder = async () => {
    if (!order) return;
    setIsSubmitting(true);
    try {
      const res = await updateOrderStatus(
        order.id,
        "out_for_delivery",
        trackingUrl.trim()
          ? `Dispatched via courier with tracking: ${trackingUrl.trim()}`
          : "Dispatched via Borzo/Porter courier",
        trackingUrl.trim() || undefined,
      );

      toast.success(
        `Order #${order.orderNumber} dispatched! Customer notified via email.`
      );
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to update order status: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto font-sans">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Courier Dispatch Assistant — #{order.orderNumber}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Copy pre-formatted order details to Borzo or Porter, then notify the customer.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs border-sky-500/30 text-sky-400 bg-sky-500/5">
              Doorstep Delivery
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          {/* ─── Step 1: Booking Details Cards ──────────────────── */}
          <div className="rounded-xl border border-border/70 bg-card p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" />
                1. Order Dispatch Locations
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={() => handleCopy(fullBookingSummary, "all", "Full Booking Details")}
              >
                {copiedKey === "all" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copy All Details
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Pickup Point */}
              <div className="rounded-lg bg-muted/40 p-2.5 border border-border/40 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                  <span>PICKUP (Kitchen Point)</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6"
                    onClick={() => handleCopy(KITCHEN_ADDRESS, "pickup", "Pickup Address")}
                  >
                    {copiedKey === "pickup" ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <p className="text-foreground leading-relaxed text-[11.5px] font-medium">
                  {KITCHEN_ADDRESS}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Phone: <span className="text-foreground font-mono">{KITCHEN_PHONE}</span>
                </p>
              </div>

              {/* Drop Point */}
              <div className="rounded-lg bg-muted/40 p-2.5 border border-border/40 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                  <span>DROP-OFF (Customer)</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6"
                    onClick={() => handleCopy(dropAddress, "drop", "Customer Drop Address")}
                  >
                    {copiedKey === "drop" ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <p className="text-foreground leading-relaxed text-[11.5px] font-medium">
                  {dropAddress}
                </p>
                {dropNote && (
                  <p className="text-amber-400 text-[11px]">
                    Note: <span className="text-muted-foreground">{dropNote}</span>
                  </p>
                )}
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-muted-foreground">
                    {order.customer.name} (
                    <span className="text-foreground font-mono">{order.customer.phone}</span>)
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-5 w-5"
                    onClick={() => handleCopy(order.customer.phone, "phone", "Phone")}
                  >
                    {copiedKey === "phone" ? (
                      <Check className="h-2.5 w-2.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-2.5 w-2.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Direct Booking Buttons */}
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-xs gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-semibold"
                onClick={handleOpenBorzo}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Borzo (WeFast) Web Booking
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-xs gap-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 font-semibold"
                onClick={handleOpenPorter}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Porter Web Booking
              </Button>
            </div>

            {/* Self Delivery / Optional Notice */}
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>
                Borzo / Porter booking is <strong>optional</strong>. You can deliver using your own kitchen staff, personal bike, or any other courier service.
              </span>
            </p>
          </div>

          {/* ─── Step 2: Tracking & Customer Notification ──────── */}
          <div className="rounded-xl border border-border/70 bg-card p-3 space-y-3">
            <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
              <Share2 className="h-4 w-4 text-emerald-400" />
              2. Save Tracking & Notify Customer
            </span>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">
                Courier Tracking Link or Rider Phone (optional):
              </label>
              <Input
                placeholder="e.g. https://borzodelivery.com/track/12345 or Rider: 9876543210"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            {/* Quick Notify Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                onClick={handleSendWhatsApp}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Send via WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-sky-500/40 text-sky-400 hover:bg-sky-500/10"
                onClick={handleSendSms}
              >
                <Send className="h-3.5 w-3.5" />
                Send via SMS
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 text-muted-foreground"
                onClick={() => handleCopy(whatsappMessage, "msg", "Notification Message")}
              >
                {copiedKey === "msg" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copy Message
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleDispatchOrder}
            disabled={isSubmitting}
            className="text-xs gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Truck className="h-3.5 w-3.5" />
                Mark Out for Delivery & Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
