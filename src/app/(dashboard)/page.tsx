"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  getProducts,
  getCategories,
  getOrders,
  getMonthlyReports,
  getWeeklyOff,
  getOrderWindows,
  getDispatchWindows,
  getCancelledOrders,
  type Order,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useOrderEvents } from "@/hooks/use-order-events";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderDetailsModal } from "@/components/orders/order-details-modal";
import {
  ShoppingBag,
  IndianRupee,
  UtensilsCrossed,
  FolderOpen,
  ArrowRight,
  Truck,
  Sparkles,
  BarChart3,
  Clock,
  CalendarOff,
  CalendarDays,
  HelpCircle,
  Ban,
  Activity,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ChefHat,
  Compass,
} from "lucide-react";

interface DashboardData {
  productsCount: number;
  categoriesCount: number;
  totalOrdersCount: number;
  activeOrdersCount: number;
  placedCount: number;
  preparingCount: number;
  readyCount: number;
  monthlyRevenue: number;
  avgOrderValue: number;
  paidOrdersCount: number;
  cancelledOrdersCount: number;
  recentOrders: Order[];
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenueGenerated: number;
  }>;
  weeklyOffDays: string[];
  todayOrderWindowSummary: string;
  isTodayWeeklyOff: boolean;
  todayDispatchSlotCount: number;
  todayDispatchSpan: string;
}

export default function DashboardPage() {
  const { admin } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  // IST Date & Day
  const { istDayName, istDateFormatted, istDayKey } = useMemo(() => {
    const now = new Date();
    const istDay = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
    }).format(now);
    const istDate = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "full",
    }).format(now);
    return {
      istDayName: istDay,
      istDateFormatted: istDate,
      istDayKey: istDay.toLowerCase(),
    };
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [
        productsRes,
        categoriesRes,
        ordersRes,
        reportsRes,
        weeklyOffRes,
        orderWindowsRes,
        dispatchWindowsRes,
        cancelledRes,
      ] = await Promise.allSettled([
        getProducts({ limit: 1 }),
        getCategories(),
        getOrders({ limit: 6 }),
        getMonthlyReports({ period: "this_month" }),
        getWeeklyOff(),
        getOrderWindows(),
        getDispatchWindows(),
        getCancelledOrders(),
      ]);

      const products = productsRes.status === "fulfilled" ? productsRes.value : null;
      const categories = categoriesRes.status === "fulfilled" ? categoriesRes.value : null;
      const orders = ordersRes.status === "fulfilled" ? ordersRes.value : null;
      const reports = reportsRes.status === "fulfilled" ? reportsRes.value : null;
      const weeklyOff = weeklyOffRes.status === "fulfilled" ? weeklyOffRes.value : null;
      const orderWindows = orderWindowsRes.status === "fulfilled" ? orderWindowsRes.value : null;
      const dispatchWindows = dispatchWindowsRes.status === "fulfilled" ? dispatchWindowsRes.value : null;
      const cancelled = cancelledRes.status === "fulfilled" ? cancelledRes.value : null;

      const weeklyOffDays = weeklyOff?.weeklyOff || [];
      const isTodayWeeklyOff = weeklyOffDays.includes(istDayKey);

      // Find today's order intake window
      const todayOrderWin = orderWindows?.orderWindows?.find((w) => w.day === istDayKey);
      let todayOrderWindowSummary = "Closed today";
      if (todayOrderWin?.enabled && todayOrderWin.windows.length > 0) {
        const first = todayOrderWin.windows[0];
        const last = todayOrderWin.windows[todayOrderWin.windows.length - 1];
        todayOrderWindowSummary = `${first?.start || ""} – ${last?.end || ""}`;
      } else if (todayOrderWin && !todayOrderWin.enabled) {
        todayOrderWindowSummary = "Intake disabled";
      }

      // Find today's dispatch windows
      const todayDispatchWin = dispatchWindows?.dispatchWindows?.find((w) => w.day === istDayKey);
      const activeSlots = todayDispatchWin?.slots?.filter((s) => s.isActive !== false) || [];
      const todayDispatchSlotCount = activeSlots.length;
      let todayDispatchSpan = "Not set";
      if (activeSlots.length > 0) {
        const sorted = [...activeSlots].sort((a, b) => a.start.localeCompare(b.start));
        todayDispatchSpan = `${sorted[0]?.start} – ${sorted[sorted.length - 1]?.end}`;
      }

      const placed = orders?.counts?.placed || 0;
      const preparing = orders?.counts?.preparing || 0;
      const ready = orders?.counts?.ready || 0;
      const activeOrdersCount = placed + preparing + ready;

      setData({
        productsCount: products?.pagination?.total || 0,
        categoriesCount: categories?.categories?.length || 0,
        totalOrdersCount: orders?.pagination?.total || 0,
        activeOrdersCount,
        placedCount: placed,
        preparingCount: preparing,
        readyCount: ready,
        monthlyRevenue: reports?.summary?.totalRevenue || 0,
        avgOrderValue: reports?.summary?.avgOrderValue || 0,
        paidOrdersCount: reports?.summary?.paidOrdersCount || 0,
        cancelledOrdersCount: cancelled?.cancelledOrders?.length || reports?.summary?.cancelledOrdersCount || 0,
        recentOrders: orders?.orders || [],
        topProducts: reports?.topProducts?.slice(0, 4) || [],
        weeklyOffDays,
        todayOrderWindowSummary,
        isTodayWeeklyOff,
        todayDispatchSlotCount,
        todayDispatchSpan,
      });
    } catch (err) {
      console.error("Dashboard data load error:", err);
    } finally {
      setLoading(false);
    }
  }, [istDayKey]);

  const { isConnected } = useOrderEvents({
    onOrderChange: () => {
      fetchDashboardData();
    },
    enableToasts: false,
  });

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Format order created time
  const formatOrderTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });
    } catch {
      return dateStr;
    }
  };

  const getOrderItemsSummary = (order: Order) => {
    if (!order.items || order.items.length === 0) return "No items";
    const first = order.items[0];
    const totalQty = order.items.reduce((acc, i) => acc + i.quantity, 0);
    if (order.items.length === 1) {
      return `${first?.productName} (×${first?.quantity})`;
    }
    return `${first?.productName} (×${first?.quantity}) +${order.items.length - 1} more (${totalQty} items)`;
  };

  const handleOpenOrderModal = (order: Order) => {
    setSelectedOrder(order);
    setOrderModalOpen(true);
  };

  // Quick navigation modules grouped logically for the admin
  const quickNavGroups = [
    {
      group: "Live Kitchen & Orders",
      badge: "Core Operations",
      items: [
        {
          title: "Live Orders Board",
          description: "Incoming live orders pipeline, cooking timers, receipts & Borzo dispatching.",
          href: "/orders",
          icon: ShoppingBag,
          color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
          statBadge: data ? `${data.activeOrdersCount} in progress` : undefined,
          badgeVariant: "default" as const,
        },
        {
          title: "Cancelled Orders",
          description: "Review cancelled tickets, customer cancellation reasons, and process refunds.",
          href: "/orders/cancelled",
          icon: Ban,
          color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
          statBadge: data ? `${data.cancelledOrdersCount} cancelled` : undefined,
          badgeVariant: "outline" as const,
        },
        {
          title: "Reports & Analytics",
          description: "Explore gross revenue, daily trends, volume charts, and top-selling momo items.",
          href: "/reports",
          icon: BarChart3,
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          statBadge: "Weekly & Yearly",
          badgeVariant: "outline" as const,
        },
      ],
    },
    {
      group: "Menu & Storefront Catalog",
      badge: "Food Catalog",
      items: [
        {
          title: "Menu Products",
          description: "Manage momos & specialties, update pricing, spice levels, and stock availability.",
          href: "/products",
          icon: UtensilsCrossed,
          color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
          statBadge: data ? `${data.productsCount} active items` : undefined,
          badgeVariant: "outline" as const,
        },
        {
          title: "Categories",
          description: "Organize food categories (Steamed, Fried, Jhol, Platters) for the customer app.",
          href: "/categories",
          icon: FolderOpen,
          color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
          statBadge: data ? `${data.categoriesCount} categories` : undefined,
          badgeVariant: "outline" as const,
        },
        {
          title: "Customer FAQs",
          description: "Manage frequently asked questions regarding food, packaging, and delivery policies.",
          href: "/faqs",
          icon: HelpCircle,
          color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
          statBadge: "Help Center",
          badgeVariant: "outline" as const,
        },
      ],
    },
    {
      group: "Kitchen Hours & Logistics",
      badge: "Store Schedule",
      items: [
        {
          title: "Order Intake Windows",
          description: "Configure hours when customers are allowed to place orders on the app.",
          href: "/order-windows",
          icon: Clock,
          color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
          statBadge: data?.isTodayWeeklyOff ? "Closed Today" : "Intake Hours",
          badgeVariant: "outline" as const,
        },
        {
          title: "Dispatch Windows",
          description: "Manage next-day delivery slots, time intervals, and kitchen capacities.",
          href: "/dispatch-windows",
          icon: Truck,
          color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
          statBadge: data ? `${data.todayDispatchSlotCount} slots today` : undefined,
          badgeVariant: "outline" as const,
        },
        {
          title: "Weekly Off Days",
          description: "Set scheduled weekly closure days when the kitchen does not take orders.",
          href: "/weekly-off",
          icon: CalendarOff,
          color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
          statBadge: data?.weeklyOffDays?.length ? `${data.weeklyOffDays.length} day(s) off` : "Open 7 Days",
          badgeVariant: "outline" as const,
        },
        {
          title: "Holiday Calendar",
          description: "Block ordering on national festivals, kitchen maintenance, or special occasions.",
          href: "/holidays",
          icon: CalendarDays,
          color: "text-pink-400 bg-pink-500/10 border-pink-500/20",
          statBadge: "Holiday Closures",
          badgeVariant: "outline" as const,
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Top Executive Greeting & Status Bar ─────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">
              Welcome back{admin?.name ? `, ${admin.name.split(" ")[0]}` : ""}
            </h2>
            <Badge variant="outline" className="border-border text-xs font-normal">
              {istDayName}
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Nepali Tales Kitchen Command Center • Live operations, incoming orders & quick administration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Today's Operating Status Badge */}
          {data?.isTodayWeeklyOff ? (
            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs py-1 px-2.5 gap-1.5"
            >
              <CalendarOff className="h-3.5 w-3.5" />
              Weekly Off Today
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs py-1 px-2.5 gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Kitchen Active
            </Badge>
          )}

          {/* SSE Live Connection Pill */}
          {isConnected ? (
            <Badge
              variant="outline"
              className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs py-1 px-2.5 gap-1.5"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live SSE Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-xs py-1 px-2.5">
              Connecting stream...
            </Badge>
          )}

          {/* Quick Actions */}
          <Link href="/orders">
            <Button size="sm" className="bg-primary text-primary-foreground gap-1.5 text-xs h-8">
              <ShoppingBag className="h-3.5 w-3.5" />
              Live Orders Board
            </Button>
          </Link>
          <Link href="/reports">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <BarChart3 className="h-3.5 w-3.5" />
              Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── Hero Kitchen Operations Banner ──────────────────────────── */}
      <div className="rounded-2xl border border-primary/30 bg-linear-to-r from-primary/10 via-card to-background p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <ChefHat className="h-3.5 w-3.5" />
                Kitchen Operations & Delivery Dispatch
              </span>
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <h3 className="text-base sm:text-lg font-bold">
              Real-Time Kitchen Orders & Automated Borzo Delivery System
            </h3>
            <p className="text-muted-foreground text-xs max-w-2xl leading-relaxed">
              Customer orders appear in real time via live push stream. Advance orders through Cooking,
              Ready, and trigger automatic courier pickups to deliver authentic momos promptly.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/orders">
              <Button size="sm" className="text-xs gap-1.5 bg-primary text-primary-foreground">
                Open Orders Board
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Core KPI Metric Summary Cards ───────────────────────────── */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Active Pipeline Orders */}
        <Link href="/orders" className="group">
          <Card className="h-full border-border/80 bg-card/80 transition-all duration-200 hover:border-blue-500/40 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Active Order Pipeline
              </CardTitle>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20 my-1" />
              ) : (
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {data?.activeOrdersCount ?? 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>
                  {data?.placedCount ?? 0} placed • {data?.preparingCount ?? 0} cooking • {data?.readyCount ?? 0} ready
                </span>
                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 2: This Month's Revenue (₹ Currency) */}
        <Link href="/reports" className="group">
          <Card className="h-full border-border/80 bg-card/80 transition-all duration-200 hover:border-emerald-500/40 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                This Month&apos;s Revenue
              </CardTitle>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24 my-1" />
              ) : (
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  ₹{(data?.monthlyRevenue ?? 0).toLocaleString("en-IN")}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>
                  Avg order ₹{(data?.avgOrderValue ?? 0).toLocaleString("en-IN")} • {data?.paidOrdersCount ?? 0} orders
                </span>
                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400" />
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 3: Menu & Catalog */}
        <Link href="/products" className="group">
          <Card className="h-full border-border/80 bg-card/80 transition-all duration-200 hover:border-amber-500/40 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Menu & Catalog
              </CardTitle>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                <UtensilsCrossed className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20 my-1" />
              ) : (
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {data?.productsCount ?? 0} Items
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>Across {data?.categoriesCount ?? 0} menu categories</span>
                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-amber-400" />
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 4: Dispatch Windows & Schedule */}
        <Link href="/dispatch-windows" className="group">
          <Card className="h-full border-border/80 bg-card/80 transition-all duration-200 hover:border-indigo-500/40 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Dispatch Schedule
              </CardTitle>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                <Truck className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20 my-1" />
              ) : (
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {data?.todayDispatchSlotCount ?? 0} Slots
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>{data?.todayDispatchSpan || "Standard 2:00 PM – 10:00 PM"}</span>
                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ─── Middle Section: Live Orders Pipeline & Top Sellers ──────── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column (7 cols): Recent Orders & Live Kitchen Pipeline */}
        <Card className="lg:col-span-7 border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 border-b border-border/60">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span>Recent Orders Pipeline</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time snapshot of the latest orders in the kitchen queue.
              </CardDescription>
            </div>
            <Link href="/orders">
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                View Full Board
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="pt-3">
            {loading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : !data?.recentOrders || data.recentOrders.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 text-muted-foreground">
                <ShoppingBag className="h-8 w-8 opacity-40" />
                <p className="text-sm font-semibold">Kitchen queue is clear</p>
                <p className="text-xs max-w-xs text-muted-foreground/80">
                  No pending customer orders awaiting fulfillment. New orders will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {data.recentOrders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    onClick={() => handleOpenOrderModal(order)}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-muted/30 px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {order.orderNumber}
                        </span>
                        <span className="text-xs text-foreground font-medium truncate">
                          {order.customer?.name || "Customer"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatOrderTime(order.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {getOrderItemsSummary(order)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="font-mono font-bold text-xs text-foreground">
                          ₹{order.totalAmount.toLocaleString("en-IN")}
                        </div>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column (5 cols): Top Products Leaderboard */}
        <Card className="lg:col-span-5 border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 border-b border-border/60">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-400" />
                <span>Top Selling Momos</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Highest grossing menu items this month.
              </CardDescription>
            </div>
            <Link href="/reports">
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                Full Analytics
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="pt-3">
            {loading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : !data?.topProducts || data.topProducts.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 text-muted-foreground">
                <UtensilsCrossed className="h-8 w-8 opacity-40" />
                <p className="text-sm font-semibold">No sales recorded yet</p>
                <p className="text-xs text-muted-foreground/80">
                  Product sales will populate as customer orders are fulfilled.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.topProducts.map((p, idx) => {
                  const maxRevenue = data.topProducts[0]?.revenueGenerated || 1;
                  const percent = Math.min(100, Math.round((p.revenueGenerated / maxRevenue) * 100));

                  return (
                    <div key={p.productId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 text-center font-mono font-bold text-muted-foreground text-[11px]">
                            #{idx + 1}
                          </span>
                          <span className="font-medium text-foreground truncate">{p.productName}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 font-mono">
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                            {p.quantitySold} sold
                          </Badge>
                          <span className="font-semibold text-emerald-400">
                            ₹{p.revenueGenerated.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Management Hub & Quick Links (All Tabs) ─────────────────── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              Management Hub & Quick Navigation
            </h3>
            <p className="text-xs text-muted-foreground">
              Direct access to all 10 management modules, operational tools, schedules, and menus.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {quickNavGroups.map((group) => (
            <div key={group.group} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {group.group}
                </span>
                <Separator className="flex-1" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className="group">
                    <Card className="h-full border-border/80 bg-card/60 transition-all duration-200 hover:border-primary/50 hover:bg-card hover:shadow-md">
                      <CardContent className="p-4 flex items-start gap-3.5">
                        <div className={`p-2 rounded-xl border shrink-0 ${item.color} group-hover:scale-105 transition-transform`}>
                          <item.icon className="h-4 w-4" />
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                              {item.title}
                            </h4>
                            {item.statBadge && (
                              <Badge
                                variant={item.badgeVariant}
                                className="text-[10px] shrink-0 font-normal px-1.5 py-0"
                              >
                                {item.statBadge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Order Details Modal ─────────────────────────────────────── */}
      <OrderDetailsModal
        order={selectedOrder}
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
      />
    </div>
  );
}
