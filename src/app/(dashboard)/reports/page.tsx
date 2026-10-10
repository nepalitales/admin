"use client";

import { useEffect, useState, useMemo } from "react";
import {
  getMonthlyReports,
  type MonthlyReportsResponse,
  type ReportPeriod,
  type ReportTimelinePoint,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  BarChart3,
  TrendingUp,
  ShoppingBag,
  IndianRupee,
  UtensilsCrossed,
  Trophy,
  Calendar,
  Sparkles,
  ArrowUpRight,
  PackageCheck,
  Ban,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  revenue: {
    label: "Gross Revenue",
    color: "#10b981", // Emerald
  },
  orders: {
    label: "Paid Orders",
    color: "#3b82f6", // Blue
  },
  cancelledOrders: {
    label: "Cancelled Orders",
    color: "#f43f5e", // Rose
  },
} satisfies ChartConfig;

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("this_month");
  const [activeChartMetric, setActiveChartMetric] = useState<"revenue" | "orders">("revenue");
  const [reportData, setReportData] = useState<MonthlyReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async (period: ReportPeriod) => {
    setLoading(true);
    try {
      const res = await getMonthlyReports({ period });
      setReportData(res);
    } catch (err: any) {
      toast.error("Failed to load analytics: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(selectedPeriod);
  }, [selectedPeriod]);

  const summary = reportData?.summary;
  const topProducts = reportData?.topProducts || [];
  const timeline: ReportTimelinePoint[] = reportData?.timeline || [];

  const maxProductRevenue = Math.max(
    ...topProducts.map((p) => p.revenueGenerated),
    1,
  );

  // Peak statistics from timeline
  const peakStats = useMemo(() => {
    if (!timeline || timeline.length === 0) {
      return { peakRevenue: 0, peakRevenueLabel: "—", peakOrders: 0, peakOrdersLabel: "—" };
    }
    let maxRev = 0;
    let maxRevItem: ReportTimelinePoint | null = null;
    let maxOrd = 0;
    let maxOrdItem: ReportTimelinePoint | null = null;

    for (const t of timeline) {
      if (t.revenue > maxRev) {
        maxRev = t.revenue;
        maxRevItem = t;
      }
      if (t.orders > maxOrd) {
        maxOrd = t.orders;
        maxOrdItem = t;
      }
    }

    return {
      peakRevenue: maxRev,
      peakRevenueLabel: maxRevItem ? `${maxRevItem.label} (₹${maxRev.toLocaleString("en-IN")})` : "—",
      peakOrders: maxOrd,
      peakOrdersLabel: maxOrdItem ? `${maxOrdItem.label} (${maxOrd} orders)` : "—",
    };
  }, [timeline]);

  // Format short axis tick label
  const formatAxisDate = (dateStr: string, label: string) => {
    if (selectedPeriod === "this_week") {
      // E.g., "Mon, 5 Oct" -> "Mon 5"
      const parts = label.split(", ");
      return parts[0] || dateStr;
    }
    if (selectedPeriod === "this_year") {
      // E.g., "Jan 2026" -> "Jan"
      return label.split(" ")[0] || label;
    }
    // E.g., "5 Oct" -> "5 Oct"
    return label;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Page Header with Segmented Period Selector ───────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Reports & Performance Analytics
            </h2>
            <Badge variant="outline" className="border-primary/40 text-primary text-xs font-mono">
              Live Reports
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Track business growth, gross revenue, order volume trends, and top-selling momo items.
          </p>
        </div>

        {/* Period Selector: This Week | This Month | Last Month | This Year */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 self-start md:self-auto">
          <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border">
            <Button
              type="button"
              size="sm"
              variant={selectedPeriod === "this_week" ? "default" : "ghost"}
              onClick={() => setSelectedPeriod("this_week")}
              className="text-xs h-8 px-3 rounded-lg font-medium transition-all"
            >
              This Week
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selectedPeriod === "this_month" ? "default" : "ghost"}
              onClick={() => setSelectedPeriod("this_month")}
              className="text-xs h-8 px-3 rounded-lg font-medium transition-all"
            >
              This Month
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selectedPeriod === "last_month" ? "default" : "ghost"}
              onClick={() => setSelectedPeriod("last_month")}
              className="text-xs h-8 px-3 rounded-lg font-medium transition-all"
            >
              Last Month
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selectedPeriod === "this_year" ? "default" : "ghost"}
              onClick={() => setSelectedPeriod("this_year")}
              className="text-xs h-8 px-3 rounded-lg font-medium transition-all"
            >
              This Year
            </Button>
          </div>

          {reportData?.periodLabel && (
            <Badge
              variant="outline"
              className="text-xs font-medium px-2.5 py-1 border-border bg-card/80 flex items-center gap-1.5 text-muted-foreground"
            >
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>{reportData.periodLabel}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* ─── KPI Stats Grid ───────────────────────────────────────────── */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Gross Revenue (With ₹ symbol, NOT dollar) */}
        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Gross Revenue
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <IndianRupee className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-28 my-1" />
            ) : (
              <div className="text-2xl font-bold text-foreground font-mono">
                ₹{summary?.totalRevenue.toLocaleString("en-IN") || 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-semibold">•</span> Excludes cancelled / refunded orders
            </p>
          </CardContent>
        </Card>

        {/* Delivered / Paid Orders */}
        <Card className="border-border/80 bg-card/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Delivered / Paid Orders
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 my-1" />
            ) : (
              <div className="text-2xl font-bold text-foreground font-mono">
                {summary?.paidOrdersCount || 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Total placed: <strong className="text-foreground">{summary?.totalOrdersCount || 0}</strong> orders
            </p>
          </CardContent>
        </Card>

        {/* Average Order Value (AOV) */}
        <Card className="border-border/80 bg-card/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Average Order Value (AOV)
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold text-foreground font-mono">
                ₹{summary?.avgOrderValue.toLocaleString("en-IN") || 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Per completed customer order
            </p>
          </CardContent>
        </Card>

        {/* Cancelled Orders */}
        <Card className="border-rose-500/20 bg-rose-500/5 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cancelled Orders
            </CardTitle>
            <Badge variant="outline" className="text-[11px] font-bold border-rose-500/30 text-rose-400 bg-rose-500/10 py-0">
              {summary && summary.totalOrdersCount > 0
                ? `${Math.round((summary.cancelledOrdersCount / summary.totalOrdersCount) * 100)}%`
                : "0%"}
            </Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 my-1" />
            ) : (
              <div className="text-2xl font-bold text-rose-400 font-mono">
                {summary?.cancelledOrdersCount || 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Customer or kitchen cancellations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Hero Accurate Performance Graph ─────────────────────────── */}
      <Card className="border-border/80 bg-card/80 shadow-md">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span>
                {selectedPeriod === "this_year"
                  ? "Annual Performance & Monthly Breakdown"
                  : "Performance Trend & Daily Breakdown"}
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              {selectedPeriod === "this_year"
                ? `Monthly revenue and delivery order volume across ${reportData?.periodLabel || "this year"}.`
                : `Daily revenue and delivery order volume across ${reportData?.periodLabel || "selected timeframe"}.`}
            </CardDescription>
          </div>

          {/* Metric switcher buttons */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/80 self-start sm:self-auto">
            <Button
              type="button"
              size="sm"
              variant={activeChartMetric === "revenue" ? "secondary" : "ghost"}
              onClick={() => setActiveChartMetric("revenue")}
              className="text-xs h-7 px-3 gap-1.5"
            >
              <IndianRupee className="h-3 w-3 text-emerald-400" />
              Revenue (₹)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeChartMetric === "orders" ? "secondary" : "ghost"}
              onClick={() => setActiveChartMetric("orders")}
              className="text-xs h-7 px-3 gap-1.5"
            >
              <PackageCheck className="h-3 w-3 text-blue-400" />
              Orders Volume
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Quick Graph Summary Micro-Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-muted/20 border border-border/60 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Period Revenue
              </span>
              <p className="text-sm font-bold text-emerald-400 font-mono">
                ₹{summary?.totalRevenue.toLocaleString("en-IN") || 0}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                {selectedPeriod === "this_year" ? "Peak Month Revenue" : "Peak Revenue Day"}
              </span>
              <p className="text-sm font-bold text-foreground truncate">
                {peakStats.peakRevenue > 0 ? peakStats.peakRevenueLabel : "No orders yet"}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                {selectedPeriod === "this_year" ? "Peak Month Volume" : "Peak Order Volume"}
              </span>
              <p className="text-sm font-bold text-blue-400 truncate">
                {peakStats.peakOrders > 0 ? peakStats.peakOrdersLabel : "No orders yet"}
              </p>
            </div>
          </div>

          {/* Interactive Responsive Graph with shadcn ChartContainer */}
          {loading ? (
            <div className="h-70 w-full flex items-center justify-center">
              <Skeleton className="h-65 w-full rounded-xl" />
            </div>
          ) : timeline.length === 0 ? (
            <div className="h-65 w-full flex flex-col items-center justify-center space-y-2 text-muted-foreground border border-dashed rounded-xl">
              <BarChart3 className="h-8 w-8 opacity-40" />
              <p className="text-xs font-medium">No order data recorded for this timeframe.</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-70 w-full">
              {activeChartMetric === "revenue" ? (
                <AreaChart
                  data={timeline}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={20}
                    tickFormatter={(val) => {
                      const item = timeline.find((t) => t.date === val);
                      return item ? formatAxisDate(val, item.label) : val;
                    }}
                    className="text-[11px] fill-muted-foreground font-mono"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(val) => `₹${val}`}
                    className="text-[11px] fill-muted-foreground font-mono"
                  />
                  <ChartTooltip
                    cursor={{ stroke: "rgba(16, 185, 129, 0.3)", strokeWidth: 1 }}
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0]?.payload as ReportTimelinePoint | undefined;
                          return item?.label || "";
                        }}
                        formatter={(value, name) => {
                          if (name === "revenue") {
                            return (
                              <div className="flex items-center justify-between w-full gap-4">
                                <span className="text-muted-foreground">Revenue</span>
                                <span className="font-bold font-mono text-emerald-400">
                                  ₹{Number(value).toLocaleString("en-IN")}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#fillRevenue)"
                    activeDot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                  />
                </AreaChart>
              ) : (
                <BarChart
                  data={timeline}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={20}
                    tickFormatter={(val) => {
                      const item = timeline.find((t) => t.date === val);
                      return item ? formatAxisDate(val, item.label) : val;
                    }}
                    className="text-[11px] fill-muted-foreground font-mono"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    allowDecimals={false}
                    tickFormatter={(val) => `${val}`}
                    className="text-[11px] fill-muted-foreground font-mono"
                  />
                  <ChartTooltip
                    cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0]?.payload as ReportTimelinePoint | undefined;
                          return item?.label || "";
                        }}
                        formatter={(value, name) => {
                          if (name === "orders") {
                            return (
                              <div className="flex items-center justify-between w-full gap-4">
                                <span className="text-muted-foreground">Paid Orders</span>
                                <span className="font-bold font-mono text-blue-400">
                                  {value} orders
                                </span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey="orders"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              )}
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* ─── Top Products Leaderboard ─────────────────────────────────── */}
      <Card className="border-border/80 bg-card/80 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                <span>Top Selling Momos & Menu Items</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Ranked by volume sold and revenue contribution for {reportData?.periodLabel || "selected period"}.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-medium">
              {topProducts.length} Items Sold
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60">
                  <TableHead className="w-20">Rank</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Units Sold</TableHead>
                  <TableHead>Revenue Generated</TableHead>
                  <TableHead className="w-45">Contribution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-3 w-28" /></TableCell>
                    </TableRow>
                  ))
                ) : topProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-sm">
                      <div className="flex flex-col items-center justify-center">
                        <UtensilsCrossed className="h-6 w-6 mb-1 opacity-40" />
                        <p className="text-xs">No product sales recorded for this timeframe.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  topProducts.map((prod, idx) => {
                    const percent = Math.min(100, Math.round((prod.revenueGenerated / maxProductRevenue) * 100));

                    return (
                      <TableRow key={prod.productId} className="hover:bg-muted/40 border-border/50">
                        <TableCell className="font-bold text-sm">
                          {idx === 0 ? (
                            <span className="flex items-center gap-1 text-amber-400 font-bold">
                              #1
                            </span>
                          ) : idx === 1 ? (
                            <span className="flex items-center gap-1 text-zinc-300 font-bold">
                              #2
                            </span>
                          ) : idx === 2 ? (
                            <span className="flex items-center gap-1 text-amber-600 font-bold">
                              #3
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-medium">#{idx + 1}</span>
                          )}
                        </TableCell>

                        <TableCell className="font-medium text-xs text-foreground">
                          {prod.productName}
                        </TableCell>

                        <TableCell className="text-center font-bold text-xs">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {prod.quantitySold} plates
                          </Badge>
                        </TableCell>

                        <TableCell className="font-semibold text-xs text-emerald-400 font-mono">
                          ₹{prod.revenueGenerated.toLocaleString("en-IN")}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground w-8 text-right">
                              {percent}%
                            </span>
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
    </div>
  );
}
