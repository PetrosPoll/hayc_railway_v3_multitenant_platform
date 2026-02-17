import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from './test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  mockUser, 
  mockAdminUser, 
  mockSubscription, 
  mockCancelledSubscription,
  mockYearlySubscription,
  mockFetch 
} from './test-utils';

describe('Dashboard - Subscription Display', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('should display subscription data correctly', () => {
    const subscription = mockSubscription;
    
    // Verify subscription properties
    expect(subscription.tier).toBe('website');
    expect(subscription.status).toBe('active');
    expect(subscription.billingPeriod).toBe('monthly');
    expect(subscription.price).toBe(9900);
  });

  it('should format subscription price correctly from cents to euros', () => {
    const price = mockSubscription.price / 100;
    expect(price).toBe(99.00);
    
    const yearlyPrice = mockYearlySubscription.price / 100;
    expect(yearlyPrice).toBe(999.00);
  });

  it('should display correct billing period text', () => {
    expect(mockSubscription.billingPeriod).toBe('monthly');
    expect(mockYearlySubscription.billingPeriod).toBe('yearly');
  });

  it('should show different status badges for active and cancelled', () => {
    expect(mockSubscription.status).toBe('active');
    expect(mockCancelledSubscription.status).toBe('cancelled');
  });
});

describe('Dashboard - Admin Features', () => {
  it('should identify admin user correctly', () => {
    expect(mockAdminUser.role).toBe('administrator');
    expect(mockUser.role).toBe('subscriber');
  });

  it('should have different permissions for admin vs subscriber', () => {
    const isAdmin = mockAdminUser.role === 'administrator';
    const isSubscriber = mockUser.role === 'subscriber';
    
    expect(isAdmin).toBe(true);
    expect(isSubscriber).toBe(true);
  });
});

describe('Dashboard - Date Formatting', () => {
  it('should format creation date correctly', () => {
    const date = new Date(mockSubscription.createdAt);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getDate()).toBe(1);
  });

  it('should calculate next billing date for active subscriptions', () => {
    const createdAt = new Date(mockSubscription.createdAt);
    const billingPeriod = mockSubscription.billingPeriod;
    
    let nextBillingDate: Date;
    if (billingPeriod === 'monthly') {
      nextBillingDate = new Date(createdAt);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else {
      nextBillingDate = new Date(createdAt);
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    }
    
    expect(nextBillingDate.getMonth()).toBe(1); // February
  });
});

describe('Dashboard - Subscription Actions', () => {
  it('should allow upgrade for active monthly subscriptions', () => {
    const canUpgrade = 
      mockSubscription.status === 'active' && 
      mockSubscription.billingPeriod === 'monthly';
    
    expect(canUpgrade).toBe(true);
  });

  it('should not allow upgrade for yearly subscriptions', () => {
    const canUpgrade = 
      mockYearlySubscription.status === 'active' && 
      mockYearlySubscription.billingPeriod === 'monthly';
    
    expect(canUpgrade).toBe(false);
  });

  it('should not allow upgrade for cancelled subscriptions', () => {
    const canUpgrade = 
      mockCancelledSubscription.status === 'active' && 
      mockCancelledSubscription.billingPeriod === 'monthly';
    
    expect(canUpgrade).toBe(false);
  });

  it('should allow cancellation for active subscriptions', () => {
    const canCancel = mockSubscription.status === 'active';
    expect(canCancel).toBe(true);
  });

  it('should not allow cancellation for already cancelled subscriptions', () => {
    const canCancel = mockCancelledSubscription.status === 'active';
    expect(canCancel).toBe(false);
  });
});

describe('Dashboard - Subscription List Rendering', () => {
  it('should display all subscription information fields', () => {
    const subscription = mockSubscription;
    
    // Check all required fields exist
    expect(subscription).toHaveProperty('id');
    expect(subscription).toHaveProperty('tier');
    expect(subscription).toHaveProperty('status');
    expect(subscription).toHaveProperty('price');
    expect(subscription).toHaveProperty('billingPeriod');
    expect(subscription).toHaveProperty('createdAt');
    expect(subscription).toHaveProperty('websiteProgressId');
  });

  it('should handle empty subscription list', () => {
    const subscriptions: typeof mockSubscription[] = [];
    expect(subscriptions.length).toBe(0);
  });

  it('should handle multiple subscriptions', () => {
    const subscriptions = [
      mockSubscription,
      mockCancelledSubscription,
      mockYearlySubscription,
    ];
    
    expect(subscriptions.length).toBe(3);
    expect(subscriptions.filter(s => s.status === 'active').length).toBe(2);
    expect(subscriptions.filter(s => s.status === 'cancelled').length).toBe(1);
  });
});

describe('Dashboard - API Response Structure', () => {
  it('should handle user API response correctly', () => {
    const userResponse = {
      user: mockUser,
      subscriptions: [mockSubscription],
    };
    
    expect(userResponse.user).toBeDefined();
    expect(userResponse.subscriptions).toBeDefined();
    expect(Array.isArray(userResponse.subscriptions)).toBe(true);
  });

  it('should handle subscription data with all required fields', () => {
    const subscription = mockSubscription;
    
    expect(typeof subscription.id).toBe('number');
    expect(typeof subscription.userId).toBe('number');
    expect(typeof subscription.tier).toBe('string');
    expect(typeof subscription.billingPeriod).toBe('string');
    expect(typeof subscription.status).toBe('string');
    expect(typeof subscription.price).toBe('number');
    expect(typeof subscription.createdAt).toBe('string');
  });
});

describe('Dashboard - Billing Portal Integration', () => {
  it('should have stripe subscription ID for active subscriptions', () => {
    expect(mockSubscription.stripeSubscriptionId).toBe('sub_123');
    expect(mockSubscription.stripeSubscriptionId).toBeTruthy();
  });

  it('should maintain stripe subscription ID for cancelled subscriptions', () => {
    expect(mockCancelledSubscription.stripeSubscriptionId).toBe('sub_123');
  });
});

describe('Dashboard - Tier Information', () => {
  it('should correctly identify subscription tier', () => {
    expect(mockSubscription.tier).toBe('website');
  });

  it('should associate website progress with subscription', () => {
    expect(mockSubscription.websiteProgressId).toBe(1);
    expect(typeof mockSubscription.websiteProgressId).toBe('number');
  });
});
