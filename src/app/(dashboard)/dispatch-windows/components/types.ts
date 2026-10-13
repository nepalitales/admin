import { type DispatchSlot, type DispatchWindow } from "@/lib/api";
import { formatTime12 } from "@/lib/utils";

export const ALL_DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type DayOfWeek = (typeof ALL_DAYS)[number];

export const DAY_LABELS: Record<string, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

export const DAY_SHORT: Record<string, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

export function calculateDuration(start: string, end: string): string {
  if (!start || !end || start >= end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (sh === undefined || sm === undefined || eh === undefined || em === undefined) return "";
  const totalMinutes = eh * 60 + em - (sh * 60 + sm);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${mins}m`;
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Analyzes slots to calculate window span and capacity statistics */
export function calculateDayStats(slots?: DispatchSlot[] | null) {
  if (!slots || slots.length === 0) {
    return {
      slotCount: 0,
      activeSlotCount: 0,
      totalCapacity: 0,
      windowStart: null as string | null,
      windowEnd: null as string | null,
      spanFormatted: "No slots configured",
      durationFormatted: "",
    };
  }

  const activeSlots = slots.filter((s) => s.isActive !== false);
  const totalCapacity = slots.reduce((acc, s) => acc + (s.maxCapacity || 0), 0);

  const sorted = [...slots].filter((s) => s.start && s.end).sort((a, b) => a.start.localeCompare(b.start));
  if (sorted.length === 0) {
    return {
      slotCount: slots.length,
      activeSlotCount: activeSlots.length,
      totalCapacity,
      windowStart: null as string | null,
      windowEnd: null as string | null,
      spanFormatted: "No valid times",
      durationFormatted: "",
    };
  }

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const start12 = formatTime12(first.start);
  const end12 = formatTime12(last.end);
  const duration = calculateDuration(first.start, last.end);

  return {
    slotCount: slots.length,
    activeSlotCount: activeSlots.length,
    totalCapacity,
    windowStart: first.start,
    windowEnd: last.end,
    spanFormatted: `${start12} – ${end12}`,
    durationFormatted: duration,
  };
}

/** Check for conflicts and return specific index-level errors */
export function checkSlotConflicts(slots: DispatchSlot[]): Record<number, string> {
  const errors: Record<number, string> = {};
  if (!slots || slots.length === 0) return errors;

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]!;
    if (!s.start || !s.end) {
      errors[i] = "Incomplete times";
      continue;
    }
    if (s.start >= s.end) {
      errors[i] = `Start (${formatTime12(s.start)}) must be before end (${formatTime12(s.end)})`;
      continue;
    }
    if (!s.maxCapacity || s.maxCapacity < 1) {
      errors[i] = "Capacity must be at least 1";
      continue;
    }
  }

  // Check overlaps between slots
  for (let i = 0; i < slots.length; i++) {
    const a = slots[i]!;
    if (!a.start || !a.end || a.start >= a.end) continue;
    for (let j = i + 1; j < slots.length; j++) {
      const b = slots[j]!;
      if (!b.start || !b.end || b.start >= b.end) continue;

      const overlap = !(a.end <= b.start || b.end <= a.start);
      if (overlap) {
        errors[i] = errors[i] || `Overlaps with slot #${j + 1}`;
        errors[j] = errors[j] || `Overlaps with slot #${i + 1}`;
      }
    }
  }

  return errors;
}

/** Top-level validation error message string */
export function validateDispatchSlots(slots: DispatchSlot[]): string | null {
  if (slots.length === 0) return null;
  const conflicts = checkSlotConflicts(slots);
  const firstKey = Object.keys(conflicts)[0];
  if (firstKey !== undefined) {
    const idx = Number(firstKey);
    return `Slot #${idx + 1}: ${conflicts[idx]}`;
  }
  return null;
}

/**
 * Evenly distributes a target total capacity across all active slots.
 * Handles remainders gracefully by distributing extra +1s to early slots,
 * guaranteeing the sum of slot capacities equals totalCapacity exactly.
 *
 * Example: 150 orders / 7 slots => 22, 22, 22, 21, 21, 21, 21 (sum = 150)
 */
export function distributeCapacityEqually(
  slots: DispatchSlot[],
  totalCapacity: number,
): DispatchSlot[] {
  const activeSlots = slots.filter((s) => s.isActive !== false);
  if (activeSlots.length === 0 || totalCapacity <= 0) return slots;

  const base = Math.floor(totalCapacity / activeSlots.length);
  const remainder = totalCapacity % activeSlots.length;

  let activeIndex = 0;
  return slots.map((s) => {
    if (s.isActive === false) return s;
    const slotCap = base + (activeIndex < remainder ? 1 : 0);
    activeIndex++;
    return {
      ...s,
      maxCapacity: slotCap,
    };
  });
}

/** Auto-partition generator */
export function generateTimeSlots(
  startStr: string,
  endStr: string,
  intervalMinutes: number,
  capacityConfig: number | { totalCapacity: number } | { capacityPerSlot: number },
): DispatchSlot[] {
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);

  if (sh === undefined || sm === undefined || eh === undefined || em === undefined) return [];
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;

  if (startTotal >= endTotal || intervalMinutes <= 0) return [];

  const slots: DispatchSlot[] = [];
  let current = startTotal;

  while (current + intervalMinutes <= endTotal) {
    const slotStartMin = current;
    const slotEndMin = current + intervalMinutes;

    const sH = Math.floor(slotStartMin / 60);
    const sM = slotStartMin % 60;
    const eH = Math.floor(slotEndMin / 60);
    const eM = slotEndMin % 60;

    const startFormatted = `${String(sH).padStart(2, "0")}:${String(sM).padStart(2, "0")}`;
    const endFormatted = `${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}`;

    const label = `${formatTime12(startFormatted)} - ${formatTime12(endFormatted)}`;
    const id = `slot_${startFormatted.replace(":", "")}_${endFormatted.replace(":", "")}`;

    slots.push({
      id,
      start: startFormatted,
      end: endFormatted,
      label,
      maxCapacity: typeof capacityConfig === "number" ? capacityConfig : 0,
      isActive: true,
    });

    current += intervalMinutes;
  }

  // Handle total capacity distribution across generated slots
  if (typeof capacityConfig === "object") {
    if ("totalCapacity" in capacityConfig && capacityConfig.totalCapacity > 0) {
      return distributeCapacityEqually(slots, capacityConfig.totalCapacity);
    }
    if ("capacityPerSlot" in capacityConfig && capacityConfig.capacityPerSlot > 0) {
      return slots.map((s) => ({ ...s, maxCapacity: capacityConfig.capacityPerSlot }));
    }
  }

  return slots;
}

