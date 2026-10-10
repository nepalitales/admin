"use client";

import React from "react";
import { type DispatchCapacityResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, RefreshCw, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { DAY_LABELS } from "./types";

interface LiveCapacityTabProps {
  data: DispatchCapacityResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

export function LiveCapacityTab({ data, loading, onRefresh }: LiveCapacityTabProps) {
  const dayDisplay = data?.dayName ? DAY_LABELS[data.dayName] || data.dayName : "";

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              Live Slot Capacity for {data?.date || "Tomorrow"} {dayDisplay ? `(${dayDisplay})` : ""}
            </CardTitle>
            <CardDescription className="text-xs">
              Real-time view of confirmed customer orders and in-checkout holds per delivery slot.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={loading}
            className="text-xs gap-1.5 h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Fetching live slot occupancy...</p>
            </div>
          ) : !data?.slots || data.slots.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm space-y-2">
              <Truck className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="font-medium text-xs">No dispatch slots configured or kitchen is closed for this day.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {data.slots.map((slot) => {
                const isFull = slot.availableCapacity <= 0;
                const isFillingFast = slot.percentageBooked >= 70 && !isFull;

                return (
                  <div
                    key={slot.slotId}
                    className={`rounded-xl border p-4 transition-all ${
                      isFull
                        ? "border-rose-500/40 bg-rose-500/5 shadow-xs"
                        : isFillingFast
                        ? "border-amber-500/40 bg-amber-500/5 shadow-xs"
                        : "border-border/70 bg-card/60 hover:bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-foreground">{slot.label}</span>
                      {isFull ? (
                        <Badge variant="destructive" className="text-[10px] uppercase font-bold py-0.5">
                          Sold Out
                        </Badge>
                      ) : isFillingFast ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-500 text-amber-500 py-0.5 font-bold bg-amber-500/10"
                        >
                          Filling Fast
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-emerald-500 text-emerald-400 py-0.5 font-bold bg-emerald-500/10"
                        >
                          Available
                        </Badge>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5 my-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          Booked: <strong>{slot.totalBooked}</strong> / {slot.maxCapacity}
                        </span>
                        <span className="font-bold text-foreground">{slot.percentageBooked}%</span>
                      </div>
                      <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isFull
                              ? "bg-rose-500"
                              : isFillingFast
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, slot.percentageBooked)}%` }}
                        />
                      </div>
                    </div>

                    {/* Breakdown pills */}
                    <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-border/50 text-center">
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Confirmed</p>
                        <p className="text-sm font-bold text-foreground">{slot.confirmedCount}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">In Checkout</p>
                        <p className="text-sm font-bold text-amber-400">{slot.heldCount}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Remaining</p>
                        <p className="text-sm font-bold text-emerald-400">{slot.availableCapacity}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
