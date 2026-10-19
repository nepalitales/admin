"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  addDays,
  subDays,
  isSameMonth,
  isToday,
} from "date-fns";
import { toast } from "sonner";
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getWeeklyOff,
  type Holiday,
  ApiError,
} from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Info,
  Sparkles,
  ArrowRight,
  Truck,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";

const DAY_INDEX_MAP: Record<number, string> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

const WEEK_HEADERS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [weeklyOff, setWeeklyOff] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Dialog & Form states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editHoliday, setEditHoliday] = useState<Holiday | null>(null);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [holidaysRes, weeklyOffRes] = await Promise.all([
        getHolidays(),
        getWeeklyOff(),
      ]);
      setHolidays(holidaysRes.holidays);
      setWeeklyOff(weeklyOffRes.weeklyOff);
    } catch {
      toast.error("Failed to load schedule and holidays data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Holiday map for fast YYYY-MM-DD lookups
  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const h of holidays) {
      map.set(h.date, h);
    }
    return map;
  }, [holidays]);

  // Set of dates that are the eve (day before) a scheduled holiday
  const eveOfHolidayMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const h of holidays) {
      try {
        const holidayDate = new Date(h.date + "T12:00:00");
        const eveDateStr = format(subDays(holidayDate, 1), "yyyy-MM-dd");
        map.set(eveDateStr, h);
      } catch {}
    }
    return map;
  }, [holidays]);

  // Sorted holidays for the scheduled closures list
  const sortedHolidays = useMemo(() => {
    return [...holidays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [holidays]);

  // Generate calendar days for the current view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const resetForm = () => {
    setDate("");
    setReason("");
    setEditHoliday(null);
  };

  const openCreate = (prefillDate?: string) => {
    resetForm();
    if (prefillDate) setDate(prefillDate);
    setDialogOpen(true);
  };

  const openEdit = (holiday: Holiday) => {
    setEditHoliday(holiday);
    setDate(holiday.date);
    setReason(holiday.reason);
    setDialogOpen(true);
  };

  const handleCellClick = (day: Date, isOff: boolean, holiday?: Holiday) => {
    if (holiday) {
      openEdit(holiday);
      return;
    }

    if (isOff) {
      const dayName = format(day, "EEEE");
      toast.info(
        `${dayName} is already configured as a recurring Weekly Off. You can adjust weekly off in the Weekly Off tab.`,
      );
      return;
    }

    const dateStr = format(day, "yyyy-MM-dd");
    openCreate(dateStr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editHoliday) {
        await updateHoliday(editHoliday.id, { date, reason });
        toast.success("Holiday updated");
      } else {
        await createHoliday({ date, reason });
        toast.success("Holiday added");
      }
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save holiday");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteHoliday(deleteId);
      toast.success("Holiday deleted");
      await fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete holiday");
    } finally {
      setDeleteId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + "T12:00:00").toLocaleDateString("en-IN", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Helper calculation for the form modal preview
  const formPreview = useMemo(() => {
    if (!date) return null;
    try {
      const holDate = new Date(date + "T12:00:00");
      const eveDate = subDays(holDate, 1);
      return {
        holidayFormatted: format(holDate, "EEEE, d MMMM yyyy"),
        eveFormatted: format(eveDate, "EEEE, d MMMM yyyy"),
      };
    } catch {
      return null;
    }
  }, [date]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Holiday &amp; Festival Calendar</h2>
          <p className="text-sm text-muted-foreground">
            Schedule festival holidays (e.g. Dussehra, Diwali, Maintenance) where the kitchen is 100% free.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/weekly-off"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <CalendarOff className="h-4 w-4 mr-1.5 text-muted-foreground" />
            Manage Weekly Off
          </Link>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Holiday
          </Button>
        </div>
      </div>

      {/* ── 1-Day Advance Pre-Order Architectural Rule Callout ── */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>How Festival &amp; Special Holidays Work (1-Day Advance Pre-Order)</span>
            </div>
            <Badge variant="outline" className="border-amber-500/40 text-amber-500 bg-amber-500/10 text-xs">
              Automatic Intake Cut-off
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-500">
                <ShoppingBag className="h-4 w-4" />
                <span>1. The Day Before the Holiday (Order Intake Closed)</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                For example, if <strong>20th October (Dussehra)</strong> is marked as a holiday, customer ordering on the website is <strong>automatically closed on 19th October</strong>. No orders are accepted.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-500">
                <Truck className="h-4 w-4" />
                <span>2. On the Holiday (Kitchen &amp; Admins 100% Free)</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                On <strong>20th October</strong>, because zero orders were taken the day before, <strong>no food is cooked and no dispatches occur</strong>. Kitchen staff and admins enjoy a completely work-free holiday!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Interactive Month Calendar Card ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg border bg-muted/40 flex items-center justify-center text-foreground shrink-0">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold tracking-tight">
                  {format(currentMonth, "MMMM yyyy")}
                </CardTitle>
                <CardDescription className="text-xs">
                  Click any date to schedule a holiday or view its pre-order cut-off impact
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="flex items-center rounded-lg border bg-background p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                  title="Previous Month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs font-medium"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                  title="Next Month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-y bg-muted/20 text-center py-2.5 text-xs font-semibold text-muted-foreground tracking-wider uppercase">
            {WEEK_HEADERS.map((name) => (
              <div key={name}>{name}</div>
            ))}
          </div>

          {/* Month Date Grid */}
          <div className="grid grid-cols-7 border-l">
            {calendarDays.map((day, idx) => {
              const inCurrentMonth = isSameMonth(day, currentMonth);
              const isCurrentDay = isToday(day);
              const dayIndex = day.getDay();
              const dayKey = DAY_INDEX_MAP[dayIndex];
              const isOff = weeklyOff.includes(dayKey);
              const dateStr = format(day, "yyyy-MM-dd");
              const holiday = holidayMap.get(dateStr);
              const eveHoliday = eveOfHolidayMap.get(dateStr);

              // Days outside current month
              if (!inCurrentMonth) {
                return (
                  <div
                    key={idx}
                    className="border-r border-b min-h-24 sm:min-h-28 p-2 bg-muted/10 opacity-25 select-none"
                  >
                    <span className="text-xs text-muted-foreground font-medium">
                      {format(day, "d")}
                    </span>
                  </div>
                );
              }

              // Weekly Off days in current month
              if (isOff) {
                return (
                  <div
                    key={idx}
                    onClick={() => handleCellClick(day, true, holiday)}
                    className="border-r border-b min-h-24 sm:min-h-28 p-2 bg-muted/25 cursor-not-allowed flex flex-col justify-between select-none transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      {isCurrentDay ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background font-bold text-xs">
                          {format(day, "d")}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground/80">
                          {format(day, "d")}
                        </span>
                      )}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80">
                        OFF
                      </span>
                    </div>

                    {holiday ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(holiday);
                        }}
                        className="mt-1 w-full rounded border border-destructive/40 bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive flex items-center justify-between gap-1 shadow-xs hover:bg-destructive/25 cursor-pointer"
                        title={`Holiday: ${holiday.reason}`}
                      >
                        <span className="truncate">{holiday.reason}</span>
                        <Pencil className="h-3 w-3 shrink-0 opacity-70" />
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground/60 font-medium">
                        Weekly Off (Dispatch Closed)
                      </div>
                    )}
                  </div>
                );
              }

              // Operating day in current month
              return (
                <div
                  key={idx}
                  onClick={() => handleCellClick(day, false, holiday)}
                  className={`border-r border-b min-h-24 sm:min-h-28 p-2 cursor-pointer flex flex-col justify-between group transition-colors ${
                    holiday
                      ? "bg-rose-500/10 hover:bg-rose-500/15"
                      : eveHoliday
                      ? "bg-amber-500/10 hover:bg-amber-500/15"
                      : "bg-card hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {isCurrentDay ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background font-bold text-xs">
                        {format(day, "d")}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-foreground/90">
                        {format(day, "d")}
                      </span>
                    )}

                    {!holiday && !eveHoliday && (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground font-medium">
                        + Holiday
                      </span>
                    )}
                  </div>

                  {/* Holiday Display */}
                  {holiday ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(holiday);
                      }}
                      className="mt-1 w-full rounded-md border border-rose-500/40 bg-rose-500/20 px-2 py-1.5 text-xs font-bold text-rose-400 flex items-center justify-between gap-1 shadow-xs hover:bg-rose-500/30 transition-colors"
                      title={`Holiday: ${holiday.reason}. Kitchen & dispatches closed today.`}
                    >
                      <div className="truncate">
                        <span className="block truncate font-bold">🏖️ {holiday.reason}</span>
                        <span className="text-[10px] font-medium opacity-80 block">Kitchen Free</span>
                      </div>
                      <Pencil className="h-3 w-3 shrink-0 opacity-70" />
                    </div>
                  ) : eveHoliday ? (
                    <div
                      className="mt-1 w-full rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-400 space-y-0.5"
                      title={`Order Intake is closed today because tomorrow is a holiday (${eveHoliday.reason}).`}
                    >
                      <span className="block truncate">🛑 Intake Closed</span>
                      <span className="text-[10px] font-normal text-muted-foreground block truncate">
                        (Holiday tomorrow)
                      </span>
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Scheduled Closures Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Scheduled Festival Closures ({sortedHolidays.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Every holiday automatically pauses customer order intake on the preceding day.
              </CardDescription>
            </div>
            {sortedHolidays.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openCreate()}
                className="h-8 text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add New Holiday
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className={sortedHolidays.length === 0 ? "py-8" : "p-0"}>
          {sortedHolidays.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
              <CalendarOff className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium">No festival holiday closures scheduled</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5">
                Click any operating date on the calendar above or use the &ldquo;Add Holiday&rdquo; button.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Holiday Date (Kitchen Free)</TableHead>
                  <TableHead>Intake Closed Date (Eve)</TableHead>
                  <TableHead>Occasion / Reason</TableHead>
                  <TableHead>Operating Impact</TableHead>
                  <TableHead className="w-24 text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedHolidays.map((h) => {
                  let eveDateStr = "";
                  try {
                    const d = new Date(h.date + "T12:00:00");
                    eveDateStr = format(subDays(d, 1), "EEE, d MMM yyyy");
                  } catch {}

                  return (
                    <TableRow key={h.id}>
                      <TableCell className="font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                          <span>{formatDate(h.date)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-medium">
                        <span className="text-amber-400 font-semibold">{eveDateStr}</span>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {h.reason}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-rose-500/40 text-rose-500 bg-rose-500/10 text-[11px]">
                          Zero Cooking · Zero Deliveries
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(h)}
                            title="Edit Holiday"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(h.id)}
                            title="Delete Holiday"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit Holiday Dialog ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <span>{editHoliday ? "Edit Festival Holiday" : "Schedule Festival Holiday"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure a holiday date when the kitchen does not cook or dispatch orders.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="hol-date" className="text-xs font-semibold">Holiday Date (When Kitchen is Free)</Label>
              <Input
                id="hol-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hol-reason" className="text-xs font-semibold">Occasion / Reason</Label>
              <Input
                id="hol-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                placeholder="e.g. Dussehra Festival, Kitchen Maintenance, Diwali"
                autoFocus
              />
            </div>

            {/* Live 1-Day Advance Pre-order Explainer Card */}
            {formPreview && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Info className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>1-Day Pre-Order Impact Preview</span>
                </div>
                <div className="space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-rose-500 shrink-0">🛑 {formPreview.eveFormatted}:</span>
                    <span>Customer order intake is <strong>automatically closed</strong>. No orders will be received.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-emerald-500 shrink-0">🏖️ {formPreview.holidayFormatted}:</span>
                    <span>Kitchen &amp; delivery staff are <strong>100% free</strong>. No cooking or deliveries to handle!</span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editHoliday ? "Update Holiday" : "Confirm & Save Holiday"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scheduled Holiday?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              Are you sure you want to remove this holiday? Customer order intake on the day before and cooking on the holiday date will immediately revert to normal operating hours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Holiday</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
