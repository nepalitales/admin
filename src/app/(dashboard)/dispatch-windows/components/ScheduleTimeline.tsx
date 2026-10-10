"use client";

import React, { useMemo } from "react";
import { type DispatchSlot } from "@/lib/api";
import { timeToMinutes } from "./types";
import { formatTime12 } from "@/lib/utils";

interface ScheduleTimelineProps {
  slots: DispatchSlot[];
  mini?: boolean;
  onSlotClick?: (index: number) => void;
  selectedSlotIndex?: number | null;
  className?: string;
  conflicts?: Record<number, string>;
}

export function ScheduleTimeline({
  slots,
  mini = false,
  onSlotClick,
  selectedSlotIndex,
  className = "",
  conflicts = {},
}: ScheduleTimelineProps) {
  // Dynamically compute bounds around the actual active slots with a clean 1-hour padding
  const { startMin, endMin, totalSpan, hasValidSlots } = useMemo(() => {
    let minStart = 1440;
    let maxEnd = 0;
    let foundValid = false;

    for (const slot of slots) {
      if (slot.start && slot.end && slot.start < slot.end) {
        foundValid = true;
        const s = timeToMinutes(slot.start);
        const e = timeToMinutes(slot.end);
        if (s < minStart) minStart = s;
        if (e > maxEnd) maxEnd = e;
      }
    }

    if (!foundValid || minStart >= maxEnd) {
      return { startMin: 0, endMin: 1440, totalSpan: 1440, hasValidSlots: false };
    }

    // 1 hour buffer on each side (aligned to full hours)
    const sMin = Math.max(0, Math.floor(minStart / 60 - 1) * 60);
    const eMin = Math.min(1440, Math.ceil(maxEnd / 60 + 1) * 60);

    return {
      startMin: sMin,
      endMin: eMin,
      totalSpan: Math.max(60, eMin - sMin),
      hasValidSlots: true,
    };
  }, [slots]);

  // Generate hour tick marks cleanly every 2 hours
  const ticks = useMemo(() => {
    if (!hasValidSlots) return [];
    const list: { label: string; pct: number }[] = [];
    const step = mini ? 180 : 120; // 2 hours in full view
    for (let m = startMin; m <= endMin; m += step) {
      const pct = ((m - startMin) / totalSpan) * 100;
      const h = Math.floor(m / 60);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      list.push({ label: `${h12} ${ampm}`, pct });
    }
    return list;
  }, [startMin, endMin, totalSpan, mini, hasValidSlots]);

  if (!hasValidSlots) {
    return (
      <div className={`w-full py-2 text-center text-xs text-muted-foreground/60 ${className}`}>
        No active slots configured
      </div>
    );
  }

  if (mini) {
    return (
      <div className={`w-full space-y-1 ${className}`}>
        <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden relative border border-border/40">
          {slots.map((s, idx) => {
            const start = timeToMinutes(s.start);
            const end = timeToMinutes(s.end);
            if (end <= start) return null;

            const leftPct = Math.max(0, Math.min(100, ((start - startMin) / totalSpan) * 100));
            const widthPct = Math.max(1, Math.min(100 - leftPct, ((end - start) / totalSpan) * 100));
            const isPaused = s.isActive === false;

            return (
              <div
                key={s.id || idx}
                title={`${formatTime12(s.start)} - ${formatTime12(s.end)} (${s.maxCapacity} orders)`}
                className={`absolute top-0 bottom-0 transition-all ${
                  isPaused
                    ? "bg-muted-foreground/30 border-r border-border/50"
                    : "bg-primary/80 hover:bg-primary border-r border-background/40"
                }`}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Delivery Schedule Coverage
        </span>
        <span className="text-[11px] text-muted-foreground">
          {slots.filter((s) => s.isActive !== false).length} active slots · 1 hr intervals
        </span>
      </div>

      {/* Main interactive track */}
      <div className="relative h-12 w-full bg-card/70 rounded-lg border border-border overflow-hidden">
        {/* Hour guide lines */}
        {ticks.map((t, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-l border-dashed border-border/40 pointer-events-none"
            style={{ left: `${t.pct}%` }}
          />
        ))}

        {/* Slot pills */}
        {slots.map((s, idx) => {
          const start = timeToMinutes(s.start);
          const end = timeToMinutes(s.end);
          if (end <= start) return null;

          const leftPct = Math.max(0, Math.min(100, ((start - startMin) / totalSpan) * 100));
          const widthPct = Math.max(2, Math.min(100 - leftPct, ((end - start) / totalSpan) * 100));
          const isPaused = s.isActive === false;
          const isSelected = selectedSlotIndex === idx;
          const hasConflict = !!conflicts[idx];

          const startShort = formatTime12(s.start).replace(/:00/, "").replace(/ /, "");
          const endShort = formatTime12(s.end).replace(/:00/, "").replace(/ /, "");

          return (
            <button
              type="button"
              key={s.id || idx}
              onClick={() => onSlotClick?.(idx)}
              title={`${formatTime12(s.start)} – ${formatTime12(s.end)} | Max: ${s.maxCapacity} orders${
                isPaused ? ' (Paused)' : ''
              }${hasConflict ? ' - [Warning] ' + conflicts[idx] : ''}`}
              className={`absolute top-1 bottom-1 rounded-md px-1 text-[11px] font-medium flex flex-col justify-center items-center overflow-hidden transition-all group ${
                hasConflict
                  ? "bg-rose-500/30 border-2 border-rose-500 text-rose-300 ring-2 ring-rose-500/30 z-10"
                  : isSelected
                  ? "bg-primary text-primary-foreground border border-primary ring-2 ring-primary/40 shadow-sm z-10"
                  : isPaused
                  ? "bg-muted/60 text-muted-foreground border border-dashed border-border opacity-70 hover:opacity-100"
                  : "bg-primary/15 hover:bg-primary/25 text-foreground border border-primary/40"
              }`}
              style={{
                left: `calc(${leftPct}% + 1px)`,
                width: `calc(${widthPct}% - 2px)`,
              }}
            >
              <span className="truncate max-w-full font-semibold text-[11px]">
                {startShort}–{endShort}
              </span>
              <span className="text-[10px] opacity-75 truncate max-w-full">
                {s.maxCapacity} cap
              </span>
            </button>
          );
        })}
      </div>

      {/* Ticks Labels */}
      <div className="relative h-4 w-full">
        {ticks.map((t, i) => (
          <span
            key={i}
            className="absolute text-[10px] text-muted-foreground font-mono -translate-x-1/2 select-none"
            style={{ left: `${t.pct}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
