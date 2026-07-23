import { calculateProductFunnel } from './funnel-calculator';

describe('calculateProductFunnel', () => {
  it('사용자별 올바른 시간 순서만 전환으로 계산한다', () => {
    const metrics = calculateProductFunnel([
      {
        userId: 'user-1',
        activityType: 'view_product',
        occurredAt: new Date('2026-07-23T00:00:00Z'),
      },
      {
        userId: 'user-1',
        activityType: 'add_to_cart',
        occurredAt: new Date('2026-07-23T00:01:00Z'),
      },
      {
        userId: 'user-1',
        activityType: 'purchase',
        occurredAt: new Date('2026-07-23T00:02:00Z'),
      },
      {
        userId: 'user-2',
        activityType: 'add_to_cart',
        occurredAt: new Date('2026-07-23T00:00:00Z'),
      },
      {
        userId: 'user-2',
        activityType: 'view_product',
        occurredAt: new Date('2026-07-23T00:01:00Z'),
      },
    ]);

    expect(metrics).toEqual({
      viewedUsers: 2,
      addedToCartUsers: 1,
      purchasedUsers: 1,
      viewToCartRate: 0.5,
      cartToPurchaseRate: 1,
      overallPurchaseRate: 0.5,
    });
  });

  it('동일 사용자의 중복 이벤트를 사용자 수에 한 번만 포함한다', () => {
    const metrics = calculateProductFunnel([
      {
        userId: 'user-1',
        activityType: 'view_product',
        occurredAt: new Date('2026-07-23T00:00:00Z'),
      },
      {
        userId: 'user-1',
        activityType: 'view_product',
        occurredAt: new Date('2026-07-23T00:01:00Z'),
      },
    ]);

    expect(metrics.viewedUsers).toBe(1);
    expect(metrics.viewToCartRate).toBe(0);
  });

  it('활동이 없으면 모든 지표와 비율을 0으로 반환한다', () => {
    expect(calculateProductFunnel([])).toEqual({
      viewedUsers: 0,
      addedToCartUsers: 0,
      purchasedUsers: 0,
      viewToCartRate: 0,
      cartToPurchaseRate: 0,
      overallPurchaseRate: 0,
    });
  });
});
