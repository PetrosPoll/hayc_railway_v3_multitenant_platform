import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';

// Initialize i18n for tests
i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        'dashboard.package': 'Package',
        'dashboard.status': 'Active',
        'dashboard.price': 'Price',
        'dashboard.startDate': 'Start Date',
        'dashboard.nextBillingAccessExpiry': 'Next Billing/Access Expiry',
        'dashboard.addOns': 'Add-ons',
        'dashboard.upgradeActions': 'Upgrade Actions',
        'dashboard.cancellation': 'Cancellation',
        'dashboard.noSubscriptionsFound': 'No subscriptions found',
        'dashboard.viewPlans': 'View Plans',
        'dashboard.browseAddOns': 'Browse Add-ons',
        'dashboard.upgradeToYearly': 'Upgrade to Yearly',
        'dashboard.cancel': 'Cancel',
        'home.plans.period.month': '/month',
        'home.plans.period.year': '/year',
        'status.cancelled': 'Cancelled',
      },
    },
  },
});

// Create a custom render function that includes providers
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );

  return render(ui, {
    wrapper: Wrapper,
    ...options,
  });
}

export * from '@testing-library/react';
export { customRender as render };

// Mock fetch for API calls
export const mockFetch = (response: any, status = 200) => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
    } as Response)
  );
};

// Mock user data
export const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'subscriber' as const,
};

// Mock admin user
export const mockAdminUser = {
  id: 2,
  username: 'admin',
  email: 'admin@example.com',
  role: 'administrator' as const,
};

// Mock subscription data
export const mockSubscription = {
  id: 1,
  userId: 1,
  tier: 'website',
  billingPeriod: 'monthly',
  status: 'active',
  stripeSubscriptionId: 'sub_123',
  createdAt: new Date('2024-01-01').toISOString(),
  price: 9900, // 99.00 in cents
  websiteProgressId: 1,
};

export const mockCancelledSubscription = {
  ...mockSubscription,
  id: 2,
  status: 'cancelled',
  createdAt: new Date('2023-12-01').toISOString(),
};

export const mockYearlySubscription = {
  ...mockSubscription,
  id: 3,
  billingPeriod: 'yearly',
  price: 99900, // 999.00 in cents
  createdAt: new Date('2024-02-01').toISOString(),
};
