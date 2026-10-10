"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  getOrderWindows,
  updateOrderWindow,
  updateOrderWindowsBulk,
  getWeeklyOff,
  updateWeeklyOff,
  type OrderWindow,
  type TimeWindow,
  ApiError,
} from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Clock,
  Loader2,
  CalendarOff,
  ArrowUpRight,
  CalendarRange,
  AlertCircle,
  Copy,
  Check,
  Info,
} from "lucide-react";
import Link from "next/link";
import { formatTime12 } from "@/lib/utils";

const ALL_DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DAY_LABELS: Record<string, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

const DAY_SHORT: Record<string, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

function calculateDuration(start: string, end: string): string {
  if (!start || !end || start >= end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (sh === undefined || sm === undefined || eh === undefined || em === undefined) return "";
  const totalMinutes = eh * 60 + em - (sh * 60 + sm);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function validateTimeSlots(slots: TimeWindow[]): string | null {
  if (slots.length === 0) return null;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]!;
    if (!s.start || !s.end) return `Slot ${i + 1} has incomplete times`;
    if (s.start >= s.end) return `Slot ${i + 1}: Start time (${formatTime12(s.start)}) must be before end time (${formatTime12(s.end)})`;
  }
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.start < sorted[i - 1]!.end) {
      return `Slot conflict: ${formatTime12(sorted[i - 1]!.start)}–${formatTime12(sorted[i - 1]!.end)} overlaps with ${formatTime12(sorted[i]!.start)}–${formatTime12(sorted[i]!.end)}`;
    }
  }
  return null;
}

export default function OrderWindowsPage() {
  const [windows, setWindows] = useState<OrderWindow[]>([]);
  const [weeklyOff, setWeeklyOff] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Individual Day Edit Dialog State
  const [editDay, setEditDay] = useState<OrderWindow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeWindow[]>([]);
  const [applyToAllDays, setApplyToAllDays] = useState(false);

  // Bulk Apply Dialog State
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDays, setBulkDays] = useState<string[]>([]);
  const [bulkEnabled, setBulkEnabled] = useState(true);
  const [bulkSlots, setBulkSlots] = useState<TimeWindow[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [res, offRes] = await Promise.all([
        getOrderWindows(),
        getWeeklyOff(),
      ]);
      setWindows(res.orderWindows);
      setWeeklyOff(offRes.weeklyOff);
    } catch {
      toast.error("Failed to load order windows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Operating days (days not marked as weekly off)
  const operatingDays = useMemo(() => {
    return ALL_DAYS.filter((d) => !weeklyOff.includes(d));
  }, [weeklyOff]);

  // Weekly Off Info Modal State
  const [weeklyOffModalDay, setWeeklyOffModalDay] = useState<OrderWindow | null>(null);
  const [reopeningWeeklyOff, setReopeningWeeklyOff] = useState(false);

  const handleReopenWeeklyOff = async (dayName: string) => {
    setReopeningWeeklyOff(true);
    try {
      const updated = weeklyOff.filter((d) => d !== dayName);
      await updateWeeklyOff(updated);
      setWeeklyOff(updated);
      toast.success(`${DAY_LABELS[dayName]} is now reopened! Ordering is active.`);
      setWeeklyOffModalDay(null);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to reopen day");
    } finally {
      setReopeningWeeklyOff(false);
    }
  };

  const handleCardClick = (day: OrderWindow) => {
    const isWeeklyOff = weeklyOff.includes(day.day);
    if (isWeeklyOff) {
      setWeeklyOffModalDay(day);
    } else {
      openEdit(day);
    }
  };

  // Open individual edit dialog
  const openEdit = (day: OrderWindow) => {
    setEditDay(day);
    setEnabled(day.enabled);
    setTimeSlots(
      day.windows && day.windows.length > 0
        ? day.windows.map((w) => ({ ...w }))
        : [],
    );
    setApplyToAllDays(false);
    setDialogOpen(true);
  };

  // Open bulk edit dialog
  const openBulkDialog = () => {
    // Default to operating days
    setBulkDays(operatingDays.length > 0 ? [...operatingDays] : [...ALL_DAYS]);
    setBulkEnabled(true);
    setBulkSlots([]);
    setBulkDialogOpen(true);
  };

  // Individual slot mutations
  const addSlot = () => {
    if (timeSlots.length >= 10) {
      toast.error("Maximum 10 slots allowed per day");
      return;
    }
    setTimeSlots([...timeSlots, { start: "", end: "", maxOrders: undefined }]);
  };

  const removeSlot = (idx: number) => {
    setTimeSlots(timeSlots.filter((_, i) => i !== idx));
  };

  const updateSlot = (idx: number, field: "start" | "end" | "maxOrders", value: string | number | undefined) => {
    const updated = [...timeSlots];
    updated[idx] = { ...updated[idx]!, [field]: value };
    setTimeSlots(updated);
  };

  // Bulk slot mutations
  const addBulkSlot = () => {
    if (bulkSlots.length >= 10) {
      toast.error("Maximum 10 slots allowed");
      return;
    }
    setBulkSlots([...bulkSlots, { start: "", end: "", maxOrders: undefined }]);
  };

  const removeBulkSlot = (idx: number) => {
    setBulkSlots(bulkSlots.filter((_, i) => i !== idx));
  };

  const updateBulkSlot = (idx: number, field: "start" | "end" | "maxOrders", value: string | number | undefined) => {
    const updated = [...bulkSlots];
    updated[idx] = { ...updated[idx]!, [field]: value };
    setBulkSlots(updated);
  };

  const toggleBulkDay = (day: string) => {
    setBulkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  // Slot validation errors
  const slotError = useMemo(() => {
    if (!enabled) return null;
    return validateTimeSlots(timeSlots);
  }, [enabled, timeSlots]);

  const bulkSlotError = useMemo(() => {
    if (!bulkEnabled) return null;
    return validateTimeSlots(bulkSlots);
  }, [bulkEnabled, bulkSlots]);

  // Submit Individual Day
  const handleIndividualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDay) return;

    if (enabled && slotError) {
      toast.error(slotError);
      return;
    }

    setSaving(true);
    try {
      const payloadWindows = enabled ? timeSlots : [];

      if (applyToAllDays) {
        // Apply to all operating days (or all days if user wants)
        const targetDays = operatingDays.length > 0 ? operatingDays : [...ALL_DAYS];
        await updateOrderWindowsBulk({
          days: targetDays,
          enabled,
          windows: payloadWindows,
        });
        toast.success(`Order window schedule applied to ${targetDays.length} operating days`);
      } else {
        await updateOrderWindow(editDay.day, {
          enabled,
          windows: payloadWindows,
        });
        toast.success(`${DAY_LABELS[editDay.day]} schedule saved`);
      }

      setDialogOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update order window");
    } finally {
      setSaving(false);
    }
  };

  // Submit Bulk Update
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkDays.length === 0) {
      toast.error("Please select at least one day to apply schedule to");
      return;
    }

    if (bulkEnabled && bulkSlotError) {
      toast.error(bulkSlotError);
      return;
    }

    setBulkSaving(true);
    try {
      await updateOrderWindowsBulk({
        days: bulkDays,
        enabled: bulkEnabled,
        windows: bulkEnabled ? bulkSlots : [],
      });
      toast.success(`Applied order windows to ${bulkDays.length} day(s)`);
      setBulkDialogOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update order windows");
    } finally {
      setBulkSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Title and "Set All Days" Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Order Windows</h2>
          <p className="text-sm text-muted-foreground">
            Configure customer ordering intake hours (when customers can place orders on the app).
          </p>
        </div>

        <Button onClick={openBulkDialog} className="self-start sm:self-auto gap-2">
          <CalendarRange className="h-4 w-4" />
          Set for All Days
        </Button>
      </div>

      {/* Explanatory callout distinguishing Order Windows from Dispatch Windows */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-foreground">Order Windows vs. Dispatch Windows:</span>
          <p className="text-[11px] leading-relaxed">
            <strong>Order Windows</strong> control <strong>WHEN customers can place orders</strong> on the website (e.g. today between 2:00 PM – 4:00 PM) and the maximum session intake cap before ordering closes.
            To manage customer <strong>delivery time slots</strong> (e.g. tomorrow 2:00 PM – 9:00 PM, 30 orders/slot), use the{" "}
            <Link href="/dispatch-windows" className="text-primary font-semibold hover:underline">
              Dispatch Windows
            </Link>{" "}
            tab.
          </p>
        </div>
      </div>

      {/* Grid of Day Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {windows.map((day) => {
          const isWeeklyOff = weeklyOff.includes(day.day);
          const hasSlots = day.enabled && day.windows.length > 0;

          return (
            <Card
              key={day.day}
              className={`transition-all ${
                isWeeklyOff
                  ? "opacity-75 border-dashed bg-muted/20 cursor-pointer hover:border-destructive/40 hover:bg-destructive/5"
                  : "cursor-pointer hover:border-primary/50 hover:shadow-md"
              }`}
              onClick={() => handleCardClick(day)}
            >
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">{DAY_LABELS[day.day]}</CardTitle>
                  <span className="text-[11px] text-muted-foreground">
                    {isWeeklyOff
                      ? "Weekly closure active"
                      : day.enabled
                      ? `${day.windows.length} intake window${day.windows.length === 1 ? "" : "s"}`
                      : "Closed"}
                  </span>
                </div>
                {isWeeklyOff ? (
                  <Badge
                    variant="outline"
                    className="text-xs border-destructive/30 text-destructive bg-destructive/10"
                  >
                    Weekly Off
                  </Badge>
                ) : (
                  <Badge variant={day.enabled ? "default" : "secondary"} className="text-xs">
                    {day.enabled ? "Open" : "Closed"}
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="space-y-2">
                {isWeeklyOff ? (
                  <div className="space-y-1.5 py-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarOff className="h-3.5 w-3.5 text-destructive/80" />
                      <span>Closed every {DAY_LABELS[day.day]}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70">
                      Managed in Weekly Off
                    </p>
                  </div>
                ) : hasSlots ? (
                  <div className="space-y-1.5">
                    {day.windows.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-md bg-muted/40 border border-border/50"
                      >
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{formatTime12(w.start)} – {formatTime12(w.end)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {w.maxOrders ? (
                            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary py-0 px-1 font-bold">
                              Cap: {w.maxOrders}
                            </Badge>
                          ) : null}
                          <span className="text-[10px] text-muted-foreground">
                            {calculateDuration(w.start, w.end)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-2 text-center text-xs text-muted-foreground/80">
                    No time slots configured
                  </div>
                )}

                {/* Card Action Hint */}
                <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                  {isWeeklyOff ? (
                    <>
                      <span className="text-destructive/80 font-medium">Weekly closure</span>
                      <span className="text-primary font-medium hover:underline flex items-center gap-0.5">
                        Manage Closure <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Click to edit</span>
                      <span className="text-primary font-medium hover:underline flex items-center gap-0.5">
                        <Plus className="h-3 w-3" /> Add / Edit Slots
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. INDIVIDUAL DAY EDIT DIALOG */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Edit {editDay ? DAY_LABELS[editDay.day] : ""}</span>
              {editDay && (
                <Badge variant="outline" className="text-xs font-normal">
                  {DAY_SHORT[editDay.day]}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {editDay && weeklyOff.includes(editDay.day)
                ? `${DAY_LABELS[editDay.day]} is currently set as a recurring weekly off day.`
                : "Add or manage ordering time slots for this day."}
            </DialogDescription>
          </DialogHeader>

          {editDay && weeklyOff.includes(editDay.day) && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2.5">
              <CalendarOff className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-xs leading-none">Weekly Off is active</p>
                <p className="text-xs text-muted-foreground">
                  The restaurant is closed every {DAY_LABELS[editDay.day]}. To open ordering on this day, remove it from Weekly Off schedule first.
                </p>
                <Link
                  href="/weekly-off"
                  onClick={() => setDialogOpen(false)}
                  className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline pt-0.5"
                >
                  Manage Weekly Off <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={handleIndividualSubmit} className="space-y-5">
            {/* Toggle Accept Orders */}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/10">
              <div className="space-y-0.5">
                <Label htmlFor="day-enabled" className="text-sm font-medium">
                  Accept orders on this day
                </Label>
                <p className="text-xs text-muted-foreground">
                  {enabled
                    ? "Customers can place orders during configured slots"
                    : "No orders will be accepted on this day"}
                </p>
              </div>
              <Switch
                id="day-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={editDay ? weeklyOff.includes(editDay.day) : false}
              />
            </div>

            {/* Time Slots List */}
            {enabled && !weeklyOff.includes(editDay?.day ?? "") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Time Slots</Label>
                    <Badge variant="secondary" className="text-xs">
                      {timeSlots.length} slot{timeSlots.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSlot}
                    disabled={timeSlots.length >= 10}
                    className="h-8 gap-1 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Slot
                  </Button>
                </div>

                {slotError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{slotError}</span>
                  </div>
                )}

                <div className="space-y-2.5">
                  {timeSlots.map((slot, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-border bg-card/80 hover:bg-card transition-colors space-y-2.5"
                    >
                      {/* Top Line: Slot index, Time Inputs, 12-hr Badge, Duration, and Delete Button */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground w-12 shrink-0">
                            Slot {idx + 1}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Input
                              type="time"
                              value={slot.start}
                              onChange={(e) => updateSlot(idx, "start", e.target.value)}
                              className="w-24 text-xs h-8 px-2 font-mono"
                              required
                            />
                            <span className="text-xs text-muted-foreground font-medium">to</span>
                            <Input
                              type="time"
                              value={slot.end}
                              onChange={(e) => updateSlot(idx, "end", e.target.value)}
                              className="w-24 text-xs h-8 px-2 font-mono"
                              required
                            />
                          </div>
                          <Badge variant="outline" className="text-[11px] font-mono py-0.5 px-2 shrink-0 hidden sm:inline-flex">
                            {formatTime12(slot.start)} - {formatTime12(slot.end)}
                          </Badge>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSlot(idx)}
                          disabled={timeSlots.length === 1}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 disabled:opacity-30"
                          title={timeSlots.length === 1 ? "At least one slot is required" : "Remove slot"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Bottom Line: Session Intake Cap & Duration */}
                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">
                            Session Order Cap:
                          </Label>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={1}
                              max={1000}
                              value={slot.maxOrders ?? ""}
                              onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                                updateSlot(idx, "maxOrders", val);
                              }}
                              className="w-20 text-xs h-7 text-center font-bold"
                              placeholder="No limit"
                              title="Stop taking orders once this count is reached during this ordering window"
                            />
                            <span className="text-[11px] text-muted-foreground">orders max</span>
                          </div>
                        </div>

                        <span className="text-[11px] text-muted-foreground">
                          Duration: {calculateDuration(slot.start, slot.end)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Secondary Add Slot Button */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={addSlot}
                  disabled={timeSlots.length >= 10}
                  className="w-full border border-dashed text-xs text-muted-foreground hover:text-foreground h-9"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Another Time Slot
                </Button>

                {/* Bulk Apply Checkbox inside Individual Modal */}
                <div className="pt-3 border-t">
                  <label className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyToAllDays}
                      onChange={(e) => setApplyToAllDays(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span>
                      Apply this schedule to <strong>all operating days</strong> ({operatingDays.length} days)
                    </span>
                  </label>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              {!weeklyOff.includes(editDay?.day ?? "") && (
                <Button type="submit" disabled={saving || (enabled && !!slotError)}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {applyToAllDays ? "Apply to All Operating Days" : "Save Changes"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 1.5 WEEKLY OFF DAY DIALOG (DEDICATED MODAL FOR CLOSED DAYS) */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog
        open={!!weeklyOffModalDay}
        onOpenChange={(open) => !open && setWeeklyOffModalDay(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-destructive mb-1">
              <div className="p-2 rounded-full bg-destructive/10 border border-destructive/20">
                <CalendarOff className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg">
                {weeklyOffModalDay ? DAY_LABELS[weeklyOffModalDay.day] : ""} is Closed
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              This day is set as a recurring weekly closure in your Weekly Off schedule.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Operating Status:</span>
                <Badge
                  variant="outline"
                  className="border-destructive/40 text-destructive bg-destructive/10 text-xs font-semibold"
                >
                  Weekly Off Active
                </Badge>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                During Weekly Off days, customers cannot place orders or schedule deliveries. Ordering time slots cannot be active for this day.
              </p>
              {weeklyOffModalDay?.windows && weeklyOffModalDay.windows.length > 0 && (
                <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                  Saved standby slots:{" "}
                  <span className="font-semibold text-foreground">
                    {weeklyOffModalDay.windows.length} slots
                  </span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            {weeklyOffModalDay && (
              <Button
                onClick={() => handleReopenWeeklyOff(weeklyOffModalDay.day)}
                disabled={reopeningWeeklyOff}
                className="w-full text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {reopeningWeeklyOff ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Reopen {DAY_LABELS[weeklyOffModalDay.day]} (Remove from Weekly Off)
              </Button>
            )}

            <Link
              href="/weekly-off"
              onClick={() => setWeeklyOffModalDay(null)}
              className={buttonVariants({
                variant: "outline",
                className: "w-full text-xs gap-1.5",
              })}
            >
              Manage Weekly Off Schedule
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const dayToEdit = weeklyOffModalDay;
                setWeeklyOffModalDay(null);
                if (dayToEdit) openEdit(dayToEdit);
              }}
              className="w-full text-[11px] text-muted-foreground hover:text-foreground h-7"
            >
              Configure ordering slot template in advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. SET ORDER WINDOWS FOR ALL DAYS DIALOG */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CalendarRange className="h-5 w-5 text-primary" />
              <span>Set Order Windows for All Days</span>
            </DialogTitle>
            <DialogDescription>
              Configure standard ordering hours and apply them across multiple days at once.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleBulkSubmit} className="space-y-5">
            {/* Target Days Selector */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Target Days ({bulkDays.length}/7 selected)
                </Label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs font-medium"
                    onClick={() => setBulkDays([...operatingDays])}
                  >
                    Operating Days ({operatingDays.length})
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs font-medium"
                    onClick={() => setBulkDays([...ALL_DAYS])}
                  >
                    All 7 Days
                  </Button>
                </div>
              </div>

              {/* Day chips in spacious 7-col grid */}
              <div className="grid grid-cols-7 gap-2">
                {ALL_DAYS.map((day) => {
                  const isSelected = bulkDays.includes(day);
                  const isOff = weeklyOff.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleBulkDay(day)}
                      className={`
                        flex flex-col items-center justify-center py-2.5 px-1.5 rounded-lg border text-center transition-all text-xs
                        ${isSelected
                          ? "bg-foreground text-background border-foreground font-semibold shadow-xs"
                          : "bg-card text-foreground border-border hover:bg-accent"
                        }
                      `}
                    >
                      <span className="font-semibold text-xs">{DAY_SHORT[day]}</span>
                      {isOff ? (
                        <span
                          className={`text-[9px] font-bold tracking-wider mt-0.5 uppercase ${
                            isSelected ? "text-background/80" : "text-destructive"
                          }`}
                        >
                          OFF
                        </span>
                      ) : (
                        <span
                          className={`text-[9px] font-bold tracking-wider mt-0.5 uppercase ${
                            isSelected ? "text-background/80" : "text-emerald-500"
                          }`}
                        >
                          OPEN
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle Enable/Disable for Selected Days */}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/10">
              <div className="space-y-0.5">
                <Label htmlFor="bulk-enabled" className="text-sm font-medium">
                  Accept orders on selected days
                </Label>
                <p className="text-xs text-muted-foreground">
                  {bulkEnabled
                    ? "Apply time slots to selected days"
                    : "Close ordering completely on selected days"}
                </p>
              </div>
              <Switch
                id="bulk-enabled"
                checked={bulkEnabled}
                onCheckedChange={setBulkEnabled}
              />
            </div>

            {/* Time Slots */}
            {bulkEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Time Slots to Apply</Label>
                    <Badge variant="secondary" className="text-xs">
                      {bulkSlots.length} slot{bulkSlots.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBulkSlot}
                    disabled={bulkSlots.length >= 10}
                    className="h-8 gap-1 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Slot
                  </Button>
                </div>

                {bulkSlotError && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{bulkSlotError}</span>
                  </div>
                )}

                <div className="space-y-2.5">
                  {bulkSlots.map((slot, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-border bg-card/80 hover:bg-card transition-colors space-y-2.5"
                    >
                      {/* Top Line: Slot index, Time Inputs, 12-hr Badge, Duration, and Delete Button */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground w-12 shrink-0">
                            Slot {idx + 1}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Input
                              type="time"
                              value={slot.start}
                              onChange={(e) => updateBulkSlot(idx, "start", e.target.value)}
                              className="w-24 text-xs h-8 px-2 font-mono"
                              required
                            />
                            <span className="text-xs text-muted-foreground font-medium">to</span>
                            <Input
                              type="time"
                              value={slot.end}
                              onChange={(e) => updateBulkSlot(idx, "end", e.target.value)}
                              className="w-24 text-xs h-8 px-2 font-mono"
                              required
                            />
                          </div>
                          <Badge variant="outline" className="text-[11px] font-mono py-0.5 px-2 shrink-0 hidden sm:inline-flex">
                            {formatTime12(slot.start)} - {formatTime12(slot.end)}
                          </Badge>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBulkSlot(idx)}
                          disabled={bulkSlots.length === 1}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 disabled:opacity-30"
                          title={bulkSlots.length === 1 ? "At least one slot is required" : "Remove slot"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Bottom Line: Session Intake Cap & Duration */}
                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">
                            Session Order Cap:
                          </Label>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={1}
                              max={1000}
                              value={slot.maxOrders ?? ""}
                              onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                                updateBulkSlot(idx, "maxOrders", val);
                              }}
                              className="w-20 text-xs h-7 text-center font-bold"
                              placeholder="No limit"
                              title="Stop taking orders once this count is reached during this ordering window"
                            />
                            <span className="text-[11px] text-muted-foreground">orders max</span>
                          </div>
                        </div>

                        <span className="text-[11px] text-muted-foreground">
                          Duration: {calculateDuration(slot.start, slot.end)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={addBulkSlot}
                  disabled={bulkSlots.length >= 10}
                  className="w-full border border-dashed text-xs text-muted-foreground hover:text-foreground h-9"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Another Time Slot
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={bulkSaving || bulkDays.length === 0 || (bulkEnabled && !!bulkSlotError)}
              >
                {bulkSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply to {bulkDays.length} Day{bulkDays.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
