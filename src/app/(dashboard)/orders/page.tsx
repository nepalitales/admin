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
import { CourierDispatchModal } from "@/components/orders/courier-dispatch-modal";
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
import type { Order as OrderType_API } from "@/lib/api";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
  const [windowFilter, setWindowFilter] = useState<"today" | "all">("today");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modals state
  const [billModalOrderId, setBillModalOrderId] = useState<string | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [detailsModalOrder, setDetailsModalOrder] = useState<Order | null>(null);
  const [courierModalOrder, setCourierModalOrder] = useState<Order | null>(null);

  // Track expanded items state per order for compact pill rendering
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleOrderItems = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Live order counts
  const [counts, setCounts] = useState({ placed: 0, preparing: 0, ready: 0 });

  // Today's date string in IST ("YYYY-MM-DD")
  const todayISTDateStr = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, []);

  const todayISTDisplay = useMemo(() => {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date());
  }, []);

  // Filter orders received in today's ordering window
  const isOrderFromTodayWindow = useCallback((orderCreatedAt: string) => {
    try {
      const orderDateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(orderCreatedAt));
      return orderDateStr === todayISTDateStr;
    } catch {
      return false;
    }
  }, [todayISTDateStr]);

  const todayOrders = useMemo(() => {
    return orders.filter((o) => isOrderFromTodayWindow(o.createdAt));
  }, [orders, isOrderFromTodayWindow]);

  const displayedOrders = useMemo(() => {
    if (windowFilter === "today") {
      return todayOrders;
    }
    return orders;
  }, [orders, todayOrders, windowFilter]);

  const fetchOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      // Fetch up to 100 orders so all today's window orders (max 70 capacity) are loaded
      const res = await getOrders({
        status: statusTab === "all" ? undefined : statusTab,
        search: search.trim() || undefined,
        limit: 100,
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

  /**
   * Print Orders Summary Sheet — A4-optimised summary.
   * Prints all orders received in today's ordering window with order ID,
   * customer info, all items, pricing, status, and delivery type.
   */
  const handlePrintAllOrders = () => {
    const targetOrders = windowFilter === "today" ? todayOrders : (displayedOrders.length > 0 ? displayedOrders : orders);

    if (targetOrders.length === 0) {
      toast.info(windowFilter === "today" ? "No orders received in today's window yet." : "No orders to print.");
      return;
    }

    const todayIST = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date());

    const formatTime = (iso: string) =>
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(iso));

    const statusLabel = (s: string) => {
      const map: Record<string, string> = {
        pending_payment: "Pending Payment",
        placed: "Placed",
        preparing: "Preparing",
        ready: "Ready",
        out_for_delivery: "Out for Delivery",
        porter_booked: "Porter Booked",
        delivered: "Delivered",
        cancelled_by_customer: "Cancelled (Customer)",
        cancelled_by_admin: "Cancelled (Admin)",
      };
      return map[s] || s;
    };

    const totalRevenue = targetOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalItems = targetOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
      0,
    );

    const orderRows = targetOrders
      .map((o) => {
        const isPickup = (o.orderType || "delivery") === "pickup";
        const formattedAddress = isPickup
          ? "Self Pickup (Kitchen Counter)"
          : o.deliveryAddress?.borzoFormat?.address ||
            [
              o.deliveryAddress?.apartment ? `Apt ${o.deliveryAddress.apartment}` : "",
              o.deliveryAddress?.building,
              o.deliveryAddress?.street,
              o.deliveryAddress?.landmark ? `Near ${o.deliveryAddress.landmark}` : "",
              o.deliveryAddress?.city,
              o.deliveryAddress?.pincode,
            ]
              .filter(Boolean)
              .join(", ") || "—";

        const itemsList = o.items
          .map((item) => {
            const addonText =
              item.addons && item.addons.length > 0
                ? ` <span style="color:#6b7280;font-size:9px;">(+${item.addons.map((a) => `${a.quantity}x ${a.name}`).join(", ")})</span>`
                : "";
            return `
              <div style="margin-bottom:3px;font-size:11px;line-height:1.3;">
                <strong>${item.quantity}x</strong> ${item.productName}${addonText}
                <span style="color:#6b7280;font-size:10px;">· ₹${item.price} each</span>
              </div>
            `;
          })
          .join("");

        const notesHtml = o.notes
          ? `<div style="margin-top:4px;padding:3px 6px;background:#fef3c7;border-left:3px solid #f59e0b;font-size:9px;color:#92400e;border-radius:2px;">
              <strong>Note:</strong> ${o.notes}
            </div>`
          : "";

        return `
          <tr style="page-break-inside:avoid;">
            <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top;white-space:nowrap;">
              <div style="font-weight:700;font-size:13px;font-family:monospace;">${o.orderNumber}</div>
              <div style="font-size:10px;color:#6b7280;margin-top:2px;">${formatTime(o.createdAt)}</div>
              <div style="font-size:9px;color:#9ca3af;font-family:monospace;margin-top:2px;">${o.id.slice(-8)}</div>
            </td>
            <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top;max-width:200px;">
              <div style="font-weight:700;font-size:12px;">${o.customer.name}</div>
              <div style="font-size:10px;color:#4b5563;margin-top:1px;">📞 ${o.customer.phone}</div>
              ${o.customer.email ? `<div style="font-size:10px;color:#6b7280;">✉️ ${o.customer.email}</div>` : ""}
              <div style="font-size:10px;color:#4b5563;margin-top:3px;line-height:1.2;">
                📍 <strong>${isPickup ? "Pickup:" : "Delivery:"}</strong> ${formattedAddress}
              </div>
              ${notesHtml}
            </td>
            <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top;max-width:240px;">
              ${itemsList}
            </td>
            <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top;text-align:right;white-space:nowrap;">
              <div style="font-weight:800;font-size:13px;">₹${o.totalAmount}</div>
              <div style="font-size:9px;color:#6b7280;margin-top:2px;">Items: ₹${o.itemTotal}</div>
              ${o.deliveryFee > 0 ? `<div style="font-size:9px;color:#6b7280;">Delivery: ₹${o.deliveryFee}</div>` : ""}
              ${o.discount > 0 ? `<div style="font-size:9px;color:#059669;">Discount: -₹${o.discount}</div>` : ""}
              <div style="font-size:9px;color:#2563eb;font-weight:600;margin-top:2px;">Paid (Razorpay)</div>
            </td>
            <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top;text-align:center;white-space:nowrap;">
              <span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${
                o.status === "delivered"
                  ? "#d1fae5"
                  : o.status === "preparing"
                  ? "#fef3c7"
                  : o.status === "ready"
                  ? "#dbeafe"
                  : o.status === "placed"
                  ? "#e0e7ff"
                  : o.status.startsWith("cancelled")
                  ? "#fee2e2"
                  : "#f3f4f6"
              };color:${
                o.status === "delivered"
                  ? "#065f46"
                  : o.status === "preparing"
                  ? "#92400e"
                  : o.status === "ready"
                  ? "#1e40af"
                  : o.status === "placed"
                  ? "#3730a3"
                  : o.status.startsWith("cancelled")
                  ? "#991b1b"
                  : "#374151"
              };">${statusLabel(o.status)}</span>
            </td>
            <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top;text-align:center;white-space:nowrap;">
              <span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${
                isPickup ? "#f3e8ff" : "#e0f2fe"
              };color:${isPickup ? "#6b21a8" : "#0369a1"};">${isPickup ? "Self Pickup" : "Delivery"}</span>
              ${
                o.dispatchSlot?.label
                  ? `<div style="font-size:9px;color:#4b5563;font-weight:600;margin-top:3px;">🕒 ${o.dispatchSlot.label}</div>`
                  : ""
              }
            </td>
          </tr>
        `;
      })
      .join("");

    const printTitle =
      windowFilter === "today"
        ? `Nepali Tales — Today's Ordering Window (${todayIST})`
        : `Nepali Tales — Orders Summary (${todayIST})`;

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${printTitle}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm 6mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #111827; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin-top: 4px; }
            th { text-align: left; padding: 8px 6px; border-bottom: 2px solid #111827; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; background: #f9fafb; }
            .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid #111827; }
            .header h1 { margin: 0; font-size: 18px; font-weight: 800; color: #111827; }
            .header .meta { text-align: right; font-size: 11px; color: #6b7280; }
            .summary-bar { display: flex; gap: 16px; margin-bottom: 8px; }
            .summary-item { padding: 6px 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; }
            .summary-item .label { font-size: 9px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; font-weight: 600; }
            .summary-item .value { font-size: 15px; font-weight: 800; margin-top: 1px; color: #111827; }
            tr { page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${printTitle}</h1>
              <div style="font-size:11px;color:#6b7280;margin-top:2px;">
                ${windowFilter === "today" ? "Orders received in today's ordering window" : "Admin orders summary"} · Printed on ${todayIST} at ${formatTime(new Date().toISOString())}
              </div>
            </div>
            <div class="meta">
              <div style="font-weight:800;font-size:13px;color:#111827;">Nepali Tales</div>
              <div>admin.nepalitales.com</div>
            </div>
          </div>

          <div class="summary-bar">
            <div class="summary-item">
              <div class="label">Total Orders</div>
              <div class="value">${targetOrders.length}</div>
            </div>
            <div class="summary-item">
              <div class="label">Total Revenue</div>
              <div class="value">₹${totalRevenue.toLocaleString("en-IN")}</div>
            </div>
            <div class="summary-item">
              <div class="label">Total Food Items</div>
              <div class="value">${totalItems}</div>
            </div>
            <div class="summary-item">
              <div class="label">Doorstep Delivery</div>
              <div class="value">${targetOrders.filter((o) => (o.orderType || "delivery") === "delivery").length}</div>
            </div>
            <div class="summary-item">
              <div class="label">Self Pickup</div>
              <div class="value">${targetOrders.filter((o) => o.orderType === "pickup").length}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:90px;">Order #</th>
                <th style="width:200px;">Customer & Address</th>
                <th>Items Ordered</th>
                <th style="width:100px;text-align:right;">Pricing</th>
                <th style="width:90px;text-align:center;">Status</th>
                <th style="width:110px;text-align:center;">Delivery Type</th>
              </tr>
            </thead>
            <tbody>
              ${orderRows}
            </tbody>
          </table>

          <div style="margin-top:14px;padding-top:8px;border-top:1px solid #d1d5db;display:flex;justify-content:space-between;font-size:10px;color:#6b7280;page-break-inside:avoid;">
            <span>Nepali Tales Kitchen · Metropolis Riveria, Kasarvadavali, Ghodbunder Road, Thane 400615</span>
            <span>Helpline: +91 76780 97659</span>
          </div>
        </body>
      </html>
    `;

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.left = "-9999px";
    printFrame.style.top = "0";
    printFrame.style.width = "1200px";
    printFrame.style.height = "1000px";
    printFrame.style.border = "none";
    printFrame.style.opacity = "0";
    printFrame.style.pointerEvents = "none";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) {
      const blob = new Blob([printHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
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
      }, 2000);
    }, 300);
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
                Live Sync Active
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 border-zinc-600 text-zinc-400 text-xs py-0.5">
                <span className="h-2 w-2 rounded-full bg-zinc-500" />
                Syncing Feed...
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
            onClick={handlePrintAllOrders}
            className="text-xs gap-1.5 border-emerald-500/40 text-emerald-400 hover:text-emerald-300"
            disabled={(windowFilter === "today" ? todayOrders.length : displayedOrders.length) === 0}
          >
            <Printer className="h-3.5 w-3.5" />
            {windowFilter === "today"
              ? `Print Today's Orders (${todayOrders.length})`
              : `Print All Orders (${displayedOrders.length})`}
          </Button>
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

      {/* Scope Selector: Today's Window Orders vs All Loaded Orders */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/60 p-2.5 rounded-lg border">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant={windowFilter === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => setWindowFilter("today")}
            className="text-xs h-8 gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" />
            Today&apos;s Window Orders
            <Badge
              variant="secondary"
              className={`ml-1 px-1.5 py-0 text-[10px] font-bold ${
                windowFilter === "today" ? "bg-primary-foreground/20 text-primary-foreground" : ""
              }`}
            >
              {todayOrders.length}
            </Badge>
          </Button>
          <Button
            type="button"
            variant={windowFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setWindowFilter("all")}
            className="text-xs h-8 gap-1.5"
          >
            All Loaded Orders
            <Badge
              variant="secondary"
              className={`ml-1 px-1.5 py-0 text-[10px] font-bold ${
                windowFilter === "all" ? "bg-primary-foreground/20 text-primary-foreground" : ""
              }`}
            >
              {orders.length}
            </Badge>
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          {windowFilter === "today" ? (
            <span>
              Showing orders received in today&apos;s ordering window ({todayISTDisplay})
            </span>
          ) : (
            <span>Showing all recent orders ({orders.length} total)</span>
          )}
        </div>
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
                  <TableHead className="w-[180px]">Customer</TableHead>
                  <TableHead className="min-w-[200px] max-w-[280px]">Items & Total</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[130px]">Fulfillment</TableHead>
                  <TableHead className="text-right w-[160px]">Actions</TableHead>
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
                ) : displayedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <UtensilsCrossed className="h-8 w-8 mb-2 opacity-40" />
                        <p className="font-medium text-sm">
                          {windowFilter === "today"
                            ? "No orders received in today's window yet"
                            : "No orders found"}
                        </p>
                        <p className="text-xs">
                          {windowFilter === "today"
                            ? "Incoming orders from today's window will appear here automatically."
                            : "Incoming orders will appear here automatically in real time."}
                        </p>
                        {windowFilter === "today" && orders.length > 0 && (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => setWindowFilter("all")}
                            className="mt-2 text-xs text-primary"
                          >
                            View all {orders.length} historical orders
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedOrders.map((order) => {
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
                        <TableCell className="max-w-[180px]">
                          <div className="font-medium text-xs truncate" title={order.customer.name}>
                            {order.customer.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate" title={order.customer.email || order.customer.phone}>
                            {order.customer.email || order.customer.phone}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate" title={order.deliveryAddress.borzoFormat.address}>
                            {isPickup ? "Kitchen pickup" : order.deliveryAddress.borzoFormat.address}
                          </div>
                        </TableCell>

                        {/* Items & Amount */}
                        <TableCell className="max-w-[280px]">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="font-bold text-xs text-foreground">₹{order.totalAmount}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium text-muted-foreground">
                              {order.items.reduce((sum, item) => sum + item.quantity, 0)} {order.items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? "item" : "items"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 max-w-[270px]">
                            {(expandedOrders[order.id] ? order.items : order.items.slice(0, 3)).map((item, idx) => {
                              const addonCount = item.addons?.reduce((sum, a) => sum + a.quantity, 0) || 0;
                              return (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted/80 text-foreground border border-border/60 hover:bg-muted transition-colors leading-tight"
                                  title={addonCount > 0 ? `${item.productName} (+${addonCount} add-on${addonCount > 1 ? "s" : ""})` : item.productName}
                                >
                                  <span className="font-bold text-primary mr-1">{item.quantity}x</span>
                                  <span className="truncate max-w-[120px]">{item.productName}</span>
                                  {addonCount > 0 && (
                                    <span className="ml-1 text-[9px] text-muted-foreground font-mono">+{addonCount}</span>
                                  )}
                                </span>
                              );
                            })}
                            {order.items.length > 3 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleOrderItems(order.id);
                                }}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 transition-colors cursor-pointer"
                              >
                                {expandedOrders[order.id]
                                  ? "Less"
                                  : `+${order.items.length - 3} more`}
                              </button>
                            )}
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
                                    onClick={() => setCourierModalOrder(order)}
                                    disabled={isRowBusy}
                                  >
                                    <Truck className="h-3.5 w-3.5" />
                                    Book Courier
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
                              <>
                                {!isPickup && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-xs gap-1 text-sky-400 hover:bg-sky-500/10"
                                    onClick={() => setCourierModalOrder(order)}
                                    disabled={isRowBusy}
                                    title="View / update courier tracking and resend WhatsApp"
                                  >
                                    <Truck className="h-3.5 w-3.5" />
                                    Courier
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
                                  Delivered
                                </Button>
                              </>
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
                              <DropdownMenuContent align="end" className="w-52 text-xs">
                                <DropdownMenuItem onClick={() => setDetailsModalOrder(order)}>
                                  View Full Order Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setBillModalOrderId(order.id)}>
                                  <Printer className="mr-2 h-3.5 w-3.5" />
                                  Print Thermal Receipt
                                </DropdownMenuItem>
                                {!isPickup &&
                                  order.status !== "delivered" &&
                                  order.status !== "cancelled_by_customer" &&
                                  order.status !== "cancelled_by_admin" && (
                                    <DropdownMenuItem
                                      onClick={() => setCourierModalOrder(order)}
                                      className="text-sky-400"
                                    >
                                      <Truck className="mr-2 h-3.5 w-3.5" />
                                      Book Borzo / Porter Courier
                                    </DropdownMenuItem>
                                  )}
                                {order.status === "ready" && !isPickup && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(order.id, "out_for_delivery")}>
                                    <Truck className="mr-2 h-3.5 w-3.5" />
                                    Mark Out for Delivery (Direct)
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
        onBookCourier={(ord) => setCourierModalOrder(ord)}
      />

      {/* Courier Dispatch & WhatsApp Modal */}
      <CourierDispatchModal
        order={courierModalOrder}
        open={!!courierModalOrder}
        onOpenChange={(open) => !open && setCourierModalOrder(null)}
        onSuccess={() => fetchOrders(true)}
      />
    </div>
  );
}
