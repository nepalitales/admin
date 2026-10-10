"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cancelOrder, type Order } from "@/lib/api";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle } from "lucide-react";

interface CancelOrderModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

export function CancelOrderModal({
  order,
  open,
  onOpenChange,
  onCancelled,
}: CancelOrderModalProps) {
  const [reason, setReason] = useState("");
  const [refundType, setRefundType] = useState<"full" | "partial" | "decline">("full");
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      toast.error("Cancellation reason is required");
      return;
    }

    if (refundType === "partial" && (!refundAmount || refundAmount <= 0 || refundAmount > order.totalAmount)) {
      toast.error(`Partial refund must be between ₹1 and ₹${order.totalAmount}`);
      return;
    }

    setSubmitting(true);
    try {
      await cancelOrder(order.id, {
        reason: reason.trim(),
        refundType,
        refundAmount: refundType === "partial" ? refundAmount : undefined,
        notes: notes.trim() || undefined,
      });

      toast.success(`Order #${order.orderNumber} cancelled successfully`);
      onCancelled();
      onOpenChange(false);
      // Reset form
      setReason("");
      setRefundType("full");
      setRefundAmount(0);
      setNotes("");
    } catch (err: any) {
      toast.error("Failed to cancel order: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const presetReasons = [
    "Item out of stock / fresh ingredients exhausted",
    "Kitchen closed due to peak capacity",
    "Customer requested cancellation via phone",
    "Address outside serviceable delivery radius",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="h-5 w-5" />
              Cancel Order #{order.orderNumber}
            </DialogTitle>
            <DialogDescription>
              Cancel this confirmed order and issue a manual Razorpay refund decision.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1">
            <div className="flex justify-between font-medium">
              <span>Customer: {order.customer.name} ({order.customer.phone})</span>
              <span>Total: ₹{order.totalAmount}</span>
            </div>
            <div className="text-muted-foreground">
              Payment Status: <span className="font-semibold text-foreground uppercase">{order.payment.status}</span>
              {order.payment.razorpayPaymentId && ` • Txn: ${order.payment.razorpayPaymentId}`}
            </div>
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-2">
            <Label htmlFor="cancel-reason" className="text-xs font-semibold">
              Cancellation Reason <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="cancel-reason"
              placeholder="e.g. Ingredients exhausted, customer phone request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {presetReasons.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setReason(preset)}
                  className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Refund Selection */}
          <div className="space-y-2">
            <Label htmlFor="refund-type" className="text-xs font-semibold">
              Refund Policy Decision <span className="text-rose-500">*</span>
            </Label>
            <Select
              value={refundType}
              onValueChange={(val) => {
                if (!val) return;
                const typedVal = val as "full" | "partial" | "decline";
                setRefundType(typedVal);
                if (typedVal === "partial" && !refundAmount) {
                  setRefundAmount(Math.round(order.totalAmount / 2));
                }
              }}
            >
              <SelectTrigger id="refund-type">
                <SelectValue placeholder="Select refund decision" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">
                  Full Refund (₹{order.totalAmount}) — Automated via Razorpay
                </SelectItem>
                <SelectItem value="partial">
                  Partial Refund — Specify custom amount
                </SelectItem>
                <SelectItem value="decline">
                  Decline Refund — No refund issued (Reason note required)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {refundType === "partial" && (
            <div className="space-y-2">
              <Label htmlFor="partial-amount" className="text-xs font-semibold">
                Partial Refund Amount (₹)
              </Label>
              <Input
                id="partial-amount"
                type="number"
                min={1}
                max={order.totalAmount}
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                required
              />
            </div>
          )}

          {/* Note / Details */}
          <div className="space-y-2">
            <Label htmlFor="cancel-notes" className="text-xs font-semibold">
              Admin Refund Note / Explanation
            </Label>
            <Textarea
              id="cancel-notes"
              placeholder="Provide reason note for customer and internal accounting records..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Go Back
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={submitting || !reason.trim()}
            >
              {submitting ? "Processing Refund..." : "Confirm Cancellation & Refund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
