import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '@app/prisma-client';

import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const productDelegate = {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  };
  let service: ProductsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: { product: productDelegate },
        },
      ],
    }).compile();

    service = moduleRef.get(ProductsService);
    jest.clearAllMocks();
  });

  it('SKU와 통화 코드를 대문자로 정규화해 상품을 생성한다', async () => {
    productDelegate.create.mockResolvedValue({ id: 'product-1' });

    await service.create({
      sku: ' sku-001 ',
      name: '테스트 상품',
      priceInMinorUnits: 12_000,
      currency: 'krw',
      stockQuantity: 3,
    });

    expect(productDelegate.create).toHaveBeenCalledWith({
      data: {
        sku: 'SKU-001',
        name: '테스트 상품',
        priceInMinorUnits: 12_000,
        currency: 'KRW',
        stockQuantity: 3,
      },
    });
  });

  it('중복 SKU를 ConflictException으로 변환한다', async () => {
    productDelegate.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.create({
        sku: 'SKU-001',
        name: '중복 상품',
        priceInMinorUnits: 1_000,
        currency: 'KRW',
        stockQuantity: 0,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('삭제되지 않은 상품을 검색어와 페이지 기준으로 조회한다', async () => {
    productDelegate.findMany.mockResolvedValue([{ id: 'product-1' }]);
    productDelegate.count.mockResolvedValue(1);

    await expect(
      service.findAll({ page: 2, limit: 10, search: 'shoe' }),
    ).resolves.toEqual({
      items: [{ id: 'product-1' }],
      total: 1,
      page: 2,
      limit: 10,
    });
    expect(productDelegate.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        OR: [
          { sku: { contains: 'shoe', mode: 'insensitive' } },
          { name: { contains: 'shoe', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
    });
  });

  it('삭제된 상품은 단건 조회에서 제외한다', async () => {
    productDelegate.findFirst.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('상품 수정 전에 활성 상품 존재 여부를 확인한다', async () => {
    productDelegate.findFirst.mockResolvedValue({ id: 'product-1' });
    productDelegate.update.mockResolvedValue({
      id: 'product-1',
      sku: 'SKU-002',
    });

    await service.update('product-1', { sku: ' sku-002 ' });

    expect(productDelegate.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { sku: 'SKU-002' },
    });
  });

  it('상품을 소프트 삭제한다', async () => {
    productDelegate.findFirst.mockResolvedValue({ id: 'product-1' });
    productDelegate.update.mockResolvedValue({ id: 'product-1' });

    await service.remove('product-1');

    expect(productDelegate.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
