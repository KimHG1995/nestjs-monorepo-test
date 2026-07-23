import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { PrismaService } from '@app/prisma-client';

import { WebServerModule } from '../src/web-server.module';

describe('web-server 표준 통신 프로토콜 (e2e)', () => {
  const productId = '22222222-2222-2222-2222-222222222222';
  const productDelegate = {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const userActivityDelegate = { findMany: jest.fn() };
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [WebServerModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        product: productDelegate,
        userActivity: userActivityDelegate,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('성공 응답 정형화 (봉투)', () => {
    it('POST /products는 생성된 상품을 성공 봉투로 반환한다', async () => {
      productDelegate.create.mockResolvedValue({
        id: productId,
        sku: 'SKU-001',
        name: '상품 A',
        priceInMinorUnits: 12_000,
        currency: 'KRW',
        stockQuantity: 3,
        createdAt: new Date('2026-07-23T00:00:00.000Z'),
        updatedAt: new Date('2026-07-23T00:00:00.000Z'),
        deletedAt: null,
      });

      const response = await request(app.getHttpServer())
        .post('/products')
        .send({
          sku: 'sku-001',
          name: '상품 A',
          priceInMinorUnits: 12_000,
          currency: 'krw',
          stockQuantity: 3,
        })
        .expect(201);

      expect(productDelegate.create).toHaveBeenCalledWith({
        data: {
          sku: 'SKU-001',
          name: '상품 A',
          priceInMinorUnits: 12_000,
          currency: 'KRW',
          stockQuantity: 3,
        },
      });
      expect(response.body).toMatchObject({
        success: true,
        data: { id: productId, sku: 'SKU-001' },
        meta: {
          path: '/products',
          timestamp: expect.any(String),
          traceId: expect.any(String),
        },
      });
    });

    it('GET /admin/analytics/funnel은 퍼널 지표를 성공 봉투로 반환한다', async () => {
      productDelegate.findUnique.mockResolvedValue({
        id: productId,
        sku: 'SKU-001',
        name: '상품 A',
      });
      userActivityDelegate.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/admin/analytics/funnel')
        .query({
          productId,
          from: '2026-07-23T00:00:00.000Z',
          to: '2026-07-24T00:00:00.000Z',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          product: { id: productId, sku: 'SKU-001', name: '상품 A' },
          metrics: {
            viewedUsers: 0,
            addedToCartUsers: 0,
            purchasedUsers: 0,
            viewToCartRate: 0,
            cartToPurchaseRate: 0,
            overallPurchaseRate: 0,
          },
        },
      });
    });
  });

  describe('요청 검증 정형화 (Zod → RFC 7807)', () => {
    it('잘못된 상품은 RFC 7807 검증 오류를 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/products')
        .send({ sku: '', name: '', priceInMinorUnits: -1 })
        .expect(400)
        .expect('Content-Type', /application\/problem\+json/);

      expect(response.body).toMatchObject({
        status: 400,
        code: 'VALIDATION_FAILED',
        title: 'Bad Request',
        type: expect.stringContaining('/problems/'),
        traceId: expect.any(String),
      });
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(productDelegate.create).not.toHaveBeenCalled();
    });
  });

  describe('봉투 예외 (@SkipResponseTransform)', () => {
    it('GET /health는 봉투 없이 원본을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({ status: 'ok' });
      expect(response.body.success).toBeUndefined();
    });
  });
});
