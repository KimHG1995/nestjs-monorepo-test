import { Injectable, NotFoundException } from '@nestjs/common';

import {
  PRODUCT_ACTIVITY_TYPES,
  ProductActivityTypeSchema,
} from '@app/common-utils';
import { PrismaService } from '@app/prisma-client';

import { FunnelQueryDto } from './dto/funnel-query.dto';
import {
  calculateProductFunnel,
  type FunnelActivity,
} from './funnel-calculator';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProductFunnel(query: FunnelQueryDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: query.productId },
      select: { id: true, sku: true, name: true },
    });
    if (!product) {
      throw new NotFoundException(
        `상품을 찾을 수 없습니다: ${query.productId}`,
      );
    }

    const activities = await this.prisma.userActivity.findMany({
      where: {
        productId: query.productId,
        activityType: { in: [...PRODUCT_ACTIVITY_TYPES] },
        occurredAt: {
          gte: new Date(query.from),
          lte: new Date(query.to),
        },
      },
      orderBy: [{ userId: 'asc' }, { occurredAt: 'asc' }],
      select: { userId: true, activityType: true, occurredAt: true },
    });

    const funnelActivities: FunnelActivity[] = activities.flatMap(
      (activity) => {
        const activityType = ProductActivityTypeSchema.safeParse(
          activity.activityType,
        );

        return activityType.success
          ? [{ ...activity, activityType: activityType.data }]
          : [];
      },
    );

    return {
      product,
      period: { from: query.from, to: query.to },
      metrics: calculateProductFunnel(funnelActivities),
    };
  }
}
