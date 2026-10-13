"use client";

import React, { useState, useEffect } from "react";
import { type DispatchWindow, type DispatchSlot } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  Check,
  Loader2,
  CalendarOff,
  ArrowUpRight,
  Sparkles,
  AlertCircle,
  Clock,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { ALL_DAYS, DAY_LABELS, DAY_SHORT, calculateDayStats, validateDispatchSlots, distributeCapacityEqually } from "./types";
import { SlotManager } from "./SlotManager";

interface SlotConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: DispatchWindow | null;
  allWindows: DispatchWindow[];
  weeklyOff: string[];
  operatingDays: string[];
  orderWindowCap?: number;
  onSave: (
    dayName: string,
    enabled: boolean,
    slots: DispatchSlot[],
    applyToAll: boolean,
  ) => Promise<void>;
  onReopenWeeklyOff: (dayName: string) => Promise<void>;
  onSelectDay: (day: DispatchWindow) => void;
}

export function SlotConfigDialog({
  open,
  onOpenChange,
  day,
  allWindows,
  weeklyOff,
  operatingDays,
  orderWindowCap,
  onSave,
  onReopenWeeklyOff,
  onSelectDay,
}: SlotConfigDialogProps) {
  const [enabled, setEnabled] = useState(false);
  const [slots, setSlots] = useState<DispatchSlot[]>([]);
  const [applyToAllDays, setApplyToAllDays] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reopening, setReopening] = useState(false);

  // Sync state when day changes
  useEffect(() => {
    if (day) {
      setEnabled(day.enabled);
      setSlots(
        day.slots && day.slots.length > 0
          ? day.slots.map((s) => ({ ...s }))
          : [],
      );
      setApplyToAllDays(false);
    }
  }, [day]);

  if (!day) return null;

  const dayName = DAY_LABELS[day.day] || day.day;
  const isWeeklyOff = weeklyOff.includes(day.day);
  const stats = calculateDayStats(slots);
  const validationError = enabled ? validateDispatchSlots(slots) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enabled && validationError) return;

    setSaving(true);
    try {
      await onSave(day.day, enabled, enabled ? slots : [], applyToAllDays);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    setReopening(true);
    try {
      await onReopenWeeklyOff(day.day);
      setEnabled(true);
    } finally {
      setReopening(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 pb-3 border-b border-border/80 bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <DialogTitle className="text-lg font-bold">
                  {dayName} Dispatch Schedule
                </DialogTitle>
                {isWeeklyOff ? (
                  <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-500/10 text-xs">
                    Weekly Off
                  </Badge>
                ) : enabled ? (
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-xs">
                    Open
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-muted text-muted-foreground text-xs">
                    Disabled
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs">
                Configure delivery time slots and kitchen capacity limits for customers.
              </DialogDescription>
            </div>

            {/* Quick summary metrics */}
            {enabled && (
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto text-xs bg-muted/40 px-3 py-1.5 rounded-lg border border-border/60">
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{stats.activeSlotCount}</strong> slots
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  <strong className="text-primary">{stats.totalCapacity}</strong> max orders
                </span>
                {orderWindowCap !== undefined && orderWindowCap > 0 && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    {stats.totalCapacity === orderWindowCap ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Matches Order Cap ({orderWindowCap})
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-400 font-medium">
                          Intake Cap: {orderWindowCap} (
                          {orderWindowCap - stats.totalCapacity > 0
                            ? `${orderWindowCap - stats.totalCapacity} unallocated`
                            : `${stats.totalCapacity - orderWindowCap} over`}
                          )
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setSlots(distributeCapacityEqually(slots, orderWindowCap))}
                          className="h-5 px-1.5 text-[10px] text-primary hover:bg-primary/10"
                        >
                          Sync to {orderWindowCap}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ─── Day Switcher Ribbon ─────────────────────────────────── */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            {ALL_DAYS.map((d) => {
              const win = allWindows.find((w) => w.day === d);
              const isSelected = day.day === d;
              const isOff = weeklyOff.includes(d);
              const isOpen = win?.enabled && !isOff;

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    if (win) onSelectDay(win);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40"
                  }`}
                >
                  <span>{DAY_SHORT[d]}</span>
                  {isOff ? (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isSelected ? "bg-rose-200" : "bg-rose-500"
                      }`}
                    />
                  ) : isOpen ? (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isSelected ? "bg-emerald-200" : "bg-emerald-500"
                      }`}
                    />
                  ) : (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isSelected ? "bg-muted" : "bg-muted-foreground/40"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Weekly Off Banner */}
            {isWeeklyOff && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                <div className="flex items-start gap-2.5">
                  <CalendarOff className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground text-xs">
                      Weekly Off is currently active for {dayName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Recurring weekly closure is enabled. Slots configured below are stored as a standby template and take effect once this day is reopened.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleReopen}
                    disabled={reopening}
                    className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    {reopening ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Check className="h-3.5 w-3.5 mr-1" />
                    )}
                    Reopen {dayName} Now
                  </Button>
                  <Link
                    href="/weekly-off"
                    onClick={() => onOpenChange(false)}
                    className="text-xs text-primary hover:underline flex items-center gap-0.5"
                  >
                    Manage Weekly Off <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}

            {/* Master Day Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card">
              <div className="space-y-0.5">
                <Label htmlFor="day-enabled-switch" className="text-xs font-semibold cursor-pointer">
                  Enable Dispatches for {dayName}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Allow customers to select delivery time slots on {dayName}.
                </p>
              </div>
              <Switch
                id="day-enabled-switch"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            {/* Disabled Banner */}
            {!enabled ? (
              <div className="p-8 rounded-xl border border-dashed border-border/80 text-center space-y-3 bg-muted/10">
                <Truck className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    Dispatches are currently turned off for {dayName}
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Customers will not see delivery slots for this day during checkout. Turn on the switch above to configure time slots.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEnabled(true)}
                  className="text-xs gap-1.5"
                >
                  <Truck className="h-3.5 w-3.5" /> Turn On Dispatches
                </Button>
              </div>
            ) : (
              /* The New Sleek Slot Manager */
              <SlotManager
                slots={slots}
                onChange={setSlots}
                dayLabel={dayName}
                orderWindowCap={orderWindowCap}
              />
            )}

            {/* Apply to All Operating Days Checkbox */}
            {enabled && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-primary/20 bg-primary/5">
                <input
                  id="apply-to-all-checkbox"
                  type="checkbox"
                  checked={applyToAllDays}
                  onChange={(e) => setApplyToAllDays(e.target.checked)}
                  className="h-4 w-4 rounded border-primary text-primary focus:ring-primary cursor-pointer"
                />
                <Label htmlFor="apply-to-all-checkbox" className="text-xs font-medium cursor-pointer">
                  Apply this exact schedule to all{" "}
                  <strong className="text-primary">{operatingDays.length} operating days</strong>
                </Label>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-[11px] text-muted-foreground">
              {validationError ? (
                <span className="text-rose-400 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {validationError}
                </span>
              ) : (
                <span>All changes apply immediately to customer delivery windows upon saving.</span>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving || (enabled && !!validationError)}
                className="text-xs gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Save Schedule
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
