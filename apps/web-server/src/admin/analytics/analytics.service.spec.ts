import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '@app/prisma-client';

import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const productId = '22222222-2222-2222-2222-222222222222';
  const productDelegate = { findUnique: jest.fn() };
  const userActivityDelegate = { findMany: jest.fn() };
  let service: AnalyticsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            product: productDelegate,
            userActivity: userActivityDelegate,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AnalyticsService);
    jest.clearAllMocks();
  });

  it('삭제된 상품도 지정 기간의 과거 퍼널을 조회한다', async () => {
    productDelegate.findUnique.mockResolvedValue({
      id: productId,
      sku: 'SKU-001',
      name: '분석 상품',
    });
    userActivityDelegate.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        activityType: 'view_product',
        occurredAt: new Date('2026-07-23T00:00:00.000Z'),
      },
    ]);

    const result = await service.getProductFunnel({
      productId,
      from: '2026-07-23T00:00:00.000Z',
      to: '2026-07-24T00:00:00.000Z',
    });

    expect(productDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: productId },
      select: { id: true, sku: true, name: true },
    });
    expect(userActivityDelegate.findMany).toHaveBeenCalledWith({
      where: {
        productId,
        activityType: {
          in: ['view_product', 'add_to_cart', 'purchase'],
        },
        occurredAt: {
          gte: new Date('2026-07-23T00:00:00.000Z'),
          lte: new Date('2026-07-24T00:00:00.000Z'),
        },
      },
      orderBy: [{ userId: 'asc' }, { occurredAt: 'asc' }],
      select: { userId: true, activityType: true, occurredAt: true },
    });
    expect(result).toEqual({
      product: {
        id: productId,
        sku: 'SKU-001',
        name: '분석 상품',
      },
      period: {
        from: '2026-07-23T00:00:00.000Z',
        to: '2026-07-24T00:00:00.000Z',
      },
      metrics: {
        viewedUsers: 1,
        addedToCartUsers: 0,
        purchasedUsers: 0,
        viewToCartRate: 0,
        cartToPurchaseRate: 0,
        overallPurchaseRate: 0,
      },
    });
  });

  it('저장된 비상품 활동 타입은 퍼널 계산에서 제외한다', async () => {
    productDelegate.findUnique.mockResolvedValue({
      id: productId,
      sku: 'SKU-001',
      name: '분석 상품',
    });
    userActivityDelegate.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        activityType: 'login',
        occurredAt: new Date('2026-07-23T00:00:00.000Z'),
      },
    ]);

    const result = await service.getProductFunnel({
      productId,
      from: '2026-07-23T00:00:00.000Z',
      to: '2026-07-24T00:00:00.000Z',
    });

    expect(result.metrics.viewedUsers).toBe(0);
  });

  it('없는 상품은 NotFoundException을 던지고 활동을 조회하지 않는다', async () => {
    productDelegate.findUnique.mockResolvedValue(null);

    await expect(
      service.getProductFunnel({
        productId,
        from: '2026-07-23T00:00:00.000Z',
        to: '2026-07-24T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(userActivityDelegate.findMany).not.toHaveBeenCalled();
  });
});
