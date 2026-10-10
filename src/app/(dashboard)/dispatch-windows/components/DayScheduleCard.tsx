"use client";

import React from "react";
import { type DispatchWindow } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  CalendarOff,
  Truck,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { DAY_LABELS, DAY_SHORT, calculateDayStats } from "./types";
import { formatTime12 } from "@/lib/utils";

interface DayScheduleCardProps {
  day: DispatchWindow;
  isWeeklyOff: boolean;
  viewMode: "summary" | "expanded";
  onClick: () => void;
}

export function DayScheduleCard({
  day,
  isWeeklyOff,
  viewMode,
  onClick,
}: DayScheduleCardProps) {
  const dayName = DAY_LABELS[day.day] || day.day;
  const dayShort = DAY_SHORT[day.day] || day.day.slice(0, 3).toUpperCase();
  const stats = calculateDayStats(day.slots);
  const hasSlots = day.enabled && day.slots && day.slots.length > 0;

  // Format short 12-hr tag without duplicate zeros (e.g., "2-3 PM")
  const formatShortTag = (start: string, end: string) => {
    const s = formatTime12(start).replace(/:00/, "").replace(/ (AM|PM)/, "");
    const e = formatTime12(end).replace(/:00/, "");
    return `${s}–${e}`;
  };

  return (
    <Card
      onClick={onClick}
      className={`group relative flex flex-col justify-between transition-all duration-200 border cursor-pointer select-none overflow-hidden ${
        isWeeklyOff
          ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50 hover:bg-destructive/10"
          : !day.enabled
          ? "border-border/60 bg-muted/20 opacity-80 hover:opacity-100 hover:border-border"
          : "border-border/80 bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
      }`}
    >
      <CardHeader className="p-4 pb-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
                {dayShort}
              </span>
              <CardTitle className="text-base font-bold text-foreground">
                {dayName}
              </CardTitle>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isWeeklyOff
                ? "Weekly closure active"
                : day.enabled
                ? `${stats.slotCount} delivery slots · ${stats.totalCapacity} max orders`
                : "Delivery closed"}
            </p>
          </div>

          {/* Status Badge */}
          {isWeeklyOff ? (
            <Badge
              variant="outline"
              className="text-[11px] font-semibold border-rose-500/30 text-rose-400 bg-rose-500/10 px-2 py-0.5"
            >
              Weekly Off
            </Badge>
          ) : day.enabled ? (
            <Badge
              variant="outline"
              className="text-[11px] font-semibold border-emerald-500/30 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 flex items-center gap-1"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Open
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[11px] font-semibold border-muted text-muted-foreground bg-muted/30 px-2 py-0.5"
            >
              Closed
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-3 flex-1 flex flex-col justify-between">
        {/* Weekly Off State */}
        {isWeeklyOff ? (
          <div className="space-y-2 py-2 my-auto">
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 text-xs">
              <CalendarOff className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground text-xs">Closed Every {dayName}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Recurring weekly closure. Customer checkout is disabled for this day.
                </p>
              </div>
            </div>
            {day.slots && day.slots.length > 0 && (
              <p className="text-[11px] text-muted-foreground/80 text-center">
                {day.slots.length} standby slots preserved
              </p>
            )}
          </div>
        ) : !day.enabled ? (
          /* Disabled State */
          <div className="py-6 text-center space-y-2 my-auto bg-muted/15 rounded-lg border border-dashed border-border/60">
            <Truck className="h-6 w-6 text-muted-foreground/40 mx-auto" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-muted-foreground">Dispatches Turned Off</p>
              <p className="text-[11px] text-muted-foreground/70">
                Delivery slots are disabled for customers on {dayName}.
              </p>
            </div>
          </div>
        ) : hasSlots ? (
          /* Active Schedule State */
          <div className="space-y-2.5">
            {/* Window banner & metrics */}
            <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{stats.spanFormatted}</span>
                </span>
                {stats.durationFormatted && (
                  <span className="text-[10px] text-muted-foreground font-normal px-1.5 py-0.5 rounded bg-muted/60">
                    {stats.durationFormatted}
                  </span>
                )}
              </div>
            </div>

            {/* Slots Preview */}
            {viewMode === "summary" ? (
              /* Compact clean chip preview (no repetitive (30) clutter) */
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {day.slots.slice(0, 4).map((s, idx) => (
                  <span
                    key={s.id || idx}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted/40 border border-border/60 text-foreground/85"
                  >
                    {formatShortTag(s.start, s.end)}
                  </span>
                ))}
                {day.slots.length > 4 && (
                  <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-md bg-muted/30 border border-dashed border-border/60">
                    +{day.slots.length - 4} more slots
                  </span>
                )}
              </div>
            ) : (
              /* Expanded detailed view */
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {day.slots.map((s, idx) => (
                  <div
                    key={s.id || idx}
                    className={`flex items-center justify-between text-xs py-1 px-2 rounded border ${
                      s.isActive !== false
                        ? "bg-muted/30 border-border/50 text-foreground"
                        : "bg-muted/10 border-dashed border-border/30 text-muted-foreground opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span>{s.label}</span>
                    </div>
                    <span className="text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                      Max {s.maxCapacity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Enabled but no slots */
          <div className="py-6 text-center space-y-1.5 my-auto bg-muted/15 rounded-lg border border-dashed border-border/60">
            <Clock className="h-6 w-6 text-muted-foreground/40 mx-auto" />
            <p className="text-xs font-semibold text-muted-foreground">No Slots Configured</p>
            <p className="text-[11px] text-muted-foreground/70">
              Dispatches enabled, but no delivery windows set.
            </p>
          </div>
        )}

        {/* Card Footer Action */}
        <div className="pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground mt-2">
          {isWeeklyOff ? (
            <>
              <span className="text-rose-400 font-medium">Weekly closure</span>
              <span className="text-primary font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                Manage Closure <ArrowUpRight className="h-3 w-3" />
              </span>
            </>
          ) : day.enabled ? (
            <>
              <span>Click to edit</span>
              <span className="text-primary font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                Configure Slots <ChevronRight className="h-3 w-3" />
              </span>
            </>
          ) : (
            <>
              <span>Inactive</span>
              <span className="text-primary font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                Enable Dispatches <ChevronRight className="h-3 w-3" />
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
