"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { getWeeklyOff, updateWeeklyOff, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Info } from "lucide-react";

const ALL_DAYS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

const DAY_LABELS: Record<string, string> = {
  sunday: "Sun", monday: "Mon", tuesday: "Tue", wednesday: "Wed",
  thursday: "Thu", friday: "Fri", saturday: "Sat",
};

const DAY_FULL: Record<string, string> = {
  sunday: "Sunday", monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday",
};

export default function WeeklyOffPage() {
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await getWeeklyOff();
      setSelectedDays(res.weeklyOff);
    } catch {
      toast.error("Failed to load weekly off schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateWeeklyOff(selectedDays);
      toast.success("Weekly off schedule updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full max-w-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Kitchen Weekly Off</h2>
        <p className="text-muted-foreground text-sm">
          Set recurring days when the kitchen does not cook or deliver food. Online advance pre-orders for the next operating day remain accepted.
        </p>
      </div>

      {/* ── Operational Architecture Info Card ── */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs space-y-2.5 text-amber-900 dark:text-amber-200">
        <div className="font-semibold text-sm flex items-center gap-2">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>How Kitchen Weekly Off Works</span>
        </div>
        <ul className="space-y-1.5 list-disc list-inside text-muted-foreground dark:text-neutral-300">
          <li>
            <strong className="text-foreground">Kitchen Cooking &amp; Dispatch Paused:</strong> On selected weekly off days, the kitchen is closed—no food is cooked, packed, or delivered.
          </li>
          <li>
            <strong className="text-foreground">Online Pre-Orders Still Accepted:</strong> Customers can still place orders on off days through the storefront. Orders are automatically scheduled for preparation and delivery on the <span className="underline font-medium text-foreground">next open operating day</span>.
          </li>
          <li>
            <strong className="text-foreground">Automatic Date Skipping:</strong> The storefront calendar and checkout automatically skip weekly off days so no delivery window can be booked on a closed day.
          </li>
        </ul>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Off Days</CardTitle>
          <CardDescription>
            Click on a day to toggle it. Kitchen cooking and delivery dispatches will be paused on these days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {ALL_DAYS.map((day) => {
              const isSelected = selectedDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`
                    inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-all cursor-pointer
                    ${isSelected
                      ? "border-destructive/60 bg-destructive/15 text-destructive font-semibold shadow-xs"
                      : "border-border bg-card text-foreground hover:bg-accent"
                    }
                  `}
                >
                  {DAY_FULL[day]}
                  {isSelected && <span className="ml-1.5 text-xs text-destructive">✕</span>}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/40 border border-border/50 space-y-1">
            <div className="font-medium text-foreground">Current Operating Schedule:</div>
            {selectedDays.length === 0 ? (
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ No weekly off configured — kitchen cooks and delivers all 7 days.
              </p>
            ) : (
              <p>
                Kitchen cooking &amp; dispatch closed every:{" "}
                <strong className="text-foreground">
                  {selectedDays.map((d) => DAY_FULL[d]).join(", ")}
                </strong>
                . Advance pre-orders placed on these days are fulfilled on the next open day.
              </p>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
