"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { getWeeklyOff, updateWeeklyOff, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Info,
  CalendarOff,
  Truck,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";

const ALL_DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

type DayKey = (typeof ALL_DAYS)[number];

const DAY_LABELS: Record<string, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

const DAY_FULL: Record<string, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

const NEXT_DAY: Record<string, string> = {
  sunday: "monday",
  monday: "tuesday",
  tuesday: "wednesday",
  wednesday: "thursday",
  thursday: "friday",
  friday: "saturday",
  saturday: "sunday",
};

const PREV_DAY: Record<string, string> = {
  sunday: "saturday",
  monday: "sunday",
  tuesday: "monday",
  wednesday: "tuesday",
  thursday: "wednesday",
  friday: "thursday",
  saturday: "friday",
};

export default function WeeklyOffPage() {
  // selectedDispatchOffDays: days when kitchen does not deliver (stored in DB as weekly_off.days)
  const [selectedDispatchOffDays, setSelectedDispatchOffDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await getWeeklyOff();
      setSelectedDispatchOffDays(res.weeklyOff || []);
    } catch {
      toast.error("Failed to load weekly off schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived: days when order intake is closed (the day before dispatch is closed)
  const intakeClosedDays = useMemo(() => {
    return selectedDispatchOffDays.map((d) => PREV_DAY[d] || "").filter(Boolean);
  }, [selectedDispatchOffDays]);

  // Toggle from the "Dispatch Closed" perspective (e.g. Monday)
  const toggleDispatchOffDay = (day: string) => {
    setSelectedDispatchOffDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  // Toggle from the "Kitchen Order Intake Closed" perspective (e.g. Sunday)
  const toggleIntakeClosedDay = (day: string) => {
    const nextDay = NEXT_DAY[day];
    if (!nextDay) return;
    toggleDispatchOffDay(nextDay);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateWeeklyOff(selectedDispatchOffDays);
      toast.success("Weekly off schedule updated successfully");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update schedule");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Kitchen &amp; Dispatch Weekly Off</h2>
        <p className="text-muted-foreground text-sm">
          Nepali Tales operates on a strict <strong>1-day advance pre-order</strong> schedule. Configure both your <strong>order intake closure days</strong> and <strong>kitchen dispatch closure days</strong> below.
        </p>
      </div>

      {/* ── Operational Architecture Visual Explainer ── */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs space-y-3 text-foreground">
        <div className="font-semibold text-sm flex items-center gap-2">
          <Info className="h-4 w-4 text-amber-500 shrink-0" />
          <span>Understanding the 1-Day Pre-Order Relationship</span>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          Because dishes are handcrafted fresh the day before delivery:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="bg-background/80 rounded-lg p-3 border border-border/60 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <ShoppingBag className="h-4 w-4 text-rose-500" />
              <span>1. Kitchen Intake Closed (Storefront)</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              If kitchen ordering is closed on <strong>Sunday</strong>, no customer can place orders on Sunday. This automatically means there are <strong>no dispatches on Monday</strong>.
            </p>
          </div>

          <div className="bg-background/80 rounded-lg p-3 border border-border/60 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <Truck className="h-4 w-4 text-amber-500" />
              <span>2. Dispatch Closed (Kitchen &amp; Delivery)</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              On <strong>Monday</strong>, no deliveries happen. However, <strong>ordering is OPEN on Monday</strong> (2 PM – 4 PM) for <strong>Tuesday</strong> dispatches!
            </p>
          </div>
        </div>
      </div>

      {/* ── Dual Control Panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Panel 1: Kitchen Order Intake Closed */}
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-500">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Option 1: Kitchen Closed (No Orders)</CardTitle>
                <CardDescription className="text-xs">
                  Days when customers <strong>CANNOT</strong> place orders on the storefront.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {ALL_DAYS.map((day) => {
                const isClosed = intakeClosedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleIntakeClosedDay(day)}
                    className={`
                      inline-flex items-center justify-center rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer select-none
                      ${
                        isClosed
                          ? "border-rose-500/60 bg-rose-500/20 text-rose-400 shadow-xs ring-1 ring-rose-500/30"
                          : "border-border bg-card text-foreground hover:bg-accent"
                      }
                    `}
                  >
                    {DAY_FULL[day]}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Selecting <strong className="text-foreground">Sunday</strong> here blocks customers from checking out on Sunday and automatically marks <strong className="text-foreground">Monday</strong> as dispatch off.
            </p>
          </CardContent>
        </Card>

        {/* Panel 2: Kitchen Dispatch Closed */}
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Option 2: Dispatch Closed (No Delivery)</CardTitle>
                <CardDescription className="text-xs">
                  Days when the kitchen does <strong>NOT</strong> cook or deliver food.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {ALL_DAYS.map((day) => {
                const isOff = selectedDispatchOffDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDispatchOffDay(day)}
                    className={`
                      inline-flex items-center justify-center rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer select-none
                      ${
                        isOff
                          ? "border-amber-500/60 bg-amber-500/20 text-amber-400 shadow-xs ring-1 ring-amber-500/30"
                          : "border-border bg-card text-foreground hover:bg-accent"
                      }
                    `}
                  >
                    {DAY_FULL[day]}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Selecting <strong className="text-foreground">Monday</strong> here closes dispatches on Monday and automatically pauses order intake on <strong className="text-foreground">Sunday</strong>.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 7-Day Live Operating Timeline ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>7-Day Weekly Flow Preview</span>
            <Badge variant="outline" className="text-xs font-medium">
              Live Customer Experience
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Review how customer ordering and kitchen dispatches will behave on every day of the week based on your current settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto pb-2">
            <div className="grid grid-cols-7 min-w-262.5 gap-3.5 pt-1">
              {ALL_DAYS.map((day) => {
                const isIntakeClosedToday = intakeClosedDays.includes(day);
                const isDispatchClosedToday = selectedDispatchOffDays.includes(day);
                const nextDay = NEXT_DAY[day];

                return (
                  <div
                    key={day}
                    className={`rounded-xl border p-4 flex flex-col justify-between text-xs transition-all min-h-47.5 ${
                      isIntakeClosedToday && isDispatchClosedToday
                        ? "border-destructive/40 bg-destructive/5"
                        : isIntakeClosedToday
                        ? "border-rose-500/30 bg-rose-500/5"
                        : isDispatchClosedToday
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-border/60 bg-muted/15"
                    }`}
                  >
                    <div className="space-y-2 pb-2">
                      <div className="flex items-center justify-between font-bold text-sm">
                        <span>{DAY_FULL[day]}</span>
                      </div>

                      {/* Order Intake Status */}
                      <div className="space-y-1 pt-1.5 border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider">
                          Order Intake
                        </span>
                        {isIntakeClosedToday ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-500">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>CLOSED</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>OPEN (2–4 PM)</span>
                          </div>
                        )}
                      </div>

                      {/* Dispatch Status */}
                      <div className="space-y-1 pt-1.5 border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider">
                          Dispatches
                        </span>
                        {isDispatchClosedToday ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                              <XCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>NO DISPATCH</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground block">Kitchen &amp; admins free</span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span>ACTIVE</span>
                            </div>
                            {day === "sunday" && (
                              <span className="text-[10px] text-emerald-400 font-medium block">
                                (Delivers Saturday orders)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pre-order Delivery Target */}
                    <div className="pt-2.5 border-t border-border/50 text-[10px] text-muted-foreground">
                      {!isIntakeClosedToday ? (
                        <span>Orders deliver on <strong className="text-foreground">{DAY_FULL[nextDay]}</strong></span>
                      ) : (
                        <span className="text-rose-400 font-medium">No orders accepted today</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border/60">
            <p className="text-xs text-muted-foreground">
              Remember to click <strong>Save Changes</strong> after adjusting the schedule.
            </p>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Schedule
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
