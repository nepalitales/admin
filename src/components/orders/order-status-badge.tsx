import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/api";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  pending_payment: {
    label: "Payment Pending",
    variant: "outline",
    className: "border-yellow-500/50 text-yellow-500 bg-yellow-500/10",
  },
  placed: {
    label: "Order Placed",
    variant: "default",
    className: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  preparing: {
    label: "Preparing",
    variant: "secondary",
    className: "bg-amber-500/15 text-amber-500 border border-amber-500/30",
  },
  ready: {
    label: "Ready",
    variant: "default",
    className: "bg-indigo-600 hover:bg-indigo-700 text-white",
  },
  porter_booked: {
    label: "Porter Dispatched",
    variant: "default",
    className: "bg-emerald-600 hover:bg-emerald-700 text-white font-medium",
  },
  porter_failed: {
    label: "Porter Booking Failed",
    variant: "destructive",
    className: "bg-rose-600 animate-pulse text-white font-semibold",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    variant: "secondary",
    className: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
  },
  delivered: {
    label: "Completed",
    variant: "outline",
    className: "border-emerald-500/50 text-emerald-400 bg-emerald-500/10",
  },
  cancelled_by_customer: {
    label: "Cancelled by Customer",
    variant: "outline",
    className: "border-zinc-500/50 text-zinc-400 bg-zinc-500/10",
  },
  cancelled_by_admin: {
    label: "Cancelled by Kitchen",
    variant: "destructive",
    className: "bg-rose-950/50 border border-rose-800 text-rose-300",
  },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    variant: "outline" as const,
  };

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
