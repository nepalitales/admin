"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getOrderLiveSummary } from "@/lib/api";
import { toast } from "sonner";

export interface OrderEventData {
  orderId: string;
  orderNumber: string;
  status: string;
  summary?: Record<string, unknown>;
  timestamp?: string;
}

export interface OrderLiveCounts {
  placed: number;
  preparing: number;
  ready: number;
  porterBooked: number;
  delivered: number;
  cancelled: number;
}

interface UseOrderEventsOptions {
  onOrderChange?: (event: { type: string; data: OrderEventData }) => void;
  enableToasts?: boolean;
}

const POLL_INTERVAL_MS = 15_000; // Poll every 15s

export function useOrderEvents(options: UseOrderEventsOptions = {}) {
  const { onOrderChange, enableToasts = true } = options;
  const [isConnected, setIsConnected] = useState(true);
  const [counts, setCounts] = useState<OrderLiveCounts | null>(null);
  const [lastEvent, setLastEvent] = useState<{ type: string; data: OrderEventData } | null>(null);

  const onOrderChangeRef = useRef(onOrderChange);
  useEffect(() => {
    onOrderChangeRef.current = onOrderChange;
  }, [onOrderChange]);

  const handleIncomingEvent = useCallback(
    (type: string, data: OrderEventData) => {
      setLastEvent({ type, data });

      if (enableToasts) {
        if (type === "order_created") {
          toast.success(`New Order #${data.orderNumber} placed!`, {
            description: `Status: ${data.status.toUpperCase()} • Click to view in orders dashboard.`,
            duration: 6000,
          });
        } else if (type === "order_cancelled") {
          toast.warning(`Order #${data.orderNumber} cancelled`, {
            description: `Status: ${data.status}`,
            duration: 5000,
          });
        } else if (type === "porter_status_updated") {
          toast.info(`Delivery update for #${data.orderNumber}: ${data.status}`);
        }
      }

      if (onOrderChangeRef.current) {
        onOrderChangeRef.current({ type, data });
      }
    },
    [enableToasts],
  );

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isUnmounted = false;
    let lastCheckedServerTime = 0;
    let inFlight = false;

    async function sync() {
      if (isUnmounted || inFlight) return;
      inFlight = true;

      try {
        const res = await getOrderLiveSummary(lastCheckedServerTime > 0 ? lastCheckedServerTime : undefined);
        if (isUnmounted) return;

        setIsConnected(true);

        if (res.counts) {
          setCounts(res.counts);
        }

        if (lastCheckedServerTime > 0 && Array.isArray(res.events) && res.events.length > 0) {
          for (const ev of res.events) {
            handleIncomingEvent(ev.type, {
              orderId: ev.orderId,
              orderNumber: ev.orderNumber,
              status: ev.status,
              summary: ev.summary,
              timestamp: ev.timestamp,
            });
          }
        }

        if (res.serverTime) {
          lastCheckedServerTime = res.serverTime;
        }
      } catch {
        // Network or server glitch: maintain last known state gracefully
        // Next tick will retry automatically
      } finally {
        inFlight = false;
      }
    }

    function startPolling() {
      if (intervalId || isUnmounted) return;
      intervalId = setInterval(sync, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function handleVisibility() {
      if (document.hidden) {
        stopPolling();
      } else {
        sync(); // Instant check when administrator returns to tab
        startPolling();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    // Initial sync immediately upon mount
    sync();
    startPolling();

    return () => {
      isUnmounted = true;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [handleIncomingEvent]);

  return { isConnected, counts, lastEvent };
}
