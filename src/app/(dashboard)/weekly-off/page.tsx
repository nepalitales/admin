"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { getWeeklyOff, updateWeeklyOff, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

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
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Weekly Off</h2>
        <p className="text-muted-foreground">Set recurring days when the shop is closed</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Select Off Days</CardTitle>
          <CardDescription>Click on a day to toggle it. Selected days appear as closed.</CardDescription>
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
                    inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-all
                    ${isSelected
                      ? "border-destructive/50 bg-destructive/10 text-destructive"
                      : "border-border bg-card text-foreground hover:bg-accent"
                    }
                  `}
                >
                  {DAY_FULL[day]}
                </button>
              );
            })}
          </div>

          <div className="text-sm text-muted-foreground">
            {selectedDays.length === 0
              ? "No weekly off — shop is open every day."
              : `Closed every: ${selectedDays.map((d) => DAY_FULL[d]).join(", ")}`}
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
