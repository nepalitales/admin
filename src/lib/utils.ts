export { cn } from "cn";

/**
 * Formats a 24-hour time string ("HH:mm") into a 12-hour formatted string ("hh:mm A").
 * Example: "14:00" -> "02:00 PM", "06:30" -> "06:30 AM"
 */
export function formatTime12(time: string): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  if (isNaN(h) || isNaN(m)) return time;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  const hourPadded = String(hour12).padStart(2, "0");
  const minPadded = String(m).padStart(2, "0");
  return `${hourPadded}:${minPadded} ${ampm}`;
}
