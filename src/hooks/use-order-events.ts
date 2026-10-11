"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getOrderEventsUrl } from "@/lib/api";
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

export function useOrderEvents(options: UseOrderEventsOptions = {}) {
  const { onOrderChange, enableToasts = true } = options;
  const [isConnected, setIsConnected] = useState(false);
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
    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    function connect() {
      if (isUnmounted) return;

      try {
        const url = getOrderEventsUrl();
        es = new EventSource(url, { withCredentials: true });

        es.onopen = () => {
          setIsConnected(true);
        };

        es.addEventListener("connected", (e) => {
          setIsConnected(true);
          try {
            const parsed = JSON.parse(e.data);
            if (parsed.counts) {
              setCounts(parsed.counts);
            }
          } catch {
            // ignore
          }
        });

        es.addEventListener("order_created", (e) => {
          try {
            const data = JSON.parse(e.data);
            handleIncomingEvent("order_created", data);
          } catch (err) {
            console.error("Error parsing order_created event:", err);
          }
        });

        es.addEventListener("order_status_updated", (e) => {
          try {
            const data = JSON.parse(e.data);
            handleIncomingEvent("order_status_updated", data);
          } catch (err) {
            console.error("Error parsing order_status_updated event:", err);
          }
        });

        es.addEventListener("order_cancelled", (e) => {
          try {
            const data = JSON.parse(e.data);
            handleIncomingEvent("order_cancelled", data);
          } catch (err) {
            console.error("Error parsing order_cancelled event:", err);
          }
        });

        es.addEventListener("porter_status_updated", (e) => {
          try {
            const data = JSON.parse(e.data);
            handleIncomingEvent("porter_status_updated", data);
          } catch (err) {
            console.error("Error parsing porter_status_updated event:", err);
          }
        });

        es.addEventListener("reconnect", () => {
          // Graceful worker stream rollover
          if (es) {
            es.close();
            es = null;
          }
          if (!isUnmounted) {
            reconnectTimeout = setTimeout(connect, 1000);
          }
        });

        es.onerror = () => {
          setIsConnected(false);
          if (es) {
            es.close();
            es = null;
          }
          if (!isUnmounted) {
            reconnectTimeout = setTimeout(connect, 4000);
          }
        };
      } catch (err) {
        console.error("Failed to initialize EventSource:", err);
        setIsConnected(false);
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (es) {
        es.close();
      }
      setIsConnected(false);
    };
  }, [handleIncomingEvent]);

  return { isConnected, counts, lastEvent };
}
