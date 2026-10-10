"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  getDispatchWindows,
  updateDispatchWindow,
  updateDispatchWindowsBulk,
  getDispatchCapacity,
  getWeeklyOff,
  updateWeeklyOff,
  type DispatchWindow,
  type DispatchSlot,
  type DispatchCapacityResponse,
  ApiError,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  CalendarRange,
  CalendarOff,
  BarChart3,
  Truck,
  Sparkles,
  LayoutGrid,
  ListFilter,
  CheckCircle2,
  Package,
} from "lucide-react";
import { ALL_DAYS, DAY_LABELS, calculateDayStats } from "./components/types";
import { DayScheduleCard } from "./components/DayScheduleCard";
import { SlotConfigDialog } from "./components/SlotConfigDialog";
import { BulkConfigDialog } from "./components/BulkConfigDialog";
import { WeeklyOffDialog } from "./components/WeeklyOffDialog";
import { LiveCapacityTab } from "./components/LiveCapacityTab";

export default function DispatchWindowsPage() {
  const [activeTab, setActiveTab] = useState<"schedule" | "live_capacity">("schedule");
  const [viewMode, setViewMode] = useState<"summary" | "expanded">("summary");
  const [windows, setWindows] = useState<DispatchWindow[]>([]);
  const [weeklyOff, setWeeklyOff] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Modal States ──────────────────────────────────────────────
  const [editDay, setEditDay] = useState<DispatchWindow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [weeklyOffModalDay, setWeeklyOffModalDay] = useState<DispatchWindow | null>(null);

  // ─── Live Capacity Tab State ───────────────────────────────────
  const [capacityData, setCapacityData] = useState<DispatchCapacityResponse | null>(null);
  const [capacityLoading, setCapacityLoading] = useState(false);

  // ─── Data Fetching ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [res, offRes] = await Promise.all([
        getDispatchWindows(),
        getWeeklyOff().catch(() => ({ success: true as const, weeklyOff: [] })),
      ]);
      setWindows(res.dispatchWindows);
      if ("weeklyOff" in offRes && Array.isArray(offRes.weeklyOff)) {
        setWeeklyOff(offRes.weeklyOff);
      }
    } catch {
      toast.error("Failed to load dispatch windows");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCapacity = useCallback(async () => {
    setCapacityLoading(true);
    try {
      const res = await getDispatchCapacity();
      setCapacityData(res.capacity);
    } catch {
      toast.error("Failed to fetch live slot capacity");
    } finally {
      setCapacityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "live_capacity") {
      fetchCapacity();
    }
  }, [activeTab, fetchCapacity]);

  // Operating days (not marked as weekly off)
  const operatingDays = useMemo(() => {
    return ALL_DAYS.filter((d) => !weeklyOff.includes(d));
  }, [weeklyOff]);

  // ─── Operational Metrics Summary ──────────────────────────────
  const operationalStats = useMemo(() => {
    let totalWeeklyCapacity = 0;
    let totalActiveSlots = 0;
    let enabledDaysCount = 0;
    let commonSpan = "";

    for (const w of windows) {
      if (w.enabled && !weeklyOff.includes(w.day)) {
        enabledDaysCount++;
        const s = calculateDayStats(w.slots);
        totalWeeklyCapacity += s.totalCapacity;
        totalActiveSlots += s.activeSlotCount;
        if (!commonSpan && s.spanFormatted) {
          commonSpan = s.spanFormatted;
        }
      }
    }

    const avgSlots = enabledDaysCount > 0 ? Math.round(totalActiveSlots / enabledDaysCount) : 0;

    return {
      totalWeeklyCapacity,
      totalActiveSlots,
      enabledDaysCount,
      commonSpan: commonSpan || "—",
      avgSlots,
    };
  }, [windows, weeklyOff]);

  // ─── Action Handlers ───────────────────────────────────────────

  const handleCardClick = (day: DispatchWindow) => {
    const isWeeklyOffDay = weeklyOff.includes(day.day);
    if (isWeeklyOffDay) {
      setWeeklyOffModalDay(day);
    } else {
      setEditDay(day);
      setDialogOpen(true);
    }
  };

  const handleReopenWeeklyOff = async (dayName: string) => {
    try {
      const updated = weeklyOff.filter((d) => d !== dayName);
      await updateWeeklyOff(updated);
      setWeeklyOff(updated);
      toast.success(`${DAY_LABELS[dayName]} is now reopened! Dispatches and orders are active.`);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to reopen day");
      throw err;
    }
  };

  const handleSaveIndividual = async (
    dayName: string,
    enabled: boolean,
    slots: DispatchSlot[],
    applyToAll: boolean,
  ) => {
    try {
      if (applyToAll) {
        const targetDays = operatingDays.length > 0 ? operatingDays : [...ALL_DAYS];
        await updateDispatchWindowsBulk({
          days: targetDays,
          enabled,
          slots,
        });
        toast.success(`Dispatch schedule applied to all ${targetDays.length} operating days!`);
      } else {
        await updateDispatchWindow(dayName, {
          enabled,
          slots,
        });
        toast.success(`${DAY_LABELS[dayName]} dispatch schedule saved!`);
      }
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update dispatch window");
      throw err;
    }
  };

  const handleSaveBulk = async (days: string[], enabled: boolean, slots: DispatchSlot[]) => {
    try {
      await updateDispatchWindowsBulk({
        days,
        enabled,
        slots,
      });
      toast.success(`Applied dispatch schedule to ${days.length} selected day(s)!`);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update dispatch windows");
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Dispatch Windows & Slots
            </h2>
            <Badge variant="outline" className="border-primary/40 text-primary text-xs">
              Next-Day Delivery
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure delivery time windows, slot intervals, and kitchen fulfillment limits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Main Tab Switch */}
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border">
            <Button
              size="sm"
              variant={activeTab === "schedule" ? "secondary" : "ghost"}
              onClick={() => setActiveTab("schedule")}
              className="text-xs gap-1.5 h-8 font-medium"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Weekly Schedule
            </Button>
            <Button
              size="sm"
              variant={activeTab === "live_capacity" ? "secondary" : "ghost"}
              onClick={() => setActiveTab("live_capacity")}
              className="text-xs gap-1.5 h-8 font-medium"
            >
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              Tomorrow&apos;s Capacity
            </Button>
          </div>

          {activeTab === "schedule" && (
            <>
              {/* View Mode Toggle */}
              <div className="flex items-center bg-muted/40 p-1 rounded-xl border border-border/80">
                <Button
                  size="sm"
                  variant={viewMode === "summary" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("summary")}
                  className="text-xs gap-1 h-8 px-2.5"
                  title="Compact summary view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Compact</span>
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "expanded" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("expanded")}
                  className="text-xs gap-1 h-8 px-2.5"
                  title="Detailed slots view"
                >
                  <ListFilter className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Detailed</span>
                </Button>
              </div>

              {/* Bulk Apply Button */}
              <Button
                onClick={() => setBulkDialogOpen(true)}
                className="gap-2 text-xs h-8 shadow-sm"
              >
                <CalendarRange className="h-3.5 w-3.5" />
                Set for All Days
              </Button>
            </>
          )}
        </div>
      </div>

      {activeTab === "live_capacity" ? (
        /* ─── LIVE CAPACITY INSPECTOR TAB ───────────────────────── */
        <LiveCapacityTab
          data={capacityData}
          loading={capacityLoading}
          onRefresh={fetchCapacity}
        />
      ) : (
        /* ─── WEEKLY SCHEDULE VIEW ──────────────────────────────── */
        <div className="space-y-6">
          {/* Executive KPI Operational Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Operating Days
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-foreground">
                  {operationalStats.enabledDaysCount} of 7 Days
                </span>
                {weeklyOff.length > 0 && (
                  <span className="text-[11px] text-rose-400 font-medium">
                    ({weeklyOff.length} off)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {weeklyOff.length > 0
                  ? `${weeklyOff.map((d) => DAY_LABELS[d]).join(", ")} weekly closure`
                  : "7 days delivery service"}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Weekly Kitchen Capacity
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-primary">
                  {operationalStats.totalWeeklyCapacity}
                </span>
                <span className="text-xs text-muted-foreground font-medium">max orders / wk</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Sum of all active daily delivery limits
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Standard Dispatch Window
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold text-foreground font-mono">
                  {operationalStats.commonSpan}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Predominant customer delivery window
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Average Slot Density
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-foreground">
                  {operationalStats.avgSlots} Slots / Day
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {operationalStats.totalActiveSlots} total active weekly delivery slots
              </p>
            </div>
          </div>

          {/* ─── 7 DAY CARDS GRID ─────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {windows.map((day) => {
              const isWeeklyOffDay = weeklyOff.includes(day.day);
              return (
                <DayScheduleCard
                  key={day.day}
                  day={day}
                  isWeeklyOff={isWeeklyOffDay}
                  viewMode={viewMode}
                  onClick={() => handleCardClick(day)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ─── INDIVIDUAL DAY CONFIG MODAL ─────────────────────────── */}
      <SlotConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        day={editDay}
        allWindows={windows}
        weeklyOff={weeklyOff}
        operatingDays={operatingDays}
        onSave={handleSaveIndividual}
        onReopenWeeklyOff={handleReopenWeeklyOff}
        onSelectDay={(newDay) => setEditDay(newDay)}
      />

      {/* ─── BULK (ALL DAYS) CONFIG MODAL ─────────────────────────── */}
      <BulkConfigDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        operatingDays={operatingDays}
        weeklyOff={weeklyOff}
        windows={windows}
        onSaveBulk={handleSaveBulk}
      />

      {/* ─── WEEKLY OFF DAY MODAL ─────────────────────────────────── */}
      <WeeklyOffDialog
        day={weeklyOffModalDay}
        onClose={() => setWeeklyOffModalDay(null)}
        onReopen={handleReopenWeeklyOff}
        onEditTemplate={(d) => {
          setEditDay(d);
          setDialogOpen(true);
        }}
      />
    </div>
  );
}
