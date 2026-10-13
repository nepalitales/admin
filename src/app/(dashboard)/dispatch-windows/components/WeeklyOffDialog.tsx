"use client";

import React, { useState } from "react";
import { type DispatchWindow } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarOff, Check, Loader2, ArrowUpRight, Clock, Settings2 } from "lucide-react";
import Link from "next/link";
import { DAY_LABELS } from "./types";

interface WeeklyOffDialogProps {
  day: DispatchWindow | null;
  onClose: () => void;
  onReopen: (dayName: string) => Promise<void>;
  onEditTemplate: (day: DispatchWindow) => void;
}

export function WeeklyOffDialog({
  day,
  onClose,
  onReopen,
  onEditTemplate,
}: WeeklyOffDialogProps) {
  const [reopening, setReopening] = useState(false);

  if (!day) return null;
  const dayName = DAY_LABELS[day.day] || day.day;

  const handleReopen = async () => {
    setReopening(true);
    try {
      await onReopen(day.day);
      onClose();
    } finally {
      setReopening(false);
    }
  };

  return (
    <Dialog open={!!day} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-rose-400 mb-1">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <CalendarOff className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                {dayName} is Closed
              </DialogTitle>
              <DialogDescription className="text-xs">
                Recurring weekly closure active in Weekly Off settings.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Operating Status:</span>
              <Badge
                variant="outline"
                className="border-rose-500/40 text-rose-400 bg-rose-500/10 text-xs font-semibold"
              >
                Weekly Off Active
              </Badge>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              On Weekly Off days, the kitchen does not cook or deliver food (dispatch windows are not bookable). However, online ordering remains active on the storefront for advance pre-orders scheduled for the next open operating day.
            </p>
            {day.slots && day.slots.length > 0 && (
              <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Preserved standby template:</span>
                <span className="font-semibold text-foreground">
                  {day.slots.length} slots
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={handleReopen}
            disabled={reopening}
            className="w-full text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {reopening ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Reopen {dayName} (Remove from Weekly Off)
          </Button>

          <Link
            href="/weekly-off"
            onClick={onClose}
            className={buttonVariants({
              variant: "outline",
              className: "w-full text-xs gap-1.5",
            })}
          >
            Manage Weekly Off Schedule
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const current = day;
              onClose();
              if (current) onEditTemplate(current);
            }}
            className="w-full text-[11px] text-muted-foreground hover:text-foreground h-7 gap-1"
          >
            <Settings2 className="h-3 w-3" />
            Configure standby slot template in advance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
