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
  updateWeeklyOff,
  type Holiday,
  ApiError,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";

const ALL_DAYS = [
  { key: "sunday", short: "Sun", full: "Sunday" },
  { key: "monday", short: "Mon", full: "Monday" },
  { key: "tuesday", short: "Tue", full: "Tuesday" },
  { key: "wednesday", short: "Wed", full: "Wednesday" },
  { key: "thursday", short: "Thu", full: "Thursday" },
  { key: "friday", short: "Fri", full: "Friday" },
  { key: "saturday", short: "Sat", full: "Saturday" },
] as const;

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

  // Quick toggle for recurring weekly off
  const toggleWeeklyOff = async (dayKey: string) => {
    const updated = weeklyOff.includes(dayKey)
      ? weeklyOff.filter((d) => d !== dayKey)
      : [...weeklyOff, dayKey];

    // Optimistic update
    setWeeklyOff(updated);

    try {
      await updateWeeklyOff(updated);
      const dayName = dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
      toast.success(
        updated.includes(dayKey)
          ? `${dayName} marked as closed weekly`
          : `${dayName} marked as open weekly`,
      );
    } catch (err) {
      // Revert on error
      setWeeklyOff(weeklyOff);
      toast.error(err instanceof ApiError ? err.message : "Failed to update weekly off");
    }
  };

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
        `${dayName} is already configured as a recurring Weekly Off. You can adjust weekly off days in the schedule above.`,
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
      return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Holidays & Schedule</h2>
        <p className="text-sm text-muted-foreground">
          Operating schedule, kitchen hours & holiday calendar
        </p>
      </div>

      {/* 1. Weekly Off Schedule Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Weekly Off Schedule</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {weeklyOff.length === 0
                ? "Open all 7 days"
                : `${weeklyOff.length} day${weeklyOff.length === 1 ? "" : "s"} closed weekly`}
            </span>
          </div>
          <CardDescription className="text-xs">
            Click any day to immediately toggle recurring closure. Updates apply instantly without reload.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {ALL_DAYS.map((day) => {
              const isClosed = weeklyOff.includes(day.key);
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => toggleWeeklyOff(day.key)}
                  className={`
                    flex flex-col items-center justify-center py-2.5 px-2 rounded-lg border transition-all text-center
                    ${isClosed
                      ? "bg-foreground text-background border-foreground font-bold shadow-xs hover:opacity-90"
                      : "bg-card text-foreground border-border hover:bg-accent/60"
                    }
                  `}
                >
                  <span className="text-xs font-semibold">{day.short}</span>
                  <span
                    className={`text-[10px] font-bold tracking-wider mt-1 uppercase ${
                      isClosed ? "text-background" : "text-emerald-500"
                    }`}
                  >
                    {isClosed ? "CLOSED" : "OPEN"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-3 border-t">
            <Info className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span>
              Closed days will automatically reflect on the customer storefront as &ldquo;Kitchen Weekly Off&rdquo;.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Interactive Month Calendar Card */}
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
                  Click any date to schedule a holiday closure or view details
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

              <Button size="sm" onClick={() => openCreate()}>
                <Plus className="mr-1.5 h-4 w-4" /> Add Holiday
              </Button>
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
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
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
                      <div className="text-[10px] text-muted-foreground/40 italic">
                        Weekly Off
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
                  className="border-r border-b min-h-24 sm:min-h-28 p-2 bg-card hover:bg-accent/40 cursor-pointer flex flex-col justify-between group transition-colors"
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

                    {!holiday && (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground font-medium">
                        + Add
                      </span>
                    )}
                  </div>

                  {holiday ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(holiday);
                      }}
                      className="mt-1 w-full rounded border border-destructive/40 bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive flex items-center justify-between gap-1 shadow-xs hover:bg-destructive/25 transition-colors"
                      title={`Holiday: ${holiday.reason}`}
                    >
                      <span className="truncate">{holiday.reason}</span>
                      <Pencil className="h-3 w-3 shrink-0 opacity-70" />
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

      {/* 3. Scheduled Special Closures List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Scheduled Special Closures ({sortedHolidays.length})
            </CardTitle>
            {sortedHolidays.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openCreate()}
                className="h-7 text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add New
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className={sortedHolidays.length === 0 ? "py-8" : "p-0"}>
          {sortedHolidays.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
              <CalendarOff className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium">No special holiday closures scheduled</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5">
                Click any operating date on the calendar above or use the &ldquo;Add Holiday&rdquo; button.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="w-24 text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedHolidays.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                        <span>{formatDate(h.date)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs uppercase font-medium">
                      {format(new Date(h.date + "T00:00:00"), "EEEE")}
                    </TableCell>
                    <TableCell>{h.reason}</TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(h)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(h.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Holiday Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editHoliday ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
            <DialogDescription>
              {editHoliday
                ? "Update the scheduled restaurant closure."
                : "Schedule a restaurant closure date."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hol-date">Date</Label>
              <Input
                id="hol-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hol-reason">Reason</Label>
              <Input
                id="hol-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                placeholder="e.g. Dashain Festival, Kitchen Maintenance"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editHoliday ? "Update" : "Add Holiday"}
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
            <AlertDialogTitle>Delete holiday closure?</AlertDialogTitle>
            <AlertDialogDescription>
              This holiday closure will be permanently removed. The restaurant will be considered open on this day unless it falls on a weekly off.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
