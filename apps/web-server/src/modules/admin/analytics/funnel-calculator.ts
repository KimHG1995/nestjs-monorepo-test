import type { z } from 'zod';

import { ProductActivityTypeSchema } from '@app/common-utils';

export type ProductActivityType = z.infer<typeof ProductActivityTypeSchema>;

export interface FunnelActivity {
  userId: string;
  activityType: ProductActivityType;
  occurredAt: Date;
}

export interface FunnelMetrics {
  viewedUsers: number;
  addedToCartUsers: number;
  purchasedUsers: number;
  viewToCartRate: number;
  cartToPurchaseRate: number;
  overallPurchaseRate: number;
}

type FunnelStage = 0 | 1 | 2 | 3;

const calculateRate = (convertedUsers: number, enteredUsers: number): number =>
  enteredUsers === 0
    ? 0
    : Math.round((convertedUsers / enteredUsers) * 10_000) / 10_000;

export const calculateProductFunnel = (
  activities: readonly FunnelActivity[],
): FunnelMetrics => {
  const stagesByUserId = new Map<string, FunnelStage>();
  const orderedActivities = [...activities].sort(
    (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
  );

  for (const activity of orderedActivities) {
    const currentStage = stagesByUserId.get(activity.userId) ?? 0;

    if (activity.activityType === 'view_product' && currentStage === 0) {
      stagesByUserId.set(activity.userId, 1);
      continue;
    }

    if (activity.activityType === 'add_to_cart' && currentStage === 1) {
      stagesByUserId.set(activity.userId, 2);
      continue;
    }

    if (activity.activityType === 'purchase' && currentStage === 2) {
      stagesByUserId.set(activity.userId, 3);
    }
  }

  let viewedUsers = 0;
  let addedToCartUsers = 0;
  let purchasedUsers = 0;

  for (const stage of stagesByUserId.values()) {
    if (stage >= 1) {
      viewedUsers += 1;
    }

    if (stage >= 2) {
      addedToCartUsers += 1;
    }

    if (stage >= 3) {
      purchasedUsers += 1;
    }
  }

  return {
    viewedUsers,
    addedToCartUsers,
    purchasedUsers,
    viewToCartRate: calculateRate(addedToCartUsers, viewedUsers),
    cartToPurchaseRate: calculateRate(purchasedUsers, addedToCartUsers),
    overallPurchaseRate: calculateRate(purchasedUsers, viewedUsers),
  };
};
