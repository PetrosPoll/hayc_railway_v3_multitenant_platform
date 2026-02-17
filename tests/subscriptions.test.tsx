import { describe, it, expect } from 'vitest';
import { 
  mockSubscription, 
  mockCancelledSubscription, 
  mockYearlySubscription 
} from './test-utils';

describe('Subscription Sorting Logic', () => {
  it('should sort active subscriptions before cancelled ones', () => {
    const subscriptions = [
      mockCancelledSubscription,
      mockSubscription,
      { ...mockSubscription, id: 4, createdAt: new Date('2024-03-01').toISOString() },
    ];

    const sorted = subscriptions.sort((a, b) => {
      // Active subscriptions come first
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      // Within same status, sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    expect(sorted[0].status).toBe('active');
    expect(sorted[1].status).toBe('active');
    expect(sorted[2].status).toBe('cancelled');
  });

  it('should sort by creation date within same status', () => {
    const subscriptions = [
      { ...mockSubscription, id: 1, createdAt: new Date('2024-01-01').toISOString(), status: 'active' },
      { ...mockSubscription, id: 2, createdAt: new Date('2024-03-01').toISOString(), status: 'active' },
      { ...mockSubscription, id: 3, createdAt: new Date('2024-02-01').toISOString(), status: 'active' },
    ];

    const sorted = subscriptions.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    expect(sorted[0].id).toBe(2); // March (newest)
    expect(sorted[1].id).toBe(3); // February
    expect(sorted[2].id).toBe(1); // January (oldest)
  });

  it('should handle mixed active and cancelled subscriptions correctly', () => {
    const subscriptions = [
      { ...mockSubscription, id: 1, createdAt: new Date('2024-03-01').toISOString(), status: 'cancelled' },
      { ...mockSubscription, id: 2, createdAt: new Date('2024-01-01').toISOString(), status: 'active' },
      { ...mockSubscription, id: 3, createdAt: new Date('2024-02-01').toISOString(), status: 'cancelled' },
      { ...mockSubscription, id: 4, createdAt: new Date('2024-04-01').toISOString(), status: 'active' },
    ];

    const sorted = subscriptions.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Active subscriptions first
    expect(sorted[0].status).toBe('active');
    expect(sorted[0].id).toBe(4); // April (newest active)
    expect(sorted[1].status).toBe('active');
    expect(sorted[1].id).toBe(2); // January (older active)
    
    // Then cancelled subscriptions
    expect(sorted[2].status).toBe('cancelled');
    expect(sorted[2].id).toBe(1); // March (newest cancelled)
    expect(sorted[3].status).toBe('cancelled');
    expect(sorted[3].id).toBe(3); // February (older cancelled)
  });
});

describe('Subscription Price Display', () => {
  it('should format monthly price correctly', () => {
    const price = mockSubscription.price / 100;
    const formatted = `€${price.toFixed(2)}/month`;
    expect(formatted).toBe('€99.00/month');
  });

  it('should format yearly price correctly', () => {
    const price = mockYearlySubscription.price / 100;
    const formatted = `€${price.toFixed(2)}/year`;
    expect(formatted).toBe('€999.00/year');
  });

  it('should handle price as null/undefined by falling back to plan price', () => {
    const subscriptionWithoutPrice = { ...mockSubscription, price: null };
    const planPrice = 29.99; // From subscriptionPlans.basic
    const price = subscriptionWithoutPrice.price 
      ? (subscriptionWithoutPrice.price / 100).toFixed(2)
      : planPrice;
    expect(price).toBe(29.99);
  });
});

describe('Subscription Status Display', () => {
  it('should display correct status for active subscription', () => {
    expect(mockSubscription.status).toBe('active');
  });

  it('should display correct status for cancelled subscription', () => {
    expect(mockCancelledSubscription.status).toBe('cancelled');
  });
});

describe('Subscription Upgrade Logic', () => {
  it('should allow upgrade from monthly to yearly', () => {
    const canUpgrade = mockSubscription.status === 'active' && 
                      mockSubscription.billingPeriod === 'monthly';
    expect(canUpgrade).toBe(true);
  });

  it('should not allow upgrade for yearly subscriptions', () => {
    const canUpgrade = mockYearlySubscription.status === 'active' && 
                      mockYearlySubscription.billingPeriod === 'monthly';
    expect(canUpgrade).toBe(false);
  });

  it('should not allow upgrade for cancelled subscriptions', () => {
    const canUpgrade = mockCancelledSubscription.status === 'active' && 
                      mockCancelledSubscription.billingPeriod === 'monthly';
    expect(canUpgrade).toBe(false);
  });
});

describe('Subscription Billing Period', () => {
  it('should correctly identify monthly billing period', () => {
    expect(mockSubscription.billingPeriod).toBe('monthly');
  });

  it('should correctly identify yearly billing period', () => {
    expect(mockYearlySubscription.billingPeriod).toBe('yearly');
  });
});
