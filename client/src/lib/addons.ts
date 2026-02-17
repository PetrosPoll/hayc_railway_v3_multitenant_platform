
import { availableAddOns } from "@shared/schema";

export const AVAILABLE_ADDONS = availableAddOns;

export const getAddonById = (addonId: string) => {
  return AVAILABLE_ADDONS.find(addon => addon.id === addonId);
};

export const getAddonByPriceId = (priceId: string) => {
  return AVAILABLE_ADDONS.find(addon => addon.priceId === priceId);
};
