"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getOrders,
  updateOrderStatus,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
  Store,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarCheck,
  FileSpreadsheet,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

/**
 * Format a Date object to "YYYY-MM-DD" in local/IST string.
 */
function formatDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Cleanly exports orders to CSV with UTF-8 BOM for Microsoft Excel & Google Sheets compatibility.
 */
function exportOrdersToCsv(orders: Order[], dateDisplay: string) {
  if (orders.length === 0) {
    toast.info("No orders to export for this date.");
    return;
  }

  const headers = [
    "Order #",
    "Date",
    "Time",
    "Customer Name",
    "Customer Phone",
    "Customer Email",
    "Order Type",
    "Status",
    "Delivery Address",
    "Items Breakdown",
    "Total Items Qty",
    "Subtotal (INR)",
    "Delivery Fee (INR)",
    "Discount (INR)",
    "Total Amount (INR)",
    "Payment Mode",
    "Payment Status",
    "Dispatch Slot",
    "Customer Notes",
  ];

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = orders.map((o) => {
    const isPickup = (o.orderType || "delivery") === "pickup";
    const dateFormatted = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(o.createdAt));

    const timeFormatted = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(o.createdAt));

    const itemsSummary = o.items
      .map((i) => {
        const addonStr =
          i.addons && i.addons.length > 0
            ? ` (+${i.addons.map((a) => `${a.quantity}x ${a.name}`).join(", ")})`
            : "";
        return `${i.quantity}x ${i.productName}${addonStr}`;
      })
      .join("; ");

    const totalItemsQty = o.items.reduce((sum, i) => sum + i.quantity, 0);

    const fullAddr = isPickup
      ? "Self Pickup (Kitchen Counter - Metropolis Rivera Shop 10)"
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

    return [
      escapeCsv(o.orderNumber),
      escapeCsv(dateFormatted),
      escapeCsv(timeFormatted),
      escapeCsv(o.customer.name),
      escapeCsv(o.customer.phone),
      escapeCsv(o.customer.email || ""),
      escapeCsv(isPickup ? "Pickup" : "Delivery"),
      escapeCsv(o.status),
      escapeCsv(fullAddr),
      escapeCsv(itemsSummary),
      totalItemsQty,
      o.itemTotal,
      o.deliveryFee,
      o.discount,
      o.totalAmount,
      escapeCsv(o.payment?.mode || o.payment?.provider || "Razorpay"),
      escapeCsv(o.payment?.status || "PAID"),
      escapeCsv(o.dispatchSlot?.label || o.dispatchDate || ""),
      escapeCsv(o.notes || ""),
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Nepali_Tales_Orders_${dateDisplay.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success(`Exported ${orders.length} order(s) to Excel sheet!`);
}

export default function OrdersPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
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

  const selectedDateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);

  const isToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  const formattedDateDisplay = useMemo(() => {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(selectedDate);
  }, [selectedDate]);

  const formattedDayFull = useMemo(() => {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(selectedDate);
  }, [selectedDate]);

  // Live order counts for selected date
  const [counts, setCounts] = useState({
    all: 0,
    placed: 0,
    preparing: 0,
    ready: 0,
    outForDelivery: 0,
    delivered: 0,
  });

  const fetchOrders = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const res = await getOrders({
          status: statusTab === "all" ? undefined : statusTab,
          date: selectedDateKey,
          search: search.trim() || undefined,
          limit: 300,
        });
        setOrders(res.orders);
        if (res.counts) {
          setCounts({
            all: res.counts.all || res.orders.length,
            placed: res.counts.placed || 0,
            preparing: res.counts.preparing || 0,
            ready: res.counts.ready || 0,
            outForDelivery: res.counts.outForDelivery || 0,
            delivered: res.counts.delivered || 0,
          });
        }
      } catch (err: any) {
        if (!quiet) {
          toast.error("Failed to load orders: " + (err.message || "Unknown error"));
        }
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [statusTab, selectedDateKey, search],
  );

  // Connect Real-Time Server-Sent Events / Live polling stream when on Today!
  useOrderEvents({
    onOrderChange: () => {
      // Re-fetch quietly when any order event arrives on today's view
      if (isToday) {
        fetchOrders(true);
      }
    },
    enableToasts: isToday,
  });

  // Background interval polling for Today's view to keep orders live in real time
  useEffect(() => {
    fetchOrders();

    if (!isToday) return;

    const interval = setInterval(() => {
      fetchOrders(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchOrders, isToday]);

  const handleShiftDay = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    if (next > new Date()) return;
    setSelectedDate(next);
  };

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

  /**
   * Print Orders Summary Sheet — A4-optimised summary for the selected day.
   */
  const handlePrintAllOrders = () => {
    if (orders.length === 0) {
      toast.info(`No orders found on ${formattedDateDisplay} to print.`);
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

    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalItems = orders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
      0,
    );

    const orderRows = orders
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
            <td style="padding:7px 5px;border-bottom:1px solid #e5e7eb;vertical-align:top;white-space:nowrap;">
              <div style="font-weight:700;font-size:12px;font-family:monospace;">${o.orderNumber}</div>
              <div style="font-size:10px;color:#6b7280;margin-top:2px;">${formatTime(o.createdAt)}</div>
              <div style="font-size:9px;color:#9ca3af;font-family:monospace;margin-top:2px;">${o.id.slice(-8)}</div>
            </td>
            <td style="padding:7px 5px;border-bottom:1px solid #e5e7eb;vertical-align:top;max-width:180px;">
              <div style="font-weight:700;font-size:11px;">${o.customer.name}</div>
              <div style="font-size:10px;color:#111827;font-weight:600;margin-top:1px;">Ph: ${o.customer.phone || "—"}</div>
              ${o.customer.email ? `<div style="font-size:9px;color:#6b7280;">Email: ${o.customer.email}</div>` : ""}
              <div style="font-size:10px;color:#4b5563;margin-top:2px;line-height:1.2;">
                <strong>${isPickup ? "Pickup:" : "Delivery:"}</strong> ${formattedAddress}
              </div>
              ${notesHtml}
            </td>
            <td style="padding:7px 5px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
              ${itemsList}
            </td>
            <td style="padding:7px 5px;border-bottom:1px solid #e5e7eb;vertical-align:top;text-align:right;white-space:nowrap;">
              <div style="font-weight:800;font-size:12px;">₹${o.totalAmount}</div>
              <div style="font-size:9px;color:#6b7280;margin-top:1px;">Items: ₹${o.itemTotal}</div>
              ${o.deliveryFee > 0 ? `<div style="font-size:9px;color:#6b7280;">Del: ₹${o.deliveryFee}</div>` : ""}
              ${o.discount > 0 ? `<div style="font-size:9px;color:#059669;">Disc: -₹${o.discount}</div>` : ""}
              <div style="font-size:9px;color:#2563eb;font-weight:600;margin-top:2px;">Paid (${o.payment?.mode || o.payment?.provider || "Online"})</div>
            </td>
            <td style="padding:7px 5px;border-bottom:1px solid #e5e7eb;vertical-align:top;text-align:center;white-space:nowrap;">
              <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;background:${
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
              };">
                ${statusLabel(o.status)}
              </span>
              <div style="font-size:9px;color:#6b7280;margin-top:3px;">
                ${isPickup ? "Counter Pickup" : "Delivery"}
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    const printTitle = `Nepali Tales — Orders Summary (${formattedDayFull})`;

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${printTitle}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 8mm 10mm 8mm;
            }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            html, body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #111827;
              background: #ffffff;
              font-size: 11px;
            }
            .header {
              border-bottom: 2px solid #111827;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .header h1 {
              margin: 0 0 2px 0;
              font-size: 16px;
              font-weight: 800;
              letter-spacing: -0.3px;
            }
            .header .meta {
              font-size: 10px;
              color: #4b5563;
            }
            .stats-bar {
              display: flex;
              gap: 16px;
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 4px;
              padding: 6px 12px;
              margin-bottom: 12px;
              font-size: 10px;
            }
            .stats-bar strong {
              color: #111827;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th {
              background: #f3f4f6;
              padding: 6px 5px;
              text-align: left;
              font-size: 10px;
              font-weight: 700;
              color: #374151;
              border-bottom: 1.5px solid #d1d5db;
              border-top: 1px solid #e5e7eb;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            th.right { text-align: right; }
            th.center { text-align: center; }
            .footer {
              margin-top: 14px;
              padding-top: 8px;
              border-top: 1px solid #e5e7eb;
              display: flex;
              justify-content: space-between;
              font-size: 9px;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${printTitle}</h1>
            <div class="meta">
              Orders for ${formattedDayFull} · Printed on ${todayIST} at ${formatTime(new Date().toISOString())}
            </div>
          </div>

          <div class="stats-bar">
            <div>Total Orders: <strong>${orders.length}</strong></div>
            <div>Total Items Sold: <strong>${totalItems}</strong></div>
            <div>Total Revenue: <strong>₹${totalRevenue.toLocaleString("en-IN")}</strong></div>
            <div>Kitchen Address: <strong>Shop 10, Metropolis Rivera, Kasarvadavali, Thane</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:18%;">Order / Time</th>
                <th style="width:30%;">Customer & Delivery</th>
                <th style="width:30%;">Items & Addons</th>
                <th class="right" style="width:12%;">Payment</th>
                <th class="center" style="width:10%;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${orderRows}
            </tbody>
          </table>

          <div class="footer">
            <span>Nepali Tales — Authentic Nepali Momo &amp; Artisanal Chilli Oil</span>
            <span>Kitchen Contact: +91 76780 97659</span>
          </div>
        </body>
      </html>
    `;

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.left = "-9999px";
    printFrame.style.top = "0";
    printFrame.style.width = "900px";
    printFrame.style.height = "1200px";
    printFrame.style.border = "none";
    printFrame.style.opacity = "0";
    printFrame.style.pointerEvents = "none";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) {
      const blob = new Blob([printHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      w?.addEventListener("load", () => w.print());
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
    }, 400);
  };

  const summaryCards = [
    {
      title: "New Confirmed Orders",
      value: counts.placed,
      desc: "Awaiting preparation",
      color: "text-blue-500",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      title: "Cooking / In Kitchen",
      value: counts.preparing,
      desc: "Currently preparing",
      color: "text-amber-500",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      title: "Ready for Dispatch / Pickup",
      value: counts.ready,
      desc: "Packed & email notified",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
  ];

  return (
    <div className="space-y-5 pb-12">
      {/* ─── Header & Top Actions ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight">Order Management</h2>
            {isToday ? (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 text-xs gap-1.5 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Sync Active
              </Badge>
            ) : (
              <Badge variant="outline" className="border-border text-muted-foreground text-xs gap-1">
                <Clock className="h-3 w-3 text-primary" />
                Historical ({formattedDayFull})
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Monitor incoming customer orders, print thermal receipts, and manage preparation and deliveries day-by-day.
          </p>
        </div>

        {/* Action Buttons: Print, Excel Export, Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Print Day's Orders Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrintAllOrders}
            className="text-xs gap-1.5 h-8 border-border bg-card hover:bg-muted"
            title={`Print A4 summary sheet of all orders for ${formattedDateDisplay}`}
          >
            <Printer className="h-3.5 w-3.5 text-primary" />
            <span>Print Orders ({orders.length})</span>
          </Button>

          {/* Download Excel Sheet (CSV) Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportOrdersToCsv(orders, selectedDateKey)}
            className="text-xs gap-1.5 h-8 border-border bg-card hover:bg-muted"
            title={`Download CSV Excel sheet for ${formattedDateDisplay}`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
            <span>Export Excel</span>
          </Button>

          {/* Refresh Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchOrders(false)}
            className="text-xs gap-1.5 h-8 border-border bg-card hover:bg-muted"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid gap-3.5 sm:grid-cols-3">
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

      {/* ─── Day Selector Strip with shadcn Calendar ──────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/60 p-2.5 rounded-xl border border-border">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Day Navigation */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
            {/* Prev Day */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => handleShiftDay(-1)}
              title="Previous Day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* shadcn Popover with Calendar */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold shadow-xs transition-all cursor-pointer">
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                <span>{isToday ? `Today (${formattedDateDisplay})` : formattedDateDisplay}</span>
                <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }
                  }}
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>

            {/* Next Day */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40"
              onClick={() => handleShiftDay(1)}
              disabled={isToday}
              title="Next Day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Today Shortcut Button */}
          {!isToday && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold shadow-xs"
              onClick={() => setSelectedDate(new Date())}
            >
              <CalendarCheck className="h-3.5 w-3.5 mr-1 text-primary" />
              Today
            </Button>
          )}

          <Badge
            variant="outline"
            className="text-xs font-medium px-2.5 py-1 border-border bg-card/80 flex items-center gap-1.5 text-muted-foreground"
          >
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>{formattedDayFull}</span>
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <span>
            {isToday ? "Showing today's real-time orders" : `Showing historical orders on ${formattedDateDisplay}`} ({orders.length} orders)
          </span>
        </div>
      </div>

      {/* ─── Status Tabs & Search Bar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs
          value={statusTab}
          onValueChange={(val) => setStatusTab(val)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-3 sm:flex w-full gap-1 p-1 bg-muted/60">
            <TabsTrigger value="all" className="text-xs">
              All Orders
              <span className="ml-1 opacity-70">({counts.all})</span>
            </TabsTrigger>
            <TabsTrigger value="placed" className="text-xs">
              Placed
              <span className="ml-1 opacity-70">({counts.placed})</span>
            </TabsTrigger>
            <TabsTrigger value="preparing" className="text-xs">
              Preparing
              <span className="ml-1 opacity-70">({counts.preparing})</span>
            </TabsTrigger>
            <TabsTrigger value="ready" className="text-xs">
              Ready
              <span className="ml-1 opacity-70">({counts.ready})</span>
            </TabsTrigger>
            <TabsTrigger value="out_for_delivery" className="text-xs">
              Out for Delivery
              <span className="ml-1 opacity-70">({counts.outForDelivery})</span>
            </TabsTrigger>
            <TabsTrigger value="delivered" className="text-xs">
              Delivered
              <span className="ml-1 opacity-70">({counts.delivered})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search Order #, customer, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>
      </div>

      {/* ─── Orders Table ─────────────────────────────────────────────── */}
      <Card className="border-border shadow-xs">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="w-24 text-xs">Order #</TableHead>
                  <TableHead className="w-48 text-xs">Customer</TableHead>
                  <TableHead className="min-w-64 text-xs">Items &amp; Total</TableHead>
                  <TableHead className="w-28 text-center text-xs">Status</TableHead>
                  <TableHead className="w-24 text-center text-xs">Fulfillment</TableHead>
                  <TableHead className="w-28 text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-36 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <UtensilsCrossed className="h-6 w-6 text-muted-foreground/40 mb-1" />
                        <p className="text-sm font-medium">No orders found on {formattedDateDisplay}</p>
                        <p className="text-xs text-muted-foreground">
                          {statusTab !== "all"
                            ? `No orders matching status filter "${statusTab}". Try switching to "All Orders".`
                            : isToday
                            ? "Incoming orders from customers will appear here automatically."
                            : "Select another date from the calendar or click Today."}
                        </p>
                        {!isToday && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 text-xs"
                            onClick={() => setSelectedDate(new Date())}
                          >
                            View Today&apos;s Live Orders
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => {
                    const isPickup = (order.orderType || "delivery") === "pickup";
                    const isExpanded = !!expandedOrders[order.id];

                    return (
                      <TableRow key={order.id} className="hover:bg-muted/30">
                        {/* Order Number & Created At */}
                        <TableCell className="font-mono font-medium text-xs align-top pt-3">
                          <button
                            type="button"
                            onClick={() => setDetailsModalOrder(order)}
                            className="text-left font-bold text-foreground hover:text-primary hover:underline"
                          >
                            {order.orderNumber}
                          </button>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {new Intl.DateTimeFormat("en-IN", {
                              timeZone: "Asia/Kolkata",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            }).format(new Date(order.createdAt))}
                          </div>
                        </TableCell>

                        {/* Customer Info */}
                        <TableCell className="align-top pt-3">
                          <div className="text-xs font-semibold text-foreground">
                            {order.customer.name}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            {order.customer.phone}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1 max-w-56" title={order.deliveryAddress?.borzoFormat?.address}>
                            {isPickup ? (
                              <span className="text-emerald-500 font-semibold">Store Pickup (Metropolis Rivera Shop 10)</span>
                            ) : (
                              order.deliveryAddress?.borzoFormat?.address || "Delivery"
                            )}
                          </div>
                        </TableCell>

                        {/* Items, Addons, Total */}
                        <TableCell className="align-top pt-3">
                          <div className="space-y-1.5">
                            {order.items.slice(0, isExpanded ? order.items.length : 2).map((item, idx) => (
                              <div key={idx} className="text-xs flex items-baseline justify-between gap-3">
                                <div>
                                  <span className="font-bold text-foreground">{item.quantity}x</span>{" "}
                                  <span>{item.productName}</span>
                                  {item.addons && item.addons.length > 0 && (
                                    <div className="text-[10px] text-muted-foreground pl-3">
                                      + {item.addons.map((a) => `${a.quantity}x ${a.name}`).join(", ")}
                                    </div>
                                  )}
                                </div>
                                <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                  ₹{item.subtotal}
                                </span>
                              </div>
                            ))}

                            {order.items.length > 2 && (
                              <button
                                type="button"
                                onClick={() => toggleOrderItems(order.id)}
                                className="text-[10px] text-primary hover:underline font-semibold"
                              >
                                {isExpanded ? "Show less" : `+${order.items.length - 2} more item(s)`}
                              </button>
                            )}

                            <div className="pt-1 border-t border-border/50 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground text-[11px]">Total:</span>
                              <span className="font-mono font-bold text-foreground">₹{order.totalAmount}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Status Badge */}
                        <TableCell className="text-center align-top pt-3">
                          <OrderStatusBadge status={order.status} />
                        </TableCell>

                        {/* Fulfillment */}
                        <TableCell className="text-center align-top pt-3">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] font-semibold ${
                              isPickup
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                            }`}
                          >
                            {isPickup ? "Pickup" : "Delivery"}
                          </Badge>
                          {order.dispatchSlot?.label && (
                            <div className="text-[9.5px] text-muted-foreground mt-1">
                              {order.dispatchSlot.label}
                            </div>
                          )}
                        </TableCell>

                        {/* Actions Dropdown & Print Bill */}
                        <TableCell className="text-right align-top pt-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Print Bill Button */}
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => setBillModalOrderId(order.id)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Print Kitchen Bill"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>

                            {/* Dropdown Menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="inline-flex items-center justify-center rounded-lg border border-border h-7 w-7 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 text-xs font-sans">
                                <DropdownMenuItem onClick={() => setDetailsModalOrder(order)}>
                                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                  View Details
                                </DropdownMenuItem>

                                <DropdownMenuItem onClick={() => setBillModalOrderId(order.id)}>
                                  <Printer className="mr-2 h-3.5 w-3.5" />
                                  Print Thermal Receipt
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                {/* Status Transitions */}
                                {order.status === "placed" && (
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(order.id, "preparing")}
                                    disabled={actionLoadingId === order.id}
                                    className="text-amber-500"
                                  >
                                    <Clock className="mr-2 h-3.5 w-3.5" />
                                    Mark Preparing
                                  </DropdownMenuItem>
                                )}

                                {order.status === "preparing" && (
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(order.id, "ready")}
                                    disabled={actionLoadingId === order.id}
                                    className="text-blue-500"
                                  >
                                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                    {isPickup ? "Mark Ready for Pickup" : "Mark Ready"}
                                  </DropdownMenuItem>
                                )}

                                {order.status === "ready" && !isPickup && (
                                  <DropdownMenuItem
                                    onClick={() => setCourierModalOrder(order)}
                                    className="text-indigo-400"
                                  >
                                    <Truck className="mr-2 h-3.5 w-3.5" />
                                    Dispatch with Borzo
                                  </DropdownMenuItem>
                                )}

                                {(order.status === "ready" ||
                                  order.status === "porter_booked" ||
                                  order.status === "out_for_delivery") && (
                                  <DropdownMenuItem
                                    onClick={() => handleStatusChange(order.id, "delivered")}
                                    disabled={actionLoadingId === order.id}
                                    className="text-emerald-500 font-semibold"
                                  >
                                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                    Mark Delivered
                                  </DropdownMenuItem>
                                )}

                                {!["delivered", "cancelled_by_customer", "cancelled_by_admin"].includes(
                                  order.status,
                                ) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setCancelModalOrder(order)}
                                      className="text-destructive font-semibold"
                                    >
                                      <Ban className="mr-2 h-3.5 w-3.5" />
                                      Cancel Order
                                    </DropdownMenuItem>
                                  </>
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
