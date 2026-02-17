import { apiRequest } from "./queryClient";
import type { SubscriptionTier } from "@shared/schema";

export async function createCheckoutSession(data: { 
  email: string; 
  username: string;
  planId: SubscriptionTier;
  vatNumber?: string;
  invoiceType?: "invoice" | "receipt";
  billingPeriod?: "monthly" | "yearly";
  password?: string;
  addOns?: string[]; // Add support for add-ons
  isResume?: boolean; // Add support for resume flow
  language?: string; // Add support for language preference
}) {
  console.log('Creating checkout session with data:', data);
  const res = await apiRequest("POST", "/api/create-checkout-session", data);
  return res.json();
}

export async function getSession(sessionId: string) {
  const res = await apiRequest("GET", `/api/session/${sessionId}`);
  return res.json();
}

export async function logout() {
  const res = await apiRequest("POST", "/api/logout");
  const data = await res.json();
  if (!data.success) {
    throw new Error("Logout failed");
  }
  return data;
}

export async function cancelSubscription(subscriptionId: number) {
  const res = await apiRequest("POST", `/api/subscriptions/${subscriptionId}/cancel`);
  return res.json();
}

export async function createBillingPortalSession() {
  const response = await fetch("/api/create-billing-portal-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to create billing portal session");
  }

  return response.json();
}

export async function upgradeSubscription(subscriptionId: number, targetBillingPeriod: 'yearly') {
  const response = await fetch(`/api/subscriptions/${subscriptionId}/upgrade`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetBillingPeriod }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to upgrade subscription");
  }

  return response.json();
}

export async function checkEmailExists(email: string) {
  const res = await apiRequest("POST", "/api/check-email", { email });
  return res.json();
}