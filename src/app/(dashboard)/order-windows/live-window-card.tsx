"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  getLiveOrderWindowStatus,
  extendLiveOrderWindow,
  type LiveOrderWindowStatus,
  ApiError,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  Flame,
  Radio,
  Plus,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Truck,
  Users,
} from "lucide-react";
import { formatTime12 } from "@/lib/utils";

interface LiveWindowCardProps {
  onUpdated?: () => void;
}

export function LiveWindowCard({ onUpdated }: LiveWindowCardProps) {
  const [data, setData] = useState<LiveOrderWindowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Extension Form State
  const [extendMinutes, setExtendMinutes] = useState<number>(30);
  const [additionalCap, setAdditionalCap] = useState<number>(25);
  const [customEndTime, setCustomEndTime] = useState<string>("");
  const [useCustomTime, setUseCustomTime] = useState<boolean>(false);
  const [autoExtendDispatch, setAutoExtendDispatch] = useState<boolean>(true);

  // Live countdown ticker
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchLiveStatus = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await getLiveOrderWindowStatus();
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      if (!quiet) {
        toast.error(err instanceof ApiError ? err.message : "Failed to load live window status");
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveStatus();
    // Background polling every 15s to keep live count fresh
    const poll = setInterval(() => fetchLiveStatus(true), 15000);
    return () => clearInterval(poll);
  }, [fetchLiveStatus]);

  // Compute calculated values
  const activeWindow = data?.activeWindow;
  const currentOrders = data?.currentOrdersCount ?? 0;
  const maxCap = data?.maxOrders ?? 50;
  const capPercent = maxCap > 0 ? Math.min(Math.round((currentOrders / maxCap) * 100), 100) : 0;

  // Calculate live remaining seconds until window ends
  const remainingSeconds = useMemo(() => {
    if (!activeWindow || !data?.todayDateStr) return 0;
    const endIso = `${data.todayDateStr}T${activeWindow.end}:00+05:30`;
    const endMs = new Date(endIso).getTime();
    const diff = Math.max(0, Math.floor((endMs - now.getTime()) / 1000));
    return diff;
  }, [activeWindow, data?.todayDateStr, now]);

  const formatCountdown = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  };

  // Preview calculations for modal
  const previewData = useMemo(() => {
    if (!activeWindow) return null;
    const currentEnd = activeWindow.end;
    const [h, m] = currentEnd.split(":").map(Number);
    let totalMinutes = (h || 0) * 60 + (m || 0);

    let calculatedEnd = currentEnd;
    if (useCustomTime && customEndTime) {
      calculatedEnd = customEndTime;
    } else {
      totalMinutes += extendMinutes;
      const newH = Math.min(Math.floor(totalMinutes / 60), 23);
      const newM = totalMinutes % 60;
      calculatedEnd = `${newH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")}`;
    }

    const calculatedCap = maxCap + additionalCap;

    return {
      currentEnd,
      calculatedEnd,
      calculatedEndFormatted: formatTime12(calculatedEnd),
      addedMinutes: extendMinutes,
      currentCap: maxCap,
      calculatedCap,
      addedCap: additionalCap,
    };
  }, [activeWindow, extendMinutes, additionalCap, useCustomTime, customEndTime, maxCap]);

  const handleOpenExtendDialog = (quickMin = 30, quickCap = 25) => {
    setExtendMinutes(quickMin);
    setAdditionalCap(quickCap);
    setUseCustomTime(false);
    setDialogOpen(true);
  };

  const handleExtendSubmit = async () => {
    if (!data) return;
    setSubmitting(true);
    const toastId = toast.loading("Saving and updating live window...");

    try {
      const payload: {
        extendMinutes?: number;
        newEndTime?: string;
        additionalCap?: number;
        autoExtendDispatchSlots: boolean;
        targetDay?: string;
      } = {
        additionalCap,
        autoExtendDispatchSlots: autoExtendDispatch,
        targetDay: data.todayDay,
      };

      if (useCustomTime && customEndTime) {
        payload.newEndTime = customEndTime;
      } else {
        payload.extendMinutes = extendMinutes;
      }

      const res = await extendLiveOrderWindow(payload);

      toast.success(res.message || "Live window extended successfully!", { id: toastId });
      setDialogOpen(false);
      await fetchLiveStatus(true);
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to extend window", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !data) {
    return (
      <Card className="border border-neutral-800 bg-neutral-900/60 animate-pulse p-6">
        <div className="h-6 w-48 bg-neutral-800 rounded mb-4" />
        <div className="h-10 w-full bg-neutral-800 rounded" />
      </Card>
    );
  }

  const isLive = data?.isLiveOpen ?? false;
  const isCapFull = data?.isCapacityFull ?? false;

  return (
    <>
      <Card className="relative overflow-hidden border-2 border-primary/30 bg-linear-to-br from-neutral-950 via-neutral-900 to-neutral-950 shadow-xl shadow-primary/5">
        {/* Glow accent */}
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-border/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                {isLive ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-neutral-500" />
                )}
              </span>

              <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                Live Ordering Window Controller
                {isLive ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-bold px-2 py-0.5 text-xs">
                    <Radio className="h-3 w-3 mr-1 animate-pulse" /> LIVE OPEN
                  </Badge>
                ) : isCapFull ? (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 font-bold px-2 py-0.5 text-xs">
                    <Flame className="h-3 w-3 mr-1 text-amber-400" /> CAPACITY REACHED
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    DORMANT / CLOSED
                  </Badge>
                )}
              </CardTitle>
            </div>

            <CardDescription className="text-xs text-muted-foreground">
              Instant zero-load live order window extension. Extends ordering time, expands order caps, and auto-scales delivery slots with instant live sync.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLiveStatus(false)}
              className="h-8 gap-1.5 text-xs border-border/50 hover:bg-neutral-800"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>

            <Button
              size="sm"
              onClick={() => handleOpenExtendDialog(30, 25)}
              className="h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              Extend Window & Cap
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Main Grid: Status, Intake Meter & Countdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Active Window Span & Countdown */}
            <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
                <span className="font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Active Intake Window
                </span>
                <span className="capitalize font-semibold text-foreground">{data?.todayDay}</span>
              </div>

              <div className="my-1.5">
                <div className="text-xl font-bold tracking-tight text-foreground">
                  {activeWindow?.timeFormatted || "No Live Window Right Now"}
                </div>
                {activeWindow && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Closes at <strong className="text-foreground">{formatTime12(activeWindow.end)}</strong> IST
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Time Remaining:</span>
                <span className={`font-mono font-bold ${remainingSeconds < 300 && isLive ? "text-rose-400 animate-pulse" : "text-emerald-400"}`}>
                  {isLive ? formatCountdown(remainingSeconds) : "0m 00s"}
                </span>
              </div>
            </div>

            {/* 2. Cap & Order Intake Meter */}
            <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
                <span className="font-medium flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-amber-400" /> Intake Capacity Meter
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {currentOrders} / {maxCap} ({capPercent}%)
                </span>
              </div>

              <div className="my-2 space-y-1.5">
                <Progress
                  value={currentOrders}
                  max={maxCap}
                  indicatorClassName={
                    capPercent >= 90
                      ? "bg-rose-500"
                      : capPercent >= 70
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }
                  className="h-2.5 bg-neutral-800"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{data?.remainingCapacity ?? 0} slots remaining</span>
                  <span>{isCapFull ? "Intake Cap Met" : "Accepting Orders"}</span>
                </div>
              </div>

              <div className="pt-1.5 border-t border-neutral-800/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status:</span>
                <span className={`font-semibold text-xs ${isCapFull ? "text-amber-400" : "text-emerald-400"}`}>
                  {isCapFull ? "Cap Exhausted" : "Active Intake Room"}
                </span>
              </div>
            </div>

            {/* 3. Auto-Linked Dispatch Slots Preview */}
            <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
                <span className="font-medium flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-blue-400" /> Linked Dispatch Slots
                </span>
                <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/10">
                  Pre-order Model
                </Badge>
              </div>

              <div className="my-1.5 space-y-1">
                <div className="text-sm font-semibold text-foreground">
                  {data?.dispatchSlotsCount ?? 0} Dispatch Slots Configured
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Target: <strong className="text-foreground">{data?.targetDispatchDate}</strong>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Total Delivery Capacity: <strong className="text-foreground">{data?.totalDispatchCapacity ?? 0} orders</strong>
                </p>
              </div>

              <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3 w-3" /> Auto-sync enabled
                </span>
                <span>Proportional Tiling</span>
              </div>
            </div>
          </div>

          {/* Quick-Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground mr-1">Quick Extend:</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 hover:border-primary/50"
                onClick={() => handleOpenExtendDialog(15, 10)}
              >
                +15m & +10 Cap
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 hover:border-primary/50"
                onClick={() => handleOpenExtendDialog(30, 25)}
              >
                +30m & +25 Cap
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 hover:border-primary/50"
                onClick={() => handleOpenExtendDialog(60, 50)}
              >
                +1h & +50 Cap
              </Button>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span>Updates all active storefront screens in real-time with <strong>0 DB reads</strong>.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────────────── */}
      {/* EXTEND LIVE WINDOW MODAL (SHADCN DIALOG)                    */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-125 border-neutral-800 bg-neutral-950 text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Zap className="h-5 w-5 text-primary fill-current" />
              Extend Live Order Window & Cap
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Increase the open ordering window time and capacity. The system updates MongoDB atomically, syncs Redis, and pushes the event instantly to active users without database load.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {/* Time Extension Options */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Extend Closing Time</Label>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className={!useCustomTime ? "text-primary font-medium" : "text-muted-foreground"}>Quick</span>
                  <Switch
                    checked={useCustomTime}
                    onCheckedChange={setUseCustomTime}
                    aria-label="Toggle custom end time"
                  />
                  <span className={useCustomTime ? "text-primary font-medium" : "text-muted-foreground"}>Custom Time</span>
                </div>
              </div>

              {!useCustomTime ? (
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map((mins) => (
                    <Button
                      key={mins}
                      type="button"
                      variant={extendMinutes === mins ? "default" : "outline"}
                      size="sm"
                      onClick={() => setExtendMinutes(mins)}
                      className="text-xs font-semibold h-8"
                    >
                      +{mins} min
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    type="time"
                    value={customEndTime}
                    onChange={(e) => setCustomEndTime(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="HH:mm"
                  />
                  <p className="text-[11px] text-muted-foreground">Specify the exact 24-hour closing time (e.g. 17:30).</p>
                </div>
              )}
            </div>

            {/* Capacity Increase */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Increase Order Cap (+Orders)</Label>
              <div className="grid grid-cols-4 gap-2">
                {[10, 25, 50, 100].map((cap) => (
                  <Button
                    key={cap}
                    type="button"
                    variant={additionalCap === cap ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdditionalCap(cap)}
                    className="text-xs font-semibold h-8"
                  >
                    +{cap} Orders
                  </Button>
                ))}
              </div>
              <div className="pt-1 flex items-center gap-2">
                <Label htmlFor="custom-cap" className="text-xs text-muted-foreground whitespace-nowrap">
                  Custom add:
                </Label>
                <Input
                  id="custom-cap"
                  type="number"
                  min={0}
                  max={5000}
                  value={additionalCap}
                  onChange={(e) => setAdditionalCap(Math.max(0, parseInt(e.target.value || "0", 10)))}
                  className="h-8 text-xs w-28"
                />
                <span className="text-xs text-muted-foreground">orders to add</span>
              </div>
            </div>

            {/* Auto-Extend Delivery Slots Toggle */}
            <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-blue-400" /> Auto-Extend Dispatch Slots
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically tiles extra delivery slots or scales capacity proportionally.
                  </p>
                </div>
                <Switch
                  checked={autoExtendDispatch}
                  onCheckedChange={setAutoExtendDispatch}
                />
              </div>
            </div>

            {/* Live Calculation Preview Callout */}
            {previewData && (
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> Calculated Impact Preview:
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1">
                  <div>
                    <span>Closing Time: </span>
                    <strong className="text-foreground">
                      {formatTime12(previewData.currentEnd)} → {previewData.calculatedEndFormatted}
                    </strong>
                  </div>
                  <div>
                    <span>Total Order Cap: </span>
                    <strong className="text-foreground">
                      {previewData.currentCap} → {previewData.calculatedCap} orders
                    </strong>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/80 border-t border-primary/10 pt-1">
                  ✓ 1 Atomic MongoDB write · 0 Redis queries during user push · Sub-50ms instant propagation.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleExtendSubmit}
              disabled={submitting}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 fill-current" />
                  Save and Update
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

