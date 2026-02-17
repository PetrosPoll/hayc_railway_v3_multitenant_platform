import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Fallback base URL for the booking app when the server doesn't send redirectUrl
 * or sends a relative path. Set VITE_BOOKING_APP_URL per environment if needed;
 * otherwise we fall back to the public production URL so production always works.
 * (Server uses the same VITE_BOOKING_APP_URL when building redirectUrl.)
 */
export const BOOKING_APP_BASE_URL =
  (import.meta.env.VITE_BOOKING_APP_URL as string | undefined) || "https://booking.hayc.gr";