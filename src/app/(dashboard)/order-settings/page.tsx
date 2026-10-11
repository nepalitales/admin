"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getOrderSettings,
  updateOrderSettings,
  ApiError,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Bike, Store } from "lucide-react";

export default function OrderSettingsPage() {
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await getOrderSettings({ forceRefresh: true });
      setPickupEnabled(res.settings.pickupEnabled);
      setDeliveryEnabled(res.settings.deliveryEnabled);
      setDeliveryFee(String(res.settings.deliveryFee));
      setPickupInstructions(res.settings.pickupInstructions);
    } catch {
      toast.error("Failed to load order type settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!pickupEnabled && !deliveryEnabled) {
      toast.error("Enable at least pickup or delivery");
      return;
    }

    setSaving(true);
    try {
      await updateOrderSettings({
        pickupEnabled,
        deliveryEnabled,
        deliveryFee: Number(deliveryFee) || 0,
        pickupInstructions: pickupInstructions.trim(),
      });
      toast.success("Checkout order types updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full max-w-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Order types & Fulfillment</h2>
        <p className="text-muted-foreground">
          Control pickup vs delivery options for your customers.
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Fulfillment</CardTitle>
          <CardDescription>
            Pickup is collected from Kasarvadavali kitchen. Delivery covers Mumbai & Thane.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <Store className="text-muted-foreground" />
              <div>
                <Label htmlFor="pickup-enabled">Pickup</Label>
                <p className="text-xs text-muted-foreground">Customer collects from Kasarvadavali cloud kitchen</p>
              </div>
            </div>
            <Switch id="pickup-enabled" checked={pickupEnabled} onCheckedChange={setPickupEnabled} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <Bike className="text-muted-foreground" />
              <div>
                <Label htmlFor="delivery-enabled">Doorstep Delivery</Label>
                <p className="text-xs text-muted-foreground">
                  Dispatched to customer address across Mumbai & Thane
                </p>
              </div>
            </div>
            <Switch id="delivery-enabled" checked={deliveryEnabled} onCheckedChange={setDeliveryEnabled} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delivery-fee">Delivery fee (₹)</Label>
            <Input
              id="delivery-fee"
              type="number"
              min="0"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              disabled={!deliveryEnabled}
            />
            <p className="text-[11px] text-muted-foreground">
              Fixed delivery fee charged to the customer at checkout (set 0 for free delivery).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pickup-note">Pickup instructions</Label>
            <Textarea
              id="pickup-note"
              value={pickupInstructions}
              onChange={(e) => setPickupInstructions(e.target.value)}
              placeholder="Collect from Metropolis Riveria..."
              disabled={!pickupEnabled}
              rows={3}
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="self-start">
            {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
            Save settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
