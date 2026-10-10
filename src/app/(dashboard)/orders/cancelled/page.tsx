"use client";

import { useEffect, useState } from "react";
import { getCancelledOrders, type Order } from "@/lib/api";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderDetailsModal } from "@/components/orders/order-details-modal";
import { KitchenBillModal } from "@/components/orders/kitchen-bill-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Ban, AlertCircle, ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function CancelledOrdersPage() {
  const [cancelledOrders, setCancelledOrders] = useState<Order[]>([]);
  const [totalRefunded, setTotalRefunded] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [detailsModalOrder, setDetailsModalOrder] = useState<Order | null>(null);
  const [billModalOrderId, setBillModalOrderId] = useState<string | null>(null);

  const fetchCancelledOrders = async () => {
    setLoading(true);
    try {
      const res = await getCancelledOrders();
      setCancelledOrders(res.cancelledOrders);
      setTotalRefunded(res.totalRefundedAmount);
    } catch (err: any) {
      toast.error("Failed to load cancelled orders: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCancelledOrders();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/orders">
              <Button variant="ghost" size="xs" className="h-7 text-xs gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Orders
              </Button>
            </Link>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-rose-500 flex items-center gap-2">
            <Ban className="h-6 w-6" /> Cancelled Orders & Refund Tracker
          </h2>
          <p className="text-muted-foreground text-sm">
            Auditing customer cancellations (auto-refunded before 8am) and kitchen-cancelled orders.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchCancelledOrders}
          className="text-xs gap-1.5"
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Cancelled Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-400">
              {loading ? <Skeleton className="h-8 w-16" /> : cancelledOrders.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Across all dates & sessions
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Razorpay Refunds Issued
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {loading ? <Skeleton className="h-8 w-24" /> : `₹${totalRefunded}`}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Successfully processed back to customer UPI / Bank
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cancelled Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Cancelled By</TableHead>
                  <TableHead>Refund Status</TableHead>
                  <TableHead>Refund Amount</TableHead>
                  <TableHead>Reason & Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : cancelledOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-36 text-center text-muted-foreground text-sm">
                      No cancelled orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  cancelledOrders.map((order) => {
                    const isCustomer = order.status === "cancelled_by_customer";
                    const refund = order.refund;

                    return (
                      <TableRow key={order.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono font-medium">
                          <div>{order.orderNumber}</div>
                          <div className="text-[10px] text-muted-foreground font-sans">
                            {new Date(order.updatedAt).toLocaleDateString("en-IN")}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-xs">{order.customer.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {order.customer.phone}
                          </div>
                        </TableCell>

                        <TableCell>
                          {isCustomer ? (
                            <Badge variant="outline" className="border-zinc-500 text-zinc-300 text-[11px]">
                              Customer (Before 8am)
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[11px]">
                              Kitchen Admin
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          {refund?.status === "refunded" ? (
                            <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10 text-[11px]">
                              Refunded ({refund.type})
                            </Badge>
                          ) : refund?.status === "declined" ? (
                            <Badge variant="outline" className="border-rose-500/50 text-rose-400 bg-rose-500/10 text-[11px]">
                              Declined
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px]">
                              None
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="font-semibold text-xs">
                          {refund?.amount ? `₹${refund.amount}` : "₹0"}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground max-w-[240px]">
                          <div className="font-medium text-foreground truncate">
                            {refund?.reason || "Cancelled before cutoff"}
                          </div>
                          {refund?.notes && (
                            <div className="text-[11px] truncate italic">{refund.notes}</div>
                          )}
                          {refund?.razorpayRefundId && (
                            <div className="font-mono text-[10px] text-muted-foreground truncate">
                              ID: {refund.razorpayRefundId}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="xs"
                              className="h-7 text-xs"
                              onClick={() => setDetailsModalOrder(order)}
                            >
                              Details
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-7 w-7"
                              onClick={() => setBillModalOrderId(order.id)}
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Details & Bill Modals */}
      <OrderDetailsModal
        order={detailsModalOrder}
        open={!!detailsModalOrder}
        onOpenChange={(open) => !open && setDetailsModalOrder(null)}
        onPrintBill={(orderId) => setBillModalOrderId(orderId)}
      />

      <KitchenBillModal
        orderId={billModalOrderId}
        open={!!billModalOrderId}
        onOpenChange={(open) => !open && setBillModalOrderId(null)}
      />
    </div>
  );
}
