/** Display names stored in get-started selectedAddons / suggestedAddons. */

export const BOOKING_ADDON_VALUES = [
  "Services Booking",
  "Tours & Transfers",
  "Boat Rentals",
] as const;

export type BookingAddonValue = (typeof BOOKING_ADDON_VALUES)[number];

export const ONLINE_COURSES_ADDON_VALUE = "Online Courses";

export const ALL_GET_STARTED_ADDONS = [
  { key: "onlineCourses", value: "Online Courses" },
  { key: "servicesBooking", value: "Services Booking" },
  { key: "toursTransfers", value: "Tours & Transfers" },
  { key: "boatRentals", value: "Boat Rentals" },
] as const;

/** Display name → Stripe add-on id */
export const GET_STARTED_ADDON_ID_MAP: Record<string, string> = {
  "Booking Integration": "booking", // legacy
  "Boat Rentals": "booking",
  "Tours & Transfers": "booking",
  "Services Booking": "booking",
  HDP: "lms", // legacy
  "Online Courses": "lms",
};

export const GET_STARTED_ADDON_I18N_KEY_MAP: Record<string, string> = {
  "Booking Integration": "bookingIntegration",
  "Boat Rentals": "boatRentals",
  "Tours & Transfers": "toursTransfers",
  "Services Booking": "servicesBooking",
  HDP: "hdp",
  "Online Courses": "onlineCourses",
};

export function isBookingAddonValue(value: string): boolean {
  return GET_STARTED_ADDON_ID_MAP[value] === "booking";
}

/** At most one booking variant; keeps the first found. */
export function enforceSingleBookingAddon(addonValues: string[]): string[] {
  let bookingSeen = false;
  const result: string[] = [];
  for (const value of addonValues) {
    if (isBookingAddonValue(value)) {
      if (bookingSeen) continue;
      bookingSeen = true;
    }
    result.push(value);
  }
  return result;
}

/** Keep first occurrence per Stripe add-on id (avoids charging booking 3×). */
export function dedupeAddonsByStripeId(addonValues: string[]): string[] {
  return enforceSingleBookingAddon(
    (() => {
      const seenIds = new Set<string>();
      const result: string[] = [];
      for (const value of addonValues) {
        const stripeId = GET_STARTED_ADDON_ID_MAP[value];
        if (!stripeId) {
          result.push(value);
          continue;
        }
        if (seenIds.has(stripeId)) continue;
        seenIds.add(stripeId);
        result.push(value);
      }
      return result;
    })(),
  );
}

export function hasAnyBookingAddon(selected: string[]): boolean {
  return selected.some(isBookingAddonValue);
}

export function hasOnlineCoursesAddon(selected: string[]): boolean {
  return selected.some((v) => GET_STARTED_ADDON_ID_MAP[v] === "lms");
}
