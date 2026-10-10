"use client";

import React, { useState, useEffect } from "react";
import { type DispatchSlot, type DispatchWindow } from "@/lib/api";
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
  CalendarRange,
  Check,
  Loader2,
  AlertCircle,
  Truck,
} from "lucide-react";
import { ALL_DAYS, DAY_LABELS, DAY_SHORT, validateDispatchSlots } from "./types";
import { SlotManager } from "./SlotManager";
import { toast } from "sonner";

interface BulkConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatingDays: string[];
  weeklyOff: string[];
  windows: DispatchWindow[];
  onSaveBulk: (days: string[], enabled: boolean, slots: DispatchSlot[]) => Promise<void>;
}

export function BulkConfigDialog({
  open,
  onOpenChange,
  operatingDays,
  weeklyOff,
  windows,
  onSaveBulk,
}: BulkConfigDialogProps) {
  const [bulkDays, setBulkDays] = useState<string[]>([]);
  const [bulkEnabled, setBulkEnabled] = useState(true);
  const [bulkSlots, setBulkSlots] = useState<DispatchSlot[]>([]);
  const [saving, setSaving] = useState(false);

  // Initialize days & template when dialog opens
  useEffect(() => {
    if (open) {
      setBulkDays(operatingDays.length > 0 ? [...operatingDays] : [...ALL_DAYS]);
      setBulkEnabled(true);
      setBulkSlots([]);
    }
  }, [open, operatingDays]);

  const validationError = bulkEnabled ? validateDispatchSlots(bulkSlots) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkDays.length === 0) {
      toast.error("Please select at least one day to apply the schedule to.");
      return;
    }
    if (bulkEnabled && validationError) return;

    setSaving(true);
    try {
      await onSaveBulk(bulkDays, bulkEnabled, bulkEnabled ? bulkSlots : []);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="p-5 pb-3 border-b border-border/80 bg-card">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-bold">
                Set Dispatch Windows for All Days
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Configure delivery slots and capacities once and bulk-apply them across selected days.
            </DialogDescription>
          </div>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Day Selection Presets & Pills */}
            <div className="space-y-2.5 p-3.5 rounded-xl border border-border bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <Label className="text-xs font-semibold">
                  Target Days ({bulkDays.length} of 7 selected)
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setBulkDays([...operatingDays])}
                    className="text-[11px] h-6 px-2"
                  >
                    Operating Days ({operatingDays.length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setBulkDays(["monday", "tuesday", "wednesday", "thursday", "friday"])
                    }
                    className="text-[11px] h-6 px-2"
                  >
                    Weekdays
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setBulkDays(["saturday", "sunday"])}
                    className="text-[11px] h-6 px-2"
                  >
                    Weekends
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setBulkDays([...ALL_DAYS])}
                    className="text-[11px] h-6 px-2"
                  >
                    All 7 Days
                  </Button>
                </div>
              </div>

              {/* Day selection grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 pt-1">
                {ALL_DAYS.map((d) => {
                  const isSelected = bulkDays.includes(d);
                  const isWeeklyOff = weeklyOff.includes(d);

                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setBulkDays((prev) =>
                          isSelected ? prev.filter((day) => day !== d) : [...prev, d],
                        );
                      }}
                      className={`p-2 rounded-lg border text-xs text-center transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                          : "border-border text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <div className="font-medium">{DAY_SHORT[d]}</div>
                      {isWeeklyOff && (
                        <div className="text-[10px] text-rose-400 font-semibold">Weekly Off</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Enable switch */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card">
              <div className="space-y-0.5">
                <Label htmlFor="bulk-enabled-switch" className="text-xs font-semibold cursor-pointer">
                  Enable Dispatches for Selected Days
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Enables customer delivery slot selection for all {bulkDays.length} chosen days.
                </p>
              </div>
              <Switch
                id="bulk-enabled-switch"
                checked={bulkEnabled}
                onCheckedChange={setBulkEnabled}
              />
            </div>

            {/* Slot Manager */}
            {bulkEnabled ? (
              <SlotManager
                slots={bulkSlots}
                onChange={setBulkSlots}
                dayLabel="Selected Days"
              />
            ) : (
              <div className="p-8 rounded-xl border border-dashed border-border/80 text-center space-y-2 bg-muted/10">
                <Truck className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <h4 className="text-sm font-semibold text-foreground">
                  Dispatches will be disabled for {bulkDays.length} selected days
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Customers will not be able to select delivery slots on these days.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-[11px] text-muted-foreground">
              {validationError ? (
                <span className="text-rose-400 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {validationError}
                </span>
              ) : (
                <span>Will overwrite slots on {bulkDays.length} day(s) immediately.</span>
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
                disabled={saving || bulkDays.length === 0 || (bulkEnabled && !!validationError)}
                className="text-xs gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Apply to {bulkDays.length} Day(s)
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
