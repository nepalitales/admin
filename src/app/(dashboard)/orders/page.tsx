"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getOrders,
  updateOrderStatus,
  autoPrepareOrders,
  type Order,
  type OrderStatus,
} from "@/lib/api";
import { useOrderEvents } from "@/hooks/use-order-events";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { KitchenBillModal } from "@/components/orders/kitchen-bill-modal";
import { CancelOrderModal } from "@/components/orders/cancel-order-modal";
import { OrderDetailsModal } from "@/components/orders/order-details-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  RefreshCw,
  Printer,
  Truck,
  Clock,
  MoreVertical,
  ExternalLink,
  RotateCw,
  Ban,
  CheckCircle2,
  UtensilsCrossed,
  Sparkles,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modals state
  const [billModalOrderId, setBillModalOrderId] = useState<string | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [detailsModalOrder, setDetailsModalOrder] = useState<Order | null>(null);

  // Live order counts
  const [counts, setCounts] = useState({ placed: 0, preparing: 0, ready: 0 });

  const fetchOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await getOrders({
        status: statusTab === "all" ? undefined : statusTab,
        search: search.trim() || undefined,
        limit: 50,
      });
      setOrders(res.orders);
      if (res.counts) {
        setCounts(res.counts);
      }
    } catch (err: any) {
      if (!quiet) {
        toast.error("Failed to load orders: " + err.message);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [statusTab, search]);

  // Connect Real-Time Server-Sent Events stream!
  const { isConnected } = useOrderEvents({
    onOrderChange: () => {
      // Re-fetch quietly when any order event arrives
      fetchOrders(true);
    },
    enableToasts: true,
  });

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Status transitions
  const handleStatusChange = async (orderId: string, targetStatus: OrderStatus) => {
    setActionLoadingId(orderId);
    try {
      const res = await updateOrderStatus(orderId, targetStatus);
      toast.success(res.message || `Order status updated to ${targetStatus}`);
      fetchOrders(true);
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAutoPrepare = async () => {
    try {
      const res = await autoPrepareOrders();
      if (res.count > 0) {
        toast.success(`Transitioned ${res.count} order(s) to 'preparing'!`);
        fetchOrders(true);
      } else {
        toast.info("No placed orders with closed windows to transition.");
      }
    } catch (err: any) {
      toast.error("Failed to auto-prepare orders: " + err.message);
    }
  };

  // Summary card items
  const summaryCards = [
    {
      title: "New Confirmed Orders",
      value: counts.placed,
      desc: "Awaiting preparation",
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      title: "Cooking / In Kitchen",
      value: counts.preparing,
      desc: "Currently preparing",
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      title: "Ready for Dispatch / Pickup",
      value: counts.ready,
      desc: "Packed & email notified",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">Order Management</h2>
            {isConnected ? (
              <Badge variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs py-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Real-Time SSE
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 border-zinc-600 text-zinc-400 text-xs py-0.5">
                <span className="h-2 w-2 rounded-full bg-zinc-500" />
                Connecting Feed...
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Monitor incoming customer orders, print thermal receipts, and manage preparation and deliveries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoPrepare}
            className="text-xs gap-1.5 border-amber-500/40 text-amber-400 hover:text-amber-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Auto-Prepare Batch
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders(false)}
            className="text-xs gap-1.5"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <Card key={card.title} className={`border ${card.bg}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{card.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs
          value={statusTab}
          onValueChange={(val) => setStatusTab(val)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-3 sm:flex w-full">
            <TabsTrigger value="all">All Orders</TabsTrigger>
            <TabsTrigger value="placed">Placed</TabsTrigger>
            <TabsTrigger value="preparing">Preparing</TabsTrigger>
            <TabsTrigger value="ready">Ready</TabsTrigger>
            <TabsTrigger value="out_for_delivery">Out for Delivery</TabsTrigger>
            <TabsTrigger value="delivered">Delivered</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search Order #, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items & Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fulfillment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <UtensilsCrossed className="h-8 w-8 mb-2 opacity-40" />
                        <p className="font-medium text-sm">No orders found</p>
                        <p className="text-xs">Incoming orders will appear here automatically in real time.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => {
                    const isRowBusy = actionLoadingId === order.id;
                    const isPickup = (order.orderType || "delivery") === "pickup";

                    return (
                      <TableRow key={order.id} className="hover:bg-muted/40 transition-colors">
                        {/* Order Number & Timestamp */}
                        <TableCell className="font-mono font-medium">
                          <div>{order.orderNumber}</div>
                          <div className="text-[10px] text-muted-foreground font-sans">
                            {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-sans">
                              {isPickup ? "Pickup" : "Delivery"}
                            </Badge>
                            {order.dispatchSlot?.label && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary bg-primary/5 font-sans whitespace-nowrap flex items-center gap-1">
                                {isPickup ? <Store className="h-2.5 w-2.5" /> : <Truck className="h-2.5 w-2.5" />}
                                <span>{order.dispatchSlot.label}</span>
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Customer Info */}
                        <TableCell>
                          <div className="font-medium text-xs">{order.customer.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {order.customer.email || order.customer.phone}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={order.deliveryAddress.borzoFormat.address}>
                            {isPickup ? "Kitchen pickup" : order.deliveryAddress.borzoFormat.address}
                          </div>
                        </TableCell>

                        {/* Items & Amount */}
                        <TableCell>
                          <div className="font-semibold text-xs">₹{order.totalAmount}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {order.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                          </div>
                        </TableCell>

                        {/* Status Badge */}
                        <TableCell>
                          <OrderStatusBadge status={order.status} />
                        </TableCell>

                        {/* Fulfillment Status */}
                        <TableCell>
                          {isPickup ? (
                            <div>
                              <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400 bg-purple-500/5">
                                Self Pickup
                              </Badge>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {order.status === "ready" ? "Ready at kitchen" : order.status === "delivered" ? "Collected" : "In kitchen"}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <Badge variant="outline" className="text-[10px] border-sky-500/30 text-sky-400 bg-sky-500/5">
                                Doorstep Delivery
                              </Badge>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {order.status === "ready" ? (
                                  <span className="text-amber-400 font-medium">Ready to dispatch</span>
                                ) : order.status === "out_for_delivery" ? (
                                  <span className="text-sky-400 font-medium">Out for delivery</span>
                                ) : order.status === "delivered" ? (
                                  <span className="text-emerald-400 font-medium">Delivered</span>
                                ) : (
                                  "Manual rider dispatch"
                                )}
                              </div>
                            </div>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Print Bill Button */}
                            <Button
                              variant="outline"
                              size="icon-sm"
                              title="Print Kitchen Bill"
                              onClick={() => setBillModalOrderId(order.id)}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>

                            {/* Mark Preparing */}
                            {order.status === "placed" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 text-xs gap-1 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                                onClick={() => handleStatusChange(order.id, "preparing")}
                                disabled={isRowBusy}
                              >
                                <Clock className="h-3.5 w-3.5" />
                                Cook
                              </Button>
                            )}

                            {/* Mark Ready */}
                            {order.status === "preparing" && (
                              <Button
                                size="sm"
                                className="h-8 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                                onClick={() => handleStatusChange(order.id, "ready")}
                                disabled={isRowBusy}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {isPickup ? "Ready for Pickup" : "Mark Ready"}
                              </Button>
                            )}

                            {/* When Ready */}
                            {order.status === "ready" && (
                              <>
                                {!isPickup && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 text-xs gap-1 bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 border border-sky-500/30"
                                    onClick={() => handleStatusChange(order.id, "out_for_delivery")}
                                    disabled={isRowBusy}
                                  >
                                    <Truck className="h-3.5 w-3.5" />
                                    Dispatch
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs gap-1 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10"
                                  onClick={() => handleStatusChange(order.id, "delivered")}
                                  disabled={isRowBusy}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {isPickup ? "Collected" : "Delivered"}
                                </Button>
                              </>
                            )}

                            {/* When Out for Delivery */}
                            {(order.status === "out_for_delivery" || order.status === "porter_booked") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10"
                                onClick={() => handleStatusChange(order.id, "delivered")}
                                disabled={isRowBusy}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Delivered
                              </Button>
                            )}

                            {/* More Actions Dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="icon-sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align="end" className="w-48 text-xs">
                                <DropdownMenuItem onClick={() => setDetailsModalOrder(order)}>
                                  View Full Order Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setBillModalOrderId(order.id)}>
                                  <Printer className="mr-2 h-3.5 w-3.5" />
                                  Print Thermal Receipt
                                </DropdownMenuItem>
                                {order.status === "ready" && !isPickup && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(order.id, "out_for_delivery")}>
                                    <Truck className="mr-2 h-3.5 w-3.5" />
                                    Mark Out for Delivery
                                  </DropdownMenuItem>
                                )}
                                {(order.status === "ready" || order.status === "out_for_delivery" || order.status === "porter_booked") && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(order.id, "delivered")}>
                                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                    Mark Delivered / Closed
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {order.status !== "delivered" &&
                                  order.status !== "cancelled_by_customer" &&
                                  order.status !== "cancelled_by_admin" && (
                                    <DropdownMenuItem
                                      onClick={() => setCancelModalOrder(order)}
                                      className="text-rose-400"
                                    >
                                      <Ban className="mr-2 h-3.5 w-3.5" />
                                      Cancel Order & Refund
                                    </DropdownMenuItem>
                                  )}
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      {/* Kitchen Bill Modal */}
      <KitchenBillModal
        orderId={billModalOrderId}
        open={!!billModalOrderId}
        onOpenChange={(open) => !open && setBillModalOrderId(null)}
      />

      {/* Cancel Order Modal */}
      <CancelOrderModal
        order={cancelModalOrder}
        open={!!cancelModalOrder}
        onOpenChange={(open) => !open && setCancelModalOrder(null)}
        onCancelled={() => fetchOrders(true)}
      />

      {/* Full Order Details Modal */}
      <OrderDetailsModal
        order={detailsModalOrder}
        open={!!detailsModalOrder}
        onOpenChange={(open) => !open && setDetailsModalOrder(null)}
        onPrintBill={(orderId) => setBillModalOrderId(orderId)}
        onCancelOrder={(ord) => setCancelModalOrder(ord)}
        onUpdateStatus={(orderId, st) => handleStatusChange(orderId, st)}
      />
    </div>
  );
}
