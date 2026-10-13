"use client";

import React, { useState, useRef } from "react";
import { type DispatchSlot } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowRight,
  Minus,
  Check,
} from "lucide-react";
import { formatTime12 } from "@/lib/utils";
import { ScheduleTimeline } from "./ScheduleTimeline";
import {
  calculateDuration,
  checkSlotConflicts,
  generateTimeSlots,
  distributeCapacityEqually,
} from "./types";
import { toast } from "sonner";

interface SlotManagerProps {
  slots: DispatchSlot[];
  onChange: (slots: DispatchSlot[]) => void;
  dayLabel?: string;
  orderWindowCap?: number;
}

export function SlotManager({ slots, onChange, dayLabel, orderWindowCap }: SlotManagerProps) {
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [bulkCapacityInput, setBulkCapacityInput] = useState<number | "">("");

  // Custom partition inputs
  const [genStart, setGenStart] = useState("");
  const [genEnd, setGenEnd] = useState("");
  const [genInterval, setGenInterval] = useState<number>(60);
  const [capacityMode, setCapacityMode] = useState<"total" | "per_slot">("total");
  const [genTotalOrders, setGenTotalOrders] = useState<number | "">(
    orderWindowCap && orderWindowCap > 0 ? orderWindowCap : ""
  );
  const [genCapacity, setGenCapacity] = useState<number | "">("");

  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

  const conflicts = checkSlotConflicts(slots);
  const hasErrors = Object.keys(conflicts).length > 0;

  // Sync total orders if orderWindowCap becomes available
  React.useEffect(() => {
    if (orderWindowCap && orderWindowCap > 0 && !genTotalOrders) {
      setGenTotalOrders(orderWindowCap);
    }
  }, [orderWindowCap, genTotalOrders]);

  // ─── Actions ────────────────────────────────────────────────────────

  const handleAddSlot = () => {
    const newSlot: DispatchSlot = {
      id: `slot_${Date.now()}`,
      start: "",
      end: "",
      label: "",
      maxCapacity: 0,
      isActive: true,
    };

    onChange([...slots, newSlot]);
    setSelectedSlotIndex(slots.length);
  };

  const handleUpdateSlot = (index: number, updates: Partial<DispatchSlot>) => {
    const next = [...slots];
    const current = next[index]!;
    const updated = { ...current, ...updates };

    if (updates.start !== undefined || updates.end !== undefined) {
      const s = updates.start ?? current.start;
      const e = updates.end ?? current.end;
      if (s && e) {
        updated.label = `${formatTime12(s)} - ${formatTime12(e)}`;
      }
    }

    next[index] = updated;
    onChange(next);
  };

  const handleRemoveSlot = (index: number) => {
    onChange(slots.filter((_, i) => i !== index));
    if (selectedSlotIndex === index) {
      setSelectedSlotIndex(null);
    }
  };

  const handleApplyBulkCapacity = () => {
    if (!bulkCapacityInput || Number(bulkCapacityInput) < 1) {
      toast.error("Please enter a valid capacity (minimum 1 order).");
      return;
    }
    const cap = Number(bulkCapacityInput);
    const updated = slots.map((s) => ({
      ...s,
      maxCapacity: cap,
    }));
    onChange(updated);
    toast.success(`Updated capacity to ${cap} orders for all ${slots.length} slots`);
  };

  const handleApplyGenerated = () => {
    if (!genStart || !genEnd) {
      toast.error("Please specify both start and end times.");
      return;
    }
    if (genStart >= genEnd) {
      toast.error("Start time must be before end time.");
      return;
    }

    let generated: DispatchSlot[] = [];
    if (capacityMode === "total") {
      const total = Number(genTotalOrders) || 0;
      if (total < 1) {
        toast.error("Please specify total orders (minimum 1).");
        return;
      }
      generated = generateTimeSlots(genStart, genEnd, genInterval, { totalCapacity: total });
    } else {
      const cap = Number(genCapacity) || 0;
      if (cap < 1) {
        toast.error("Please specify capacity per slot (minimum 1).");
        return;
      }
      generated = generateTimeSlots(genStart, genEnd, genInterval, { capacityPerSlot: cap });
    }

    if (generated.length === 0) {
      toast.error("Could not generate slots with those bounds.");
      return;
    }
    onChange(generated);
    setShowGenerator(false);
    const sumCap = generated.reduce((acc, s) => acc + (s.maxCapacity || 0), 0);
    toast.success(`Generated ${generated.length} slots totaling ${sumCap} max orders!`);
  };

  const handleTimelineSlotClick = (index: number) => {
    setSelectedSlotIndex(index);
    const el = slotRefs.current[index];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const totalCapacity = slots.reduce((acc, s) => acc + (s.maxCapacity || 0), 0);
  const activeCount = slots.filter((s) => s.isActive !== false).length;

  // Dynamic preview for slot division
  const previewSlotCount = (() => {
    if (!genStart || !genEnd || genStart >= genEnd || genInterval <= 0) return 0;
    const [sh, sm] = genStart.split(":").map(Number);
    const [eh, em] = genEnd.split(":").map(Number);
    if (sh === undefined || sm === undefined || eh === undefined || em === undefined) return 0;
    const totalMinutes = eh * 60 + em - (sh * 60 + sm);
    return Math.floor(totalMinutes / genInterval);
  })();

  const previewDistribution = (() => {
    if (capacityMode !== "total" || previewSlotCount <= 0 || !genTotalOrders) return null;
    const total = Number(genTotalOrders);
    if (total <= 0) return null;
    const base = Math.floor(total / previewSlotCount);
    const rem = total % previewSlotCount;
    return {
      total,
      slots: previewSlotCount,
      base,
      rem,
      slotsWithExtra: rem,
      extraCap: base + 1,
      standardSlots: previewSlotCount - rem,
      standardCap: base,
    };
  })();

  return (
    <div className="space-y-4">
      {/* ─── Visual Timeline ────────────────────────────────────── */}
      <ScheduleTimeline
        slots={slots}
        conflicts={conflicts}
        selectedSlotIndex={selectedSlotIndex}
        onSlotClick={handleTimelineSlotClick}
      />

      {/* ─── Action & Tool Strip ────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl border border-border/70 bg-card/50">
        {/* Left: Quick Batch Capacity & Intake Cap Sync */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Set capacity for all slots:</span>
            <Input
              type="number"
              min={1}
              max={500}
              value={bulkCapacityInput}
              onChange={(e) =>
                setBulkCapacityInput(e.target.value ? parseInt(e.target.value, 10) : "")
              }
              placeholder="Qty"
              className="w-16 h-7 text-xs text-center font-bold px-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyBulkCapacity}
              disabled={slots.length === 0 || !bulkCapacityInput}
              className="h-7 text-xs px-2.5 gap-1 hover:bg-primary/10"
            >
              <Check className="h-3 w-3" />
              Apply
            </Button>
          </div>

          {/* Quick 1-Click Divide for Intake Cap */}
          {orderWindowCap !== undefined && orderWindowCap > 0 && slots.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const updated = distributeCapacityEqually(slots, orderWindowCap);
                onChange(updated);
                toast.success(
                  `Equally divided ${orderWindowCap} order cap across ${activeCount} active slots!`
                );
              }}
              className="h-7 text-xs px-2.5 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
            >
              <Sparkles className="h-3 w-3" />
              Divide Intake Cap ({orderWindowCap})
            </Button>
          )}
        </div>

        {/* Right: Custom Partition & Add Slot */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={showGenerator ? "default" : "outline"}
            size="sm"
            onClick={() => setShowGenerator(!showGenerator)}
            className="h-7 text-xs gap-1"
          >
            <Sparkles className="h-3 w-3" />
            Auto-Partition
            {showGenerator ? (
              <ChevronUp className="h-3 w-3 ml-0.5" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-0.5" />
            )}
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleAddSlot}
            className="h-7 text-xs gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Slot
          </Button>
        </div>
      </div>

      {/* ─── Auto-Divide Collapsible Drawer ─────────────────────── */}
      {showGenerator && (
        <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-3.5 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Auto-Partition Dispatch Hours
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Divide your dispatch hours into delivery intervals and distribute your target order cap.
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowGenerator(false)}
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Close
            </Button>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-1 p-0.5 bg-muted/60 rounded-lg w-fit text-xs border border-border/50">
            <button
              type="button"
              onClick={() => setCapacityMode("total")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                capacityMode === "total"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Divide Total Orders (e.g. {orderWindowCap || 150} cap)
            </button>
            <button
              type="button"
              onClick={() => setCapacityMode("per_slot")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                capacityMode === "per_slot"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Fixed Orders / Slot
            </button>
          </div>

          {/* Custom controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="space-y-1">
              <Label className="text-[11px]">Start Time</Label>
              <Input
                type="time"
                value={genStart}
                onChange={(e) => setGenStart(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">End Time</Label>
              <Input
                type="time"
                value={genEnd}
                onChange={(e) => setGenEnd(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Interval</Label>
              <select
                value={genInterval}
                onChange={(e) => setGenInterval(Number(e.target.value))}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
              >
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            {capacityMode === "total" ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Total Target Orders</Label>
                  {orderWindowCap !== undefined && orderWindowCap > 0 && (
                    <button
                      type="button"
                      onClick={() => setGenTotalOrders(orderWindowCap)}
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      Use Cap ({orderWindowCap})
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  min={1}
                  max={5000}
                  value={genTotalOrders}
                  onChange={(e) =>
                    setGenTotalOrders(e.target.value ? parseInt(e.target.value, 10) : "")
                  }
                  placeholder={orderWindowCap ? String(orderWindowCap) : "150"}
                  className="h-8 text-xs font-bold text-center"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-[11px]">Orders / Slot</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={genCapacity}
                  onChange={(e) =>
                    setGenCapacity(e.target.value ? parseInt(e.target.value, 10) : "")
                  }
                  placeholder="Qty"
                  className="h-8 text-xs font-bold text-center"
                />
              </div>
            )}
          </div>

          {/* Dynamic Preview */}
          {previewDistribution && (
            <div className="text-[11px] p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-foreground flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-primary">Division Preview: </span>
                {previewDistribution.rem === 0 ? (
                  <span>
                    {previewDistribution.slots} slots × {previewDistribution.standardCap} orders ={" "}
                    <strong>{previewDistribution.total} total orders</strong>
                  </span>
                ) : (
                  <span>
                    {previewDistribution.slotsWithExtra} slots × {previewDistribution.extraCap} orders +{" "}
                    {previewDistribution.standardSlots} slots × {previewDistribution.standardCap} orders ={" "}
                    <strong>{previewDistribution.total} total orders</strong>
                  </span>
                )}
              </div>
              {orderWindowCap !== undefined && Number(genTotalOrders) === orderWindowCap && (
                <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  ✓ Matches Intake Cap
                </span>
              )}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleApplyGenerated}
              className="text-xs h-7 gap-1.5"
            >
              <Sparkles className="h-3 w-3" />
              Generate Slots
            </Button>
          </div>
        </div>
      )}


      {/* ─── Validation Error Banner ────────────────────────────── */}
      {hasErrors && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>
            Please resolve the highlighted slot conflicts before saving. Ensure start times are before end times and slots do not overlap.
          </span>
        </div>
      )}

      {/* ─── Slots Table ────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[2rem_minmax(190px,1.2fr)_140px_85px_2.5rem] items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="text-center">#</span>
          <span>Delivery Time Window</span>
          <span className="text-center">Orders / Slot</span>
          <span className="text-center">Status</span>
          <span className="text-right sr-only">Actions</span>
        </div>

        {slots.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <Clock className="h-7 w-7 text-muted-foreground/40 mx-auto" />
            <p className="text-xs font-medium text-muted-foreground">No dispatch slots defined yet</p>
            <p className="text-[11px] text-muted-foreground/70">
              Click &quot;Add Slot&quot; or use &quot;Auto-Partition&quot; to define delivery windows.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSlot}
              className="text-xs gap-1 mt-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add First Slot
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {slots.map((s, idx) => {
              const conflict = conflicts[idx];
              const isSelected = selectedSlotIndex === idx;
              const duration = calculateDuration(s.start, s.end);

              return (
                <div
                  key={s.id || idx}
                  ref={(el) => {
                    slotRefs.current[idx] = el;
                  }}
                  className={`grid grid-cols-[2rem_minmax(190px,1.2fr)_140px_85px_2.5rem] items-center gap-2 px-3 py-2 transition-all ${
                    conflict
                      ? "bg-rose-500/10 border-l-4 border-l-rose-500"
                      : isSelected
                      ? "bg-primary/5 border-l-4 border-l-primary"
                      : "hover:bg-muted/30"
                  }`}
                >
                  {/* # Index */}
                  <span className="text-xs font-mono font-bold text-muted-foreground text-center">
                    {idx + 1}
                  </span>

                  {/* Clean Time Inputs + Duration pill */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="time"
                        value={s.start || ""}
                        onChange={(e) => handleUpdateSlot(idx, { start: e.target.value })}
                        className="w-24 h-7 text-xs px-1.5 font-mono"
                      />
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <Input
                        type="time"
                        value={s.end || ""}
                        onChange={(e) => handleUpdateSlot(idx, { end: e.target.value })}
                        className="w-24 h-7 text-xs px-1.5 font-mono"
                      />
                    </div>

                    {duration && (
                      <span className="text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 rounded bg-muted/60 shrink-0">
                        {duration}
                      </span>
                    )}

                    {conflict && (
                      <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 truncate">
                        <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                        {conflict}
                      </span>
                    )}
                  </div>

                  {/* Orders / Slot Capacity Control */}
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleUpdateSlot(idx, {
                          maxCapacity: Math.max(1, (s.maxCapacity || 1) - 5),
                        })
                      }
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={s.maxCapacity || ""}
                      onChange={(e) =>
                        handleUpdateSlot(idx, {
                          maxCapacity: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      placeholder="Cap"
                      className="w-14 h-7 text-xs text-center font-bold px-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleUpdateSlot(idx, {
                          maxCapacity: (s.maxCapacity || 0) + 5,
                        })
                      }
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Active / Paused Toggle */}
                  <div className="flex items-center justify-center gap-1.5">
                    <Switch
                      checked={s.isActive !== false}
                      onCheckedChange={(isActive) => handleUpdateSlot(idx, { isActive })}
                    />
                    <span
                      className={`text-[10px] font-medium hidden sm:inline ${
                        s.isActive !== false ? "text-emerald-400" : "text-muted-foreground"
                      }`}
                    >
                      {s.isActive !== false ? "Active" : "Off"}
                    </span>
                  </div>

                  {/* Delete Slot */}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSlot(idx)}
                      className="h-7 w-7 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                      title="Remove slot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table Footer Summary */}
        {slots.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>
                Total: <strong className="text-foreground">{slots.length} slots</strong> ({activeCount} active)
              </span>
              <span>•</span>
              <span>
                Daily Delivery Limit:{" "}
                <strong className="text-primary font-bold">{totalCapacity} orders</strong>
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
              className="h-6 text-[11px] text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
            >
              Clear All
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
